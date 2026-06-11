import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { assertDoctorAssignment } from '../utils/assertDoctorAssignment.js';
import { runPrediction } from '../services/aiService.js';
import type { ClinicalData, LabResult } from '../services/aiService.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const STALE_THRESHOLD_MS  = 72 * 60 * 60 * 1000; // 72 hours
const LAB_RECENCY_DAYS    = 90;                    // lab results older than this are excluded
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;       // 30-minute duplicate guard

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True when a clinical record's observation time exceeds the stale threshold. */
function isRecordStale(recordedAt: string | null, createdAt: string): boolean {
  const observedAt = recordedAt ?? createdAt;
  return Date.now() - new Date(observedAt).getTime() > STALE_THRESHOLD_MS;
}

/** Normalize JSONB fields that postgres.js v3 sometimes returns as strings. */
function normalizeCd(cd: Record<string, unknown>) {
  let vitals = cd.vitals;
  if (typeof vitals === 'string') { try { vitals = JSON.parse(vitals); } catch { vitals = {}; } }
  if (typeof vitals !== 'object' || vitals === null || Array.isArray(vitals)) vitals = {};
  let symptoms = cd.symptoms;
  if (typeof symptoms === 'string') { try { symptoms = JSON.parse(symptoms); } catch { symptoms = []; } }
  if (!Array.isArray(symptoms)) symptoms = [];
  return { ...cd, vitals, symptoms } as Record<string, unknown>;
}

/** Org-scope subquery fragment: patient must belong to the requesting doctor's org. */
function patientOrgFilter(orgId: string | null) {
  return orgId
    ? sql`AND p.organization_id = ${orgId}`
    : sql``;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const patientSchema = z.object({
  name:            z.string().min(2, { message: 'ERR_NAME_TOO_SHORT' }),
  age:             z.number().int().min(0).max(150, { message: 'ERR_AGE_INVALID' }),
  gender:          z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'ERR_GENDER_INVALID' }),
  medical_history: z.record(z.unknown()).optional(),
});

const clinicalDataSchema = z.object({
  patient_id: z.string().uuid({ message: 'ERR_PATIENT_INVALID' }),
  vitals: z.object({
    temperature:              z.number().optional(),
    heart_rate:               z.number().optional(),
    blood_pressure_systolic:  z.number().optional(),
    blood_pressure_diastolic: z.number().optional(),
    spo2:                     z.number().optional(),
  }),
  symptoms:    z.array(z.string()),
  recorded_at: z.string(),
  visit_date:  z.string(),
});

const updateClinicalSchema = z.object({
  vitals: z.object({
    temperature:              z.number().optional(),
    heart_rate:               z.number().optional(),
    blood_pressure_systolic:  z.number().optional(),
    blood_pressure_diastolic: z.number().optional(),
    spo2:                     z.number().optional(),
  }).optional(),
  symptoms:    z.array(z.string()).optional(),
  recorded_at: z.string().datetime({ offset: true }).optional(),
  visit_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const labOrderSchema = z.object({
  patient_id:  z.string().uuid({ message: 'ERR_PATIENT_INVALID' }),
  test_type:   z.string().min(2, { message: 'ERR_TEST_TYPE_REQUIRED' }),
  notes:       z.string().optional(),
  assigned_to: z.string().uuid().optional(),
});

const predictionSchema = z.object({
  patient_id:    z.string().uuid({ message: 'ERR_PATIENT_INVALID' }),
  model_version: z.string().default('v2.3.1'),
});

// ─── Patients ─────────────────────────────────────────────────────────────────

export const getPatients = catchAsync(async (req: Request, res: Response) => {
  const orgId  = req.user!.org_id;
  const userId = req.user!.user_id;
  const limit  = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const search = req.query.search ? String(req.query.search) : null;
  const cursor = req.query.cursor ? String(req.query.cursor) : null;

  // scope=mine → only patients the doctor has an active assignment on.
  // scope=org (default) → all org patients (read-only boundary enforced by write guards).
  const scopeMine = req.query.scope === 'mine';

  let cursorCreatedAt: string | null = null;
  let cursorPatientId: string | null = null;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      cursorCreatedAt = decoded.created_at;
      cursorPatientId = decoded.patient_id;
    } catch {
      // Invalid cursor — ignore, start from beginning
    }
  }

  const searchFilter = search
    ? sql`AND p.name ILIKE ${'%' + search + '%'}`
    : sql``;

  const cursorFilter = cursorCreatedAt && cursorPatientId
    ? sql`AND (p.created_at, p.patient_id) < (${cursorCreatedAt}, ${cursorPatientId})`
    : sql``;

  // "Mine" scope: EXISTS check against patient_assignments
  const scopeFilter = scopeMine
    ? sql`AND EXISTS (
        SELECT 1 FROM patient_assignments pa
        WHERE  pa.patient_id    = p.patient_id
          AND  pa.doctor_id     = ${userId}
          AND  pa.discharged_at IS NULL
          AND  (pa.valid_until IS NULL OR pa.valid_until > NOW())
      )`
    : sql``;

  const patients = await sql`
    SELECT
      p.patient_id, p.name, p.age, p.gender, p.created_at,
      ir.risk_level AS risk_status, ir.risk_score,
      CASE
        WHEN cd.created_at IS NULL THEN 'NO_DATA'
        WHEN COALESCE(cd.recorded_at, cd.created_at) < NOW() - INTERVAL '72 hours' THEN 'STALE'
        ELSE 'FRESH'
      END AS clinical_data_status,
      -- Let the frontend know whether the viewing doctor is assigned to this patient
      EXISTS (
        SELECT 1 FROM patient_assignments pa2
        WHERE  pa2.patient_id    = p.patient_id
          AND  pa2.doctor_id     = ${userId}
          AND  pa2.discharged_at IS NULL
          AND  (pa2.valid_until IS NULL OR pa2.valid_until > NOW())
      ) AS is_assigned
    FROM patients p
    LEFT JOIN LATERAL (
      SELECT risk_level, risk_score FROM infection_risks
      WHERE  patient_id = p.patient_id ORDER BY created_at DESC LIMIT 1
    ) ir ON TRUE
    LEFT JOIN LATERAL (
      SELECT created_at, recorded_at FROM clinical_data
      WHERE  patient_id = p.patient_id AND deleted_at IS NULL
      ORDER BY COALESCE(recorded_at, created_at) DESC LIMIT 1
    ) cd ON TRUE
    WHERE p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
      ${searchFilter}
      ${cursorFilter}
      ${scopeFilter}
    ORDER BY p.created_at DESC, p.patient_id DESC
    LIMIT ${limit}
  `;

  let next_cursor: string | null = null;
  if (patients.length === limit) {
    const last = patients[patients.length - 1];
    next_cursor = Buffer.from(
      JSON.stringify({ created_at: last.created_at, patient_id: last.patient_id })
    ).toString('base64');
  }

  const [countRow] = await sql`
    SELECT COUNT(*) AS total
    FROM patients p
    WHERE p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
      ${searchFilter}
      ${scopeFilter}
  `;

  res.status(200).json({
    status: 'success',
    data: { patients, next_cursor, total_count: Number(countRow.total) },
  });
});

export const getPatientById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;
  const orgId  = req.user!.org_id;
  const userId = req.user!.user_id;

  const [patient] = await sql`
    SELECT
      p.patient_id, p.name, p.age, p.gender, p.medical_history, p.created_at,
      ir.risk_level, ir.risk_score
    FROM patients p
    LEFT JOIN LATERAL (
      SELECT risk_level, risk_score FROM infection_risks
      WHERE patient_id = p.patient_id ORDER BY created_at DESC LIMIT 1
    ) ir ON TRUE
    WHERE p.patient_id = ${patientId}
      AND p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
    LIMIT 1
  `;
  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  // Active care team for this patient
  const assignments = await sql`
    SELECT
      pa.assignment_id,
      pa.role,
      pa.assigned_at,
      pa.notes,
      u.user_id  AS doctor_id,
      u.username AS doctor_name
    FROM patient_assignments pa
    JOIN users u ON u.user_id = pa.doctor_id
    WHERE pa.patient_id    = ${patientId}
      AND pa.discharged_at IS NULL
      AND (pa.valid_until IS NULL OR pa.valid_until > NOW())
    ORDER BY
      CASE pa.role WHEN 'PRIMARY' THEN 1 WHEN 'COVERING' THEN 2 ELSE 3 END,
      pa.assigned_at ASC
  `;

  // Whether the viewing doctor is on this patient's care team
  const isAssigned = assignments.some((a: Record<string, unknown>) => a.doctor_id === userId);

  const clinicalData = (await sql`
    SELECT
      cd.data_id, cd.vitals, cd.symptoms, cd.recorded_at, cd.visit_date, cd.created_at, cd.recorded_by,
      (COALESCE(cd.recorded_at, cd.created_at) < NOW() - INTERVAL '72 hours') AS is_stale,
      (
        SELECT COUNT(*) FROM prediction_requests pr
        WHERE  pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED'
      ) AS linked_prediction_count
    FROM clinical_data cd
    WHERE cd.patient_id = ${patientId}
      AND cd.deleted_at IS NULL
    ORDER BY COALESCE(cd.recorded_at, cd.created_at) DESC
  `).map(normalizeCd);

  const labTests = await sql`
    SELECT test_id, test_type, status, notes, ordered_at
    FROM   lab_tests
    WHERE  patient_id = ${patientId} AND deleted_at IS NULL
    ORDER  BY ordered_at DESC
  `;

  res.status(200).json({
    status: 'success',
    data: {
      patient: { ...patient, clinicalData, labTests, assignments, is_assigned: isAssigned },
    },
  });
});

export const createPatient = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = patientSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  // Wrap patient INSERT + PRIMARY assignment in one transaction
  const patient = await sql.begin(async tx => {
    const [p] = await tx`
      INSERT INTO patients (name, age, gender, medical_history, organization_id, created_by)
      VALUES (
        ${val.data.name}, ${val.data.age}, ${val.data.gender},
        ${JSON.stringify(val.data.medical_history ?? {})}::jsonb,
        ${req.user!.org_id}, ${req.user!.user_id}
      )
      RETURNING patient_id, name, age, gender, created_at
    `;

    // Auto-assign the creating doctor as PRIMARY
    await tx`
      INSERT INTO patient_assignments (patient_id, doctor_id, role, assigned_by)
      VALUES (${p.patient_id}, ${req.user!.user_id}, 'PRIMARY', ${req.user!.user_id})
    `;

    return p;
  });

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_PATIENT_CREATED',
    data: { patient },
  });
});

// ─── Clinical Data ────────────────────────────────────────────────────────────

export const getClinicalDataHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;
  const orgId  = req.user!.org_id;
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit  = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10)));
  const offset = (page - 1) * limit;

  const [patient] = await sql`
    SELECT patient_id FROM patients p
    WHERE  p.patient_id = ${patientId}
      AND  p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
    LIMIT 1
  `;
  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  const records = (await sql`
    SELECT
      cd.data_id, cd.vitals, cd.symptoms,
      cd.recorded_at, cd.visit_date, cd.created_at, cd.recorded_by,
      (COALESCE(cd.recorded_at, cd.created_at) < NOW() - INTERVAL '72 hours') AS is_stale,
      (
        SELECT COUNT(*) FROM prediction_requests pr
        WHERE  pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED'
      ) AS linked_prediction_count,
      u.username AS recorded_by_name
    FROM clinical_data cd
    LEFT JOIN users u ON u.user_id = cd.recorded_by
    WHERE cd.patient_id = ${patientId}
      AND cd.deleted_at IS NULL
    ORDER BY COALESCE(cd.recorded_at, cd.created_at) DESC
    LIMIT ${limit} OFFSET ${offset}
  `).map(normalizeCd);

  const [countRow] = await sql`
    SELECT COUNT(*) AS total FROM clinical_data
    WHERE patient_id = ${patientId} AND deleted_at IS NULL
  `;

  res.status(200).json({
    status: 'success',
    data: {
      records,
      pagination: {
        page, limit,
        total: Number(countRow.total),
        pages: Math.ceil(Number(countRow.total) / limit),
      },
    },
  });
});

export const createClinicalData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = clinicalDataSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { patient_id, vitals, symptoms, recorded_at, visit_date } = val.data;
  const orgId = req.user!.org_id;

  // Org-scope guard
  const [patient] = await sql`
    SELECT patient_id FROM patients p
    WHERE  p.patient_id = ${patient_id}
      AND  p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
    LIMIT 1
  `;
  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  // Assignment guard — doctor must be on the care team to write clinical data
  if (!(await assertDoctorAssignment(patient_id, req.user!.user_id, next))) return;

  // Duplicate guard: same doctor, same patient, within the last 30 min
  const [recent] = await sql`
    SELECT data_id FROM clinical_data
    WHERE  patient_id  = ${patient_id}
      AND  recorded_by = ${req.user!.user_id}
      AND  COALESCE(recorded_at, created_at) > NOW() - INTERVAL '30 minutes'
      AND  deleted_at IS NULL
    LIMIT 1
  `;
  if (recent) return next(new AppError('ERROR_CLINICAL_DATA_DUPLICATE', 409));

  let [cd] = await sql`
    INSERT INTO clinical_data (patient_id, vitals, symptoms, recorded_by, recorded_at, visit_date)
    VALUES (
      ${patient_id},
      ${JSON.stringify(vitals)}::jsonb,
      ${JSON.stringify(symptoms)}::jsonb,
      ${req.user!.user_id},
      ${recorded_at ?? null},
      ${visit_date  ?? null}
    )
    RETURNING data_id, patient_id, vitals, symptoms, recorded_at, visit_date, created_at
  `;
  cd = normalizeCd(cd as Record<string, unknown>);

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_CLINICAL_DATA_SAVED',
    data: { clinicalData: cd },
  });
});

export const updateClinicalData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { dataId } = req.params;
  const orgId = req.user!.org_id;

  const val = updateClinicalSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  if (!val.data.vitals && !val.data.symptoms && !val.data.recorded_at && !val.data.visit_date) {
    return next(new AppError('ERROR_NOTHING_TO_UPDATE', 400));
  }

  // Org-scope + existence check — also fetches patient_id for assignment guard
  const [existing] = await sql`
    SELECT
      cd.data_id,
      cd.patient_id,
      (SELECT COUNT(*) FROM prediction_requests pr
       WHERE  pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED') AS linked_count
    FROM clinical_data cd
    JOIN patients p ON p.patient_id = cd.patient_id
    WHERE cd.data_id    = ${dataId}
      AND cd.deleted_at IS NULL
      ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    LIMIT 1
  `;
  if (!existing) return next(new AppError('ERROR_CLINICAL_DATA_NOT_FOUND', 404));

  // Assignment guard
  if (!(await assertDoctorAssignment(String(existing.patient_id), req.user!.user_id, next))) return;

  const isLinked    = Number(existing.linked_count) > 0;
  const vitalsJson  = val.data.vitals   !== undefined ? JSON.stringify(val.data.vitals)   : null;
  const symptomsJson = val.data.symptoms !== undefined ? JSON.stringify(val.data.symptoms) : null;

  let [updated] = await sql`
    UPDATE clinical_data
    SET
      vitals      = ${vitalsJson !== null
                      ? sql`vitals || ${vitalsJson}::jsonb`
                      : sql`vitals`},
      symptoms    = ${symptomsJson !== null
                      ? sql`${symptomsJson}::jsonb`
                      : sql`symptoms`},
      recorded_at = ${val.data.recorded_at !== undefined
                      ? sql`${val.data.recorded_at}`
                      : sql`recorded_at`},
      visit_date  = ${val.data.visit_date !== undefined
                      ? sql`${val.data.visit_date}`
                      : sql`visit_date`}
    WHERE data_id    = ${dataId}
      AND deleted_at IS NULL
    RETURNING data_id, patient_id, vitals, symptoms, recorded_at, visit_date, created_at
  `;
  updated = normalizeCd(updated as Record<string, unknown>);

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_CLINICAL_DATA_UPDATED',
    data: {
      clinicalData: updated,
      ...(isLinked && {
        warning: 'This record was already used in completed predictions. Those historical predictions now reference updated data.',
      }),
    },
  });
});

export const deleteClinicalData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { dataId } = req.params;
  const orgId = req.user!.org_id;

  // Org-scope + existence check
  const [existing] = await sql`
    SELECT
      cd.data_id,
      cd.patient_id,
      (SELECT COUNT(*) FROM prediction_requests pr
       WHERE  pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED') AS linked_count
    FROM clinical_data cd
    JOIN patients p ON p.patient_id = cd.patient_id
    WHERE cd.data_id    = ${dataId}
      AND cd.deleted_at IS NULL
      ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    LIMIT 1
  `;
  if (!existing) return next(new AppError('ERROR_CLINICAL_DATA_NOT_FOUND', 404));

  // Assignment guard
  if (!(await assertDoctorAssignment(String(existing.patient_id), req.user!.user_id, next))) return;

  // Soft delete — preserves snapshot for historical predictions
  await sql`UPDATE clinical_data SET deleted_at = NOW() WHERE data_id = ${dataId}`;

  const linkedCount = Number(existing.linked_count);

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_CLINICAL_DATA_DELETED',
    data: {
      archived: true,
      ...(linkedCount > 0 && {
        note: `This record was used in ${linkedCount} completed prediction(s). It has been archived and is no longer included in future predictions.`,
      }),
    },
  });
});

// ─── Lab Orders ───────────────────────────────────────────────────────────────
// Only assigned doctors can order a test for a patient.

export const getLabTechs = catchAsync(async (req: Request, res: Response) => {
  const techs = await sql`
    SELECT u.user_id, u.username
    FROM   users u
    JOIN   lab_technicians lt ON lt.user_id = u.user_id
    WHERE  u.organization_id = ${req.user!.org_id} AND u.deleted_at IS NULL
  `;
  res.status(200).json({ status: 'success', data: { techs } });
});

export const createLabOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = labOrderSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { patient_id, test_type, notes, assigned_to } = val.data;
  const orgId = req.user!.org_id;

  // Org-scope guard on the patient
  const [patient] = await sql`
    SELECT patient_id FROM patients p
    WHERE  p.patient_id = ${patient_id}
      AND  p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
    LIMIT 1
  `;
  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  // Assignment guard
  if (!(await assertDoctorAssignment(patient_id, req.user!.user_id, next))) return;

  let assignedTechId: string | null = null;
  if (assigned_to) {
    const [techRow] = await sql`
      SELECT technician_id FROM lab_technicians WHERE user_id = ${assigned_to} LIMIT 1
    `;
    if (!techRow) return next(new AppError('ERROR_USER_NOT_FOUND', 400));
    assignedTechId = techRow.technician_id;
  }

  const [test] = await sql`
    INSERT INTO lab_tests (patient_id, test_type, requested_by, notes, status, assigned_to)
    VALUES (${patient_id}, ${test_type}, ${req.user!.user_id}, ${notes ?? null}, 'PENDING', ${assignedTechId})
    RETURNING test_id, patient_id, test_type, status, ordered_at
  `;

  // Bulk alert: single INSERT regardless of tech count
  if (orgId) {
    let techIds: string[] = [];
    if (assigned_to) {
      techIds = [assigned_to];
    } else {
      const techs = await sql`
        SELECT u.user_id FROM users u
        JOIN   lab_technicians lt ON lt.user_id = u.user_id
        WHERE  u.organization_id = ${orgId} AND u.deleted_at IS NULL
      `;
      techIds = (techs as unknown as Array<{ user_id: string }>).map(t => t.user_id);
    }

    if (techIds.length > 0) {
      await sql`
        INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
        SELECT ${patient_id}, unnest(${sql.array(techIds)}::uuid[]), 'NEW_LAB_ORDER', ${'New lab order: ' + test_type}
      `;
    }
  }

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_LAB_ORDER_CREATED',
    data: { labTest: test },
  });
});

// ─── Predictions ──────────────────────────────────────────────────────────────

export const createPrediction = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = predictionSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { patient_id, model_version } = val.data;
  const ctx = req.subscriptionCtx;

  // ── Step 1: Latest ACTIVE clinical record ─────────────────────────────────
  const [rawClinical] = await sql`
    SELECT data_id, vitals, symptoms, recorded_at, created_at
    FROM   clinical_data
    WHERE  patient_id = ${patient_id}
      AND  deleted_at IS NULL
    ORDER  BY COALESCE(recorded_at, created_at) DESC
    LIMIT  1
  `;
  const clinicalRecord = rawClinical ? normalizeCd(rawClinical as Record<string, unknown>) : null;

  // ── Step 2: Recent lab results (last LAB_RECENCY_DAYS days) ───────────────
  const labResults = await sql`
    SELECT ltr.analyte_name, ltr.value, ltr.flag, ltr.reference_low, ltr.reference_high
    FROM   lab_test_results ltr
    JOIN   lab_tests lt ON lt.test_id = ltr.test_id
    WHERE  lt.patient_id  = ${patient_id}
      AND  lt.status      = 'COMPLETED'
      AND  lt.deleted_at  IS NULL
      AND  ltr.is_amended = FALSE
      AND  lt.updated_at  >= NOW() - INTERVAL '90 days'
    ORDER  BY ltr.created_at DESC
  `;

  const hasAnyLabResults = labResults.length === 0
    ? (await sql`
        SELECT COUNT(*) AS c FROM lab_test_results ltr
        JOIN   lab_tests lt ON lt.test_id = ltr.test_id
        WHERE  lt.patient_id = ${patient_id} AND lt.status = 'COMPLETED' AND lt.deleted_at IS NULL
      `)[0]?.c > 0
    : true;

  // ── Build data_warnings ────────────────────────────────────────────────────
  type WarnType = 'NO_CLINICAL_DATA' | 'STALE_CLINICAL_DATA' | 'NO_LAB_RESULTS' | 'NO_RECENT_LAB_RESULTS';
  const dataWarnings: Array<{ type: WarnType; message: string }> = [];
  let clinicalDataStale = false;

  if (!clinicalRecord) {
    dataWarnings.push({ type: 'NO_CLINICAL_DATA', message: 'No clinical data found. Prediction accuracy will be reduced.' });
  } else {
    clinicalDataStale = isRecordStale(
      (clinicalRecord as Record<string, unknown>)['recorded_at'] as string | null,
      (clinicalRecord as Record<string, unknown>)['created_at'] as string,
    );
    if (clinicalDataStale) {
      const cd_ = clinicalRecord as Record<string, unknown>;
      const observedAt = (cd_['recorded_at'] ?? cd_['created_at']) as string;
      const hoursAgo   = Math.round((Date.now() - new Date(observedAt).getTime()) / 3_600_000);
      dataWarnings.push({
        type: 'STALE_CLINICAL_DATA',
        message: `Clinical data is ${hoursAgo}h old (threshold: 72h). Consider recording a fresh observation.`,
      });
    }
  }

  if (labResults.length === 0) {
    dataWarnings.push({
      type: hasAnyLabResults ? 'NO_RECENT_LAB_RESULTS' : 'NO_LAB_RESULTS',
      message: hasAnyLabResults
        ? `No lab results found within the last ${LAB_RECENCY_DAYS} days. Older results were excluded.`
        : 'No completed lab results found for this patient.',
    });
  }

  // ── Step 3: Create pending request record ─────────────────────────────────
  const [predRequest] = await sql`
    INSERT INTO prediction_requests (patient_id, clinical_data_id, requested_by, model_version, status)
    VALUES (
      ${patient_id},
      ${clinicalRecord ? (clinicalRecord as Record<string, unknown>)['data_id'] as string : null},
      ${req.user!.user_id},
      ${model_version},
      'PROCESSING'
    )
    RETURNING request_id
  `;

  // ── Step 4: Run clinical scoring engine ────────────────────────────────────
  const aiPayload = {
    clinical: clinicalRecord
      ? {
          vitals:   (clinicalRecord as Record<string, unknown>).vitals as ClinicalData['vitals'],
          symptoms: ((clinicalRecord as Record<string, unknown>).symptoms as string[]) ?? [],
        }
      : null,
    lab: (labResults as Array<Record<string, unknown>>).map(r => ({
      analyte_name:   String(r.analyte_name),
      value:          String(r.value),
      flag:           r.flag as LabResult['flag'],
      reference_low:  r.reference_low != null ? Number(r.reference_low) : undefined,
      reference_high: r.reference_high != null ? Number(r.reference_high) : undefined,
    })),
    model_version,
  };

  const aiResult = await runPrediction(aiPayload);

  const { risk_score, risk_level: riskLevel, confidence, raw_payload, feature_explanations: features } = aiResult;

  // ── Step 5: Persist results ────────────────────────────────────────────────
  const [predResult] = await sql`
    INSERT INTO prediction_results (request_id, risk_score, risk_level, confidence, raw_payload)
    VALUES (${predRequest.request_id}, ${risk_score}, ${riskLevel}, ${confidence}, ${JSON.stringify(raw_payload)}::jsonb)
    RETURNING result_id
  `;

  for (const fe of features) {
    await sql`
      INSERT INTO feature_explanations (result_id, feature_name, contribution, direction, rank)
      VALUES (${predResult.result_id}, ${fe.feature_name}, ${fe.contribution}, ${fe.direction}, ${fe.rank})
    `;
  }

  await sql`
    INSERT INTO infection_risks (patient_id, risk_score, risk_level, model_version, message)
    VALUES (
      ${patient_id}, ${risk_score}, ${riskLevel}, ${model_version},
      ${`AI prediction: ${riskLevel} infection risk (confidence ${Math.round(confidence * 100)}%)`}
    )
  `;

  await sql`UPDATE prediction_requests SET status = 'COMPLETED' WHERE request_id = ${predRequest.request_id}`;

  // ── Step 6: Generate risk-based alerts for the care team ───────────────────
  const alertType = riskLevel === 'CRITICAL' ? 'RISK_CRITICAL'
                  : riskLevel === 'HIGH'     ? 'RISK_HIGH'
                  : riskLevel === 'MODERATE' ? 'RISK_MODERATE'
                  : riskLevel === 'LOW'      ? 'RISK_LOW'
                  : null;

  if (alertType && riskLevel !== 'LOW') {
    const alertMessage = `AI prediction: ${riskLevel} infection risk (score ${Math.round(risk_score * 100)}%, confidence ${Math.round(confidence * 100)}%)`;

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      // Alert all doctors assigned to this patient
      const assignedDoctors = await sql`
        SELECT pa.doctor_id FROM patient_assignments pa
        WHERE  pa.patient_id    = ${patient_id}
          AND  pa.discharged_at IS NULL
          AND  (pa.valid_until IS NULL OR pa.valid_until > NOW())
      `;
      const doctorIds = (assignedDoctors as unknown as Array<{ doctor_id: string }>).map(d => d.doctor_id);

      if (doctorIds.length > 0) {
        await sql`
          INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
          SELECT ${patient_id}, unnest(${sql.array(doctorIds)}::uuid[]), ${alertType}, ${alertMessage}
        `;
      }
    } else {
      // MODERATE — alert only the requesting doctor
      await sql`
        INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
        VALUES (${patient_id}, ${req.user!.user_id}, ${alertType}, ${alertMessage})
      `;
    }
  }

  res.status(201).json({
    status: 'success',
    messageKey: ctx?.isOverage ? 'SUCCESS_PREDICTION_OVERAGE' : 'SUCCESS_PREDICTION_REQUESTED',
    data: {
      predictionRequest: { request_id: predRequest.request_id, risk_level: riskLevel, risk_score, confidence, model_version },
      clinical_data_stale: clinicalDataStale,
      data_warnings:       dataWarnings,
      ...(ctx?.isOverage && {
        overage_warning: {
          message:             'Monthly prediction limit exceeded. Overage billing applies.',
          predictions_overage: ctx.predictions_overage,
        },
      }),
    },
  });
});

// ─── getPredictions — org-scoped with optional ?scope=mine ───────────────────

export const getPredictions = catchAsync(async (req: Request, res: Response) => {
  const orgId    = req.user!.org_id;
  const userId   = req.user!.user_id;
  const scopeMine = req.query.scope === 'mine';
  const patientId = req.query.patient_id as string | undefined;
  const search = req.query.search as string | undefined;
  const risk = req.query.risk as string | undefined;
  const dateRange = req.query.date_range as string | undefined;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 8;
  const offset = (page - 1) * limit;

  // Build dynamic filters
  const conditions = [sql`p.deleted_at IS NULL`];
  if (orgId) conditions.push(sql`p.organization_id = ${orgId}`);
  if (scopeMine) conditions.push(sql`pr.requested_by = ${userId}`);
  if (patientId) conditions.push(sql`pr.patient_id = ${patientId}`);
  
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(sql`LOWER(p.name) LIKE ${q}`);
  }
  if (risk && risk !== 'ALL') {
    conditions.push(sql`pres.risk_level = ${risk}`);
  }
  if (dateRange && dateRange !== 'ALL') {
    if (dateRange === 'TODAY') {
      conditions.push(sql`pr.created_at >= NOW() - INTERVAL '1 day'`);
    } else if (dateRange === '7DAYS') {
      conditions.push(sql`pr.created_at >= NOW() - INTERVAL '7 days'`);
    } else if (dateRange === '30DAYS') {
      conditions.push(sql`pr.created_at >= NOW() - INTERVAL '30 days'`);
    }
  }

  const whereClause = sql`${conditions.reduce((acc, condition, i) => i === 0 ? condition : sql`${acc} AND ${condition}`, sql``)}`;

  const predictions = await sql`
    SELECT
      pr.request_id, pr.patient_id, p.name AS patient_name,
      pr.model_version, pr.status, pr.created_at,
      pres.risk_score, pres.risk_level, pres.confidence,
      (
        cd.data_id IS NULL
        OR COALESCE(cd.recorded_at, cd.created_at) < pr.created_at - INTERVAL '72 hours'
      ) AS clinical_data_stale
    FROM prediction_requests pr
    JOIN patients p       ON p.patient_id     = pr.patient_id
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    LEFT JOIN clinical_data cd        ON cd.data_id      = pr.clinical_data_id
    WHERE ${whereClause}
    ORDER BY pr.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS total
    FROM prediction_requests pr
    JOIN patients p       ON p.patient_id     = pr.patient_id
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    WHERE ${whereClause}
  `;

  const riskCountsRows = await sql`
    SELECT pres.risk_level, COUNT(*)::int AS count
    FROM prediction_requests pr
    JOIN patients p       ON p.patient_id     = pr.patient_id
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    WHERE ${whereClause} AND pres.risk_level IS NOT NULL
    GROUP BY pres.risk_level
  `;

  const riskCounts = riskCountsRows.reduce((acc, row) => {
    acc[row.risk_level as string] = Number(row.count);
    return acc;
  }, {} as Record<string, number>);

  res.status(200).json({ 
    status: 'success', 
    data: { 
      predictions,
      riskCounts,
      pagination: {
        total: Number(countRow.total),
        page,
        limit,
        pages: Math.ceil(Number(countRow.total) / limit)
      }
    } 
  });
});

export const getPredictionById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { predictionId } = req.params;

  const [prediction] = await sql`
    SELECT
      pr.request_id, pr.patient_id, p.name AS patient_name,
      p.age AS patient_age, p.gender AS patient_gender,
      pr.model_version, pr.status, pr.created_at,
      u.username AS requested_by_name,
      pres.result_id, pres.risk_score, pres.risk_level, pres.confidence, pres.raw_payload,
      cd.data_id         AS clinical_data_id,
      cd.vitals          AS clinical_vitals,
      cd.symptoms        AS clinical_symptoms,
      cd.recorded_at     AS clinical_recorded_at,
      cd.visit_date      AS clinical_visit_date,
      cd.created_at      AS clinical_created_at,
      cd.deleted_at      AS clinical_deleted_at,
      (
        cd.data_id IS NULL
        OR COALESCE(cd.recorded_at, cd.created_at) < pr.created_at - INTERVAL '72 hours'
      ) AS clinical_data_stale,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'feature_name', fe.feature_name,
            'contribution', fe.contribution,
            'direction',    fe.direction,
            'rank',         fe.rank
          ) ORDER BY fe.rank
        ) FILTER (WHERE fe.explanation_id IS NOT NULL),
        '[]'
      ) AS feature_explanations
    FROM prediction_requests pr
    JOIN patients p ON p.patient_id = pr.patient_id
    LEFT JOIN users u              ON u.user_id     = pr.requested_by
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    LEFT JOIN clinical_data cd        ON cd.data_id      = pr.clinical_data_id
    LEFT JOIN feature_explanations fe ON fe.result_id    = pres.result_id
    WHERE pr.request_id = ${predictionId}
    GROUP BY pr.request_id, p.name, p.age, p.gender, u.username, pres.result_id, cd.data_id
    LIMIT 1
  `;

  if (!prediction) return next(new AppError('ERROR_PREDICTION_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { prediction } });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const getAlerts = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 8;
  const offset = (page - 1) * limit;

  const alerts = await sql`
    SELECT a.alert_id, a.patient_id, pat.name AS patient_name,
           a.alert_type, a.message, a.is_read, a.read_at, a.created_at
    FROM   alerts a
    LEFT JOIN patients pat ON pat.patient_id = a.patient_id
    WHERE  a.recipient_id = ${req.user!.user_id}
    ORDER  BY a.created_at DESC
    LIMIT  ${limit} OFFSET ${offset}
  `;

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM alerts
    WHERE recipient_id = ${req.user!.user_id}
  `;

  const [{ unread_count }] = await sql`
    SELECT COUNT(*)::int AS unread_count
    FROM alerts
    WHERE recipient_id = ${req.user!.user_id}
      AND is_read = false
  `;

  res.status(200).json({ 
    status: 'success', 
    data: { 
      alerts,
      unreadCount: unread_count,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    } 
  });
});

export const markAlertRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { alertId } = req.params;
  const [alert] = await sql`
    UPDATE alerts SET is_read = TRUE, read_at = NOW()
    WHERE  alert_id = ${alertId} AND recipient_id = ${req.user!.user_id}
    RETURNING alert_id
  `;
  if (!alert) return next(new AppError('ERROR_ALERT_NOT_FOUND', 404));
  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_ALERT_READ' });
});

// ─── Lab results (doctor view) ────────────────────────────────────────────────

export const getLabTestResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;
  const orgId = req.user!.org_id;

  const [test] = await sql`
    SELECT lt.test_id, lt.test_type, lt.status,
           pat.name AS patient_name, pat.age, pat.gender
    FROM   lab_tests lt
    JOIN   patients pat ON pat.patient_id = lt.patient_id
    WHERE  lt.test_id    = ${testId}
      AND  lt.deleted_at IS NULL
      ${orgId ? sql`AND lt.requested_by IN (
           SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL
         )` : sql``}
    LIMIT 1
  `;
  if (!test) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  const results = await sql`
    SELECT
      ltr.result_id, ltr.analyte_name, ltr.value,
      ltr.reference_low, ltr.reference_high, ltr.flag,
      ltr.sub_panel, ltr.is_amended, ltr.original_result_id,
      ltr.acknowledged_at, ltr.acknowledged_by,
      un.symbol  AS unit_symbol,
      u.username AS acknowledged_by_name,
      ltr.created_at
    FROM  lab_test_results ltr
    LEFT JOIN units un ON un.unit_id  = ltr.unit_id
    LEFT JOIN users u  ON u.user_id   = ltr.acknowledged_by
    WHERE ltr.test_id = ${testId}
    ORDER BY ltr.sub_panel NULLS LAST, ltr.created_at ASC
  `;

  res.status(200).json({ status: 'success', data: { test, results } });
});

export const acknowledgeResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { resultId } = req.params;
  const orgId = req.user!.org_id;

  // Org-scope: result must belong to a patient in the doctor's org
  const [result] = await sql`
    SELECT ltr.result_id, ltr.flag, ltr.is_amended, ltr.acknowledged_at
    FROM   lab_test_results ltr
    JOIN   lab_tests lt ON lt.test_id = ltr.test_id
    JOIN   patients  p  ON p.patient_id = lt.patient_id
    WHERE  ltr.result_id = ${resultId}
      ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    LIMIT 1
  `;
  if (!result)                       return next(new AppError('ERROR_RESULT_NOT_FOUND', 404));
  if (!['CRITICAL', 'ABNORMAL'].includes(result.flag)) return next(new AppError('ERROR_NOT_FLAGGED', 400));
  if (result.is_amended)             return next(new AppError('ERROR_RESULT_AMENDED', 409));
  if (result.acknowledged_at)        return next(new AppError('ERROR_ALREADY_ACKNOWLEDGED', 409));

  const [updated] = await sql`
    UPDATE lab_test_results
    SET    acknowledged_at = NOW(), acknowledged_by = ${req.user!.user_id}
    WHERE  result_id = ${resultId}
    RETURNING result_id, flag, acknowledged_at
  `;

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULT_ACKNOWLEDGED',
    data: { result: updated },
  });
});
