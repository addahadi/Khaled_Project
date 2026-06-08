import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

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

/** Org-scope subquery: patient must belong to the requesting doctor's org. */
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
  patient_id: z.string().uuid({ message: 'ERR_PATIENT_INVALID' }),
  test_type:  z.string().min(2, { message: 'ERR_TEST_TYPE_REQUIRED' }),
  notes:      z.string().optional(),
});

const predictionSchema = z.object({
  patient_id:    z.string().uuid({ message: 'ERR_PATIENT_INVALID' }),
  model_version: z.string().default('v2.3.1'),
});

// ─── Patients ─────────────────────────────────────────────────────────────────

export const getPatients = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;

  const patients = await sql`
    SELECT
      p.patient_id, p.name, p.age, p.gender, p.created_at,
      ir.risk_level AS risk_status, ir.risk_score,
      -- Latest clinical record staleness hint for patient list
      CASE
        WHEN cd.created_at IS NULL THEN 'NO_DATA'
        WHEN COALESCE(cd.recorded_at, cd.created_at) < NOW() - INTERVAL '72 hours' THEN 'STALE'
        ELSE 'FRESH'
      END AS clinical_data_status
    FROM patients p
    LEFT JOIN LATERAL (
      SELECT risk_level, risk_score FROM infection_risks
      WHERE patient_id = p.patient_id ORDER BY created_at DESC LIMIT 1
    ) ir ON TRUE
    LEFT JOIN LATERAL (
      SELECT created_at, recorded_at FROM clinical_data
      WHERE patient_id = p.patient_id AND deleted_at IS NULL
      ORDER BY COALESCE(recorded_at, created_at) DESC LIMIT 1
    ) cd ON TRUE
    WHERE p.deleted_at IS NULL
    ${patientOrgFilter(orgId)}
    ORDER BY p.created_at DESC
  `;

  res.status(200).json({ status: 'success', data: { patients } });
});

export const getPatientById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;
  const orgId = req.user!.org_id;

  const [patient] = await sql`
    SELECT p.patient_id, p.name, p.age, p.gender, p.medical_history, p.created_at,
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

  // All active clinical records, newest first, with staleness + prediction link count
  const clinicalData = (await sql`
    SELECT
      cd.data_id,
      cd.vitals,
      cd.symptoms,
      cd.recorded_at,
      cd.visit_date,
      cd.created_at,
      cd.recorded_by,
      -- Staleness: observation > 72h ago?
      (COALESCE(cd.recorded_at, cd.created_at) < NOW() - INTERVAL '72 hours') AS is_stale,
      -- How many COMPLETED predictions used this snapshot?
      (
        SELECT COUNT(*) FROM prediction_requests pr
        WHERE pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED'
      ) AS linked_prediction_count
    FROM clinical_data cd
    WHERE cd.patient_id = ${patientId}
      AND cd.deleted_at IS NULL
    ORDER BY COALESCE(cd.recorded_at, cd.created_at) DESC
  `).map(normalizeCd);

  const labTests = await sql`
    SELECT test_id, test_type, status, notes, ordered_at
    FROM lab_tests WHERE patient_id = ${patientId} AND deleted_at IS NULL
    ORDER BY ordered_at DESC
  `;

  res.status(200).json({
    status: 'success',
    data: { patient: { ...patient, clinicalData, labTests } },
  });
});

export const createPatient = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = patientSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const [patient] = await sql`
    INSERT INTO patients (name, age, gender, medical_history, organization_id, created_by)
    VALUES (
      ${val.data.name}, ${val.data.age}, ${val.data.gender},
      ${JSON.stringify(val.data.medical_history ?? {})}::jsonb,
      ${req.user!.org_id}, ${req.user!.user_id}
    )
    RETURNING patient_id, name, age, gender, created_at
  `;

  res.status(201).json({ status: 'success', messageKey: 'SUCCESS_PATIENT_CREATED', data: { patient } });
});

// ─── Clinical Data ────────────────────────────────────────────────────────────

// GET /api/doctor/clinical-data/patient/:patientId   (paginated history)
export const getClinicalDataHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;
  const orgId  = req.user!.org_id;
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit  = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '10'), 10)));
  const offset = (page - 1) * limit;

  // Org-scope guard
  const [patient] = await sql`
    SELECT patient_id FROM patients p
    WHERE p.patient_id = ${patientId}
      AND p.deleted_at IS NULL
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
        WHERE pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED'
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

  // Org-scope: patient must belong to doctor's org
  const [patient] = await sql`
    SELECT patient_id FROM patients p
    WHERE p.patient_id = ${patient_id}
      AND p.deleted_at IS NULL
      ${patientOrgFilter(orgId)}
    LIMIT 1
  `;
  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  // Duplicate guard: same doctor, same patient, within the last 30 min
  const [recent] = await sql`
    SELECT data_id FROM clinical_data
    WHERE patient_id  = ${patient_id}
      AND recorded_by = ${req.user!.user_id}
      AND COALESCE(recorded_at, created_at) > NOW() - INTERVAL '30 minutes'
      AND deleted_at IS NULL
    LIMIT 1
  `;
  if (recent) return next(new AppError('ERROR_CLINICAL_DATA_DUPLICATE', 409));

  const observedAt  = recorded_at ?? null;
  const visitDay    = visit_date  ?? null;

  let [cd] = await sql`
    INSERT INTO clinical_data (patient_id, vitals, symptoms, recorded_by, recorded_at, visit_date)
    VALUES (
      ${patient_id},
      ${JSON.stringify(vitals)}::jsonb,
      ${JSON.stringify(symptoms)}::jsonb,
      ${req.user!.user_id},
      ${observedAt},
      ${visitDay}
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

  // Org-scope + existence check
  const [existing] = await sql`
    SELECT cd.data_id, cd.patient_id,
      (SELECT COUNT(*) FROM prediction_requests pr
       WHERE pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED') AS linked_count
    FROM clinical_data cd
    JOIN patients p ON p.patient_id = cd.patient_id
    WHERE cd.data_id    = ${dataId}
      AND cd.deleted_at IS NULL
      ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    LIMIT 1
  `;
  if (!existing) return next(new AppError('ERROR_CLINICAL_DATA_NOT_FOUND', 404));

  // Warn if this snapshot was used by completed predictions (still allow edit — doctors may correct typos)
  const isLinked = Number(existing.linked_count) > 0;

  // ── JSONB merge for vitals (partial update), full replace for symptoms ──
  // When a field is not provided we SET it to itself (no-op), avoiding overwrite.
  const vitalsJson   = val.data.vitals    !== undefined ? JSON.stringify(val.data.vitals)   : null;
  const symptomsJson = val.data.symptoms  !== undefined ? JSON.stringify(val.data.symptoms) : null;

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
    SELECT cd.data_id,
      (SELECT COUNT(*) FROM prediction_requests pr
       WHERE pr.clinical_data_id = cd.data_id AND pr.status = 'COMPLETED') AS linked_count
    FROM clinical_data cd
    JOIN patients p ON p.patient_id = cd.patient_id
    WHERE cd.data_id    = ${dataId}
      AND cd.deleted_at IS NULL
      ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    LIMIT 1
  `;
  if (!existing) return next(new AppError('ERROR_CLINICAL_DATA_NOT_FOUND', 404));

  // Soft delete — preserves the snapshot for historical predictions
  await sql`
    UPDATE clinical_data SET deleted_at = NOW() WHERE data_id = ${dataId}
  `;

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

export const createLabOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = labOrderSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { patient_id, test_type, notes } = val.data;

  const [test] = await sql`
    INSERT INTO lab_tests (patient_id, test_type, requested_by, notes, status)
    VALUES (${patient_id}, ${test_type}, ${req.user!.user_id}, ${notes ?? null}, 'PENDING')
    RETURNING test_id, patient_id, test_type, status, ordered_at
  `;

  if (req.user?.org_id) {
    const techs = await sql`
      SELECT u.user_id FROM users u
      JOIN lab_technicians lt ON lt.user_id = u.user_id
      WHERE u.organization_id = ${req.user.org_id} AND u.deleted_at IS NULL
    `;
    for (const tech of techs) {
      await sql`
        INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
        VALUES (${patient_id}, ${tech.user_id}, 'NEW_LAB_ORDER', ${'New lab order: ' + test_type})
      `;
    }
  }

  res.status(201).json({ status: 'success', messageKey: 'SUCCESS_LAB_ORDER_CREATED', data: { labTest: test } });
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

  // ── Step 1: Latest ACTIVE clinical record ────────────────────────────────
  const [rawClinical] = await sql`
    SELECT data_id, vitals, symptoms, recorded_at, created_at
    FROM clinical_data
    WHERE patient_id = ${patient_id}
      AND deleted_at IS NULL
    ORDER BY COALESCE(recorded_at, created_at) DESC
    LIMIT 1
  `;

  const clinicalRecord = rawClinical ? normalizeCd(rawClinical as Record<string, unknown>) : null;

  // ── Step 2: Recent lab results (last LAB_RECENCY_DAYS days only) ─────────
  const labResults = await sql`
    SELECT ltr.analyte_name, ltr.value, ltr.flag, ltr.reference_low, ltr.reference_high
    FROM lab_test_results ltr
    JOIN lab_tests lt ON lt.test_id = ltr.test_id
    WHERE lt.patient_id  = ${patient_id}
      AND lt.status      = 'COMPLETED'
      AND lt.deleted_at  IS NULL
      AND ltr.is_amended = FALSE
      AND lt.updated_at  >= NOW() - INTERVAL '90 days'
    ORDER BY ltr.created_at DESC
  `;

  // Fallback: if no recent results, check if there are older ones
  const hasAnyLabResults = labResults.length === 0
    ? (await sql`
        SELECT COUNT(*) AS c FROM lab_test_results ltr
        JOIN lab_tests lt ON lt.test_id = ltr.test_id
        WHERE lt.patient_id = ${patient_id} AND lt.status = 'COMPLETED' AND lt.deleted_at IS NULL
      `)[0]?.c > 0
    : true;

  // ── Build data_warnings ───────────────────────────────────────────────────
  type WarnType = 'NO_CLINICAL_DATA' | 'STALE_CLINICAL_DATA' | 'NO_LAB_RESULTS' | 'NO_RECENT_LAB_RESULTS';
  const dataWarnings: Array<{ type: WarnType; message: string }> = [];

  let clinicalDataStale = false;

  if (!clinicalRecord) {
    dataWarnings.push({
      type: 'NO_CLINICAL_DATA',
      message: 'No clinical data found. Prediction accuracy will be reduced.',
    });
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
        message: `Clinical data is ${hoursAgo}h old (threshold: 72h). Consider recording a fresh observation before running this prediction.`,
      });
    }
  }

  if (labResults.length === 0) {
    if (hasAnyLabResults) {
      dataWarnings.push({
        type: 'NO_RECENT_LAB_RESULTS',
        message: `No lab results found within the last ${LAB_RECENCY_DAYS} days. Older results were excluded to avoid stale data influence.`,
      });
    } else {
      dataWarnings.push({
        type: 'NO_LAB_RESULTS',
        message: 'No completed lab results found for this patient.',
      });
    }
  }

  // ── Step 3: Create pending request record ────────────────────────────────
  const [predRequest] = await sql`
    INSERT INTO prediction_requests (
      patient_id, clinical_data_id, requested_by, model_version, status
    )
    VALUES (
      ${patient_id},
      ${clinicalRecord ? (clinicalRecord as Record<string, unknown>)['data_id'] as string : null},
      ${req.user!.user_id},
      ${model_version},
      'PROCESSING'
    )
    RETURNING request_id
  `;

  // ── Step 4: Mock prediction (pending real ML integration) ────────────────
  const symptomCount = (clinicalRecord?.symptoms as string[] | null)?.length ?? 0;
  const labAbnormal  = labResults.filter((r: Record<string, unknown>) =>
    r.flag === 'ABNORMAL' || r.flag === 'CRITICAL').length;
  const riskScore    = Math.min(0.15 + labAbnormal * 0.12 + symptomCount * 0.07, 0.98);
  const riskLevel    = riskScore >= 0.85 ? 'CRITICAL'
                     : riskScore >= 0.60 ? 'HIGH'
                     : riskScore >= 0.35 ? 'MODERATE'
                     : 'LOW';

  const features: Array<{
    feature_name: string; contribution: number;
    direction: 'POSITIVE' | 'NEGATIVE'; rank: number;
  }> = [
    ...(labResults as Array<Record<string, unknown>>).map((r, i) => ({
      feature_name: String(r.analyte_name),
      contribution: r.flag === 'CRITICAL' ? 0.28 : r.flag === 'ABNORMAL' ? 0.12 : 0.02,
      direction:    (r.flag !== 'NORMAL' ? 'POSITIVE' : 'NEGATIVE') as 'POSITIVE' | 'NEGATIVE',
      rank:         i + 1,
    })),
    ...((clinicalRecord?.symptoms as string[]) ?? []).map((s: string, i: number) => ({
      feature_name: `Symptom: ${s}`,
      contribution: 0.07,
      direction:    'POSITIVE' as const,
      rank:         labResults.length + i + 1,
    })),
  ];

  if (features.length === 0) {
    features.push(
      { feature_name: 'No clinical data', contribution: 0.10, direction: 'POSITIVE', rank: 1 },
      { feature_name: 'No lab results',   contribution: 0.05, direction: 'NEGATIVE', rank: 2 },
    );
  }

  const risk_score  = Math.round(riskScore * 1000) / 1000;
  // Deterministic confidence: based on data completeness rather than Math.random()
  const dataScore   = (clinicalRecord ? 0.5 : 0) + (labResults.length > 0 ? 0.3 : 0) +
                      (!clinicalDataStale ? 0.2 : 0);
  const confidence  = Math.round((0.55 + dataScore * 0.4) * 1000) / 1000;
  const raw_payload = { model: 'mock', model_version, features };

  // ── Step 5: INSERT PredictionResult ─────────────────────────────────────
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

  if (ctx?.usage_id) {
    await sql`UPDATE usage_records SET prediction_used = prediction_used + 1 WHERE usage_id = ${ctx.usage_id}`;
  }

  res.status(201).json({
    status: 'success',
    messageKey: ctx?.isOverage ? 'SUCCESS_PREDICTION_OVERAGE' : 'SUCCESS_PREDICTION_REQUESTED',
    data: {
      predictionRequest: {
        request_id: predRequest.request_id,
        risk_level: riskLevel,
        risk_score,
        confidence,
        model_version,
      },
      // Surface data quality flags so the UI can show contextual warnings
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

export const getPredictions = catchAsync(async (req: Request, res: Response) => {
  const predictions = await sql`
    SELECT
      pr.request_id, pr.patient_id, p.name AS patient_name,
      pr.model_version, pr.status, pr.created_at,
      pres.risk_score, pres.risk_level, pres.confidence,
      -- Was the clinical snapshot stale when prediction was run?
      (
        cd.data_id IS NULL
        OR COALESCE(cd.recorded_at, cd.created_at) < pr.created_at - INTERVAL '72 hours'
      ) AS clinical_data_stale
    FROM prediction_requests pr
    JOIN patients p ON p.patient_id = pr.patient_id
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    LEFT JOIN clinical_data cd ON cd.data_id = pr.clinical_data_id
    WHERE pr.requested_by = ${req.user!.user_id}
    ORDER BY pr.created_at DESC
  `;

  res.status(200).json({ status: 'success', data: { predictions } });
});

export const getPredictionById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { predictionId } = req.params;

  const [prediction] = await sql`
    SELECT
      pr.request_id, pr.patient_id, p.name AS patient_name,
      pr.model_version, pr.status, pr.created_at,
      pres.result_id, pres.risk_score, pres.risk_level, pres.confidence, pres.raw_payload,
      -- Clinical data snapshot metadata
      cd.data_id         AS clinical_data_id,
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
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    LEFT JOIN clinical_data cd ON cd.data_id = pr.clinical_data_id
    LEFT JOIN feature_explanations fe ON fe.result_id = pres.result_id
    WHERE pr.request_id = ${predictionId}
    GROUP BY pr.request_id, p.name, pres.result_id, cd.data_id
    LIMIT 1
  `;

  if (!prediction) return next(new AppError('ERROR_PREDICTION_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { prediction } });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const getAlerts = catchAsync(async (req: Request, res: Response) => {
  const alerts = await sql`
    SELECT a.alert_id, a.patient_id, pat.name AS patient_name,
           a.alert_type, a.message, a.is_read, a.read_at, a.created_at
    FROM alerts a
    LEFT JOIN patients pat ON pat.patient_id = a.patient_id
    WHERE a.recipient_id = ${req.user!.user_id}
    ORDER BY a.created_at DESC
    LIMIT 50
  `;
  res.status(200).json({ status: 'success', data: { alerts } });
});

export const markAlertRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { alertId } = req.params;
  const [alert] = await sql`
    UPDATE alerts SET is_read = TRUE, read_at = NOW()
    WHERE alert_id = ${alertId} AND recipient_id = ${req.user!.user_id}
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
    FROM lab_tests lt
    JOIN patients pat ON pat.patient_id = lt.patient_id
    WHERE lt.test_id    = ${testId}
      AND lt.deleted_at IS NULL
      ${orgId ? sql`AND lt.requested_by IN (
           SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL
         )` : sql``}
    LIMIT 1
  `;
  if (!test) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  const results = await sql`
    SELECT ltr.result_id, ltr.analyte_name, ltr.value,
           ltr.reference_low, ltr.reference_high, ltr.flag,
           ltr.sub_panel, ltr.is_amended, ltr.original_result_id,
           ltr.acknowledged_at, ltr.acknowledged_by,
           un.symbol AS unit_symbol,
           u.username AS acknowledged_by_name,
           ltr.created_at
    FROM lab_test_results ltr
    LEFT JOIN units un ON un.unit_id = ltr.unit_id
    LEFT JOIN users u  ON u.user_id  = ltr.acknowledged_by
    WHERE ltr.test_id = ${testId}
    ORDER BY ltr.sub_panel NULLS LAST, ltr.created_at ASC
  `;

  res.status(200).json({ status: 'success', data: { test, results } });
});

export const acknowledgeResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { resultId } = req.params;

  const [result] = await sql`
    SELECT result_id, flag, is_amended, acknowledged_at FROM lab_test_results
    WHERE result_id = ${resultId} LIMIT 1
  `;
  if (!result)               return next(new AppError('ERROR_RESULT_NOT_FOUND', 404));
  if (result.flag !== 'CRITICAL')  return next(new AppError('ERROR_NOT_CRITICAL', 400));
  if (result.is_amended)           return next(new AppError('ERROR_RESULT_AMENDED', 409));
  if (result.acknowledged_at)      return next(new AppError('ERROR_ALREADY_ACKNOWLEDGED', 409));

  const [updated] = await sql`
    UPDATE lab_test_results
    SET acknowledged_at = NOW(), acknowledged_by = ${req.user!.user_id}
    WHERE result_id = ${resultId}
    RETURNING result_id, flag, acknowledged_at
  `;

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULT_ACKNOWLEDGED',
    data: { result: updated },
  });
});
