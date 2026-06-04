import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

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
  symptoms: z.array(z.string()),
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
      p.patient_id,
      p.name,
      p.age,
      p.gender,
      p.created_at,
      ir.risk_level AS risk_status,
      ir.risk_score
    FROM patients p
    LEFT JOIN LATERAL (
      SELECT risk_level, risk_score FROM infection_risks
      WHERE patient_id = p.patient_id
      ORDER BY created_at DESC LIMIT 1
    ) ir ON TRUE
    WHERE p.deleted_at IS NULL
    ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    ORDER BY p.created_at DESC
  `;

  res.status(200).json({ status: 'success', data: { patients } });
});

export const getPatientById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;

  const [patient] = await sql`
    SELECT p.patient_id, p.name, p.age, p.gender, p.medical_history, p.created_at,
           ir.risk_level, ir.risk_score
    FROM patients p
    LEFT JOIN LATERAL (
      SELECT risk_level, risk_score FROM infection_risks
      WHERE patient_id = p.patient_id ORDER BY created_at DESC LIMIT 1
    ) ir ON TRUE
    WHERE p.patient_id = ${patientId} AND p.deleted_at IS NULL
    LIMIT 1
  `;

  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  const clinicalData = (await sql`
    SELECT data_id, vitals, symptoms, recorded_by, created_at
    FROM clinical_data WHERE patient_id = ${patientId} ORDER BY created_at DESC
  `).map(cd => {
    let vitals = cd.vitals;
    if (typeof vitals === 'string') { try { vitals = JSON.parse(vitals); } catch { vitals = {}; } }
    if (typeof vitals !== 'object' || vitals === null || Array.isArray(vitals)) vitals = {};
    let symptoms = cd.symptoms;
    if (typeof symptoms === 'string') { try { symptoms = JSON.parse(symptoms); } catch { symptoms = []; } }
    if (!Array.isArray(symptoms)) symptoms = [];
    return {
      ...cd,
      vitals,
      symptoms,
    };
  });

  const labTests = await sql`
    SELECT test_id, test_type, status, notes, ordered_at
    FROM lab_tests WHERE patient_id = ${patientId} AND deleted_at IS NULL ORDER BY ordered_at DESC
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
    VALUES (${val.data.name}, ${val.data.age}, ${val.data.gender}, ${JSON.stringify(val.data.medical_history ?? {})}, ${req.user!.org_id}, ${req.user!.user_id})
    RETURNING patient_id, name, age, gender, created_at
  `;

  res.status(201).json({ status: 'success', messageKey: 'SUCCESS_PATIENT_CREATED', data: { patient } });
});

// ─── Clinical Data ────────────────────────────────────────────────────────────

export const createClinicalData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = clinicalDataSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const [patient] = await sql`
    SELECT patient_id FROM patients WHERE patient_id = ${val.data.patient_id} AND deleted_at IS NULL
  `;
  if (!patient) return next(new AppError('ERROR_PATIENT_NOT_FOUND', 404));

  let [cd] = await sql`
    INSERT INTO clinical_data (patient_id, vitals, symptoms, recorded_by)
    VALUES (
      ${val.data.patient_id},
      ${JSON.stringify(val.data.vitals)},
      ${JSON.stringify(val.data.symptoms)},
      ${req.user!.user_id}
    )
    RETURNING data_id, patient_id, vitals, symptoms, created_at
  `;

  if (typeof cd.vitals === 'string') { try { cd.vitals = JSON.parse(cd.vitals); } catch { cd.vitals = {}; } }
  if (typeof cd.vitals !== 'object' || cd.vitals === null || Array.isArray(cd.vitals)) cd.vitals = {};
  if (typeof cd.symptoms === 'string') { try { cd.symptoms = JSON.parse(cd.symptoms); } catch { cd.symptoms = []; } }
  if (!Array.isArray(cd.symptoms)) cd.symptoms = [];

  res.status(201).json({ status: 'success', messageKey: 'SUCCESS_CLINICAL_DATA_SAVED', data: { clinicalData: cd } });
});

export const updateClinicalData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { dataId } = req.params;

  const updateSchema = z.object({
    vitals: z.object({
      temperature:              z.number().optional(),
      heart_rate:               z.number().optional(),
      blood_pressure_systolic:  z.number().optional(),
      blood_pressure_diastolic: z.number().optional(),
      spo2:                     z.number().optional(),
    }).optional(),
    symptoms: z.array(z.string()).optional(),
  });

  const val = updateSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const [existing] = await sql`
    SELECT data_id FROM clinical_data WHERE data_id = ${dataId}
  `;
  if (!existing) return next(new AppError('ERROR_CLINICAL_DATA_NOT_FOUND', 404));

  let [updated] = await sql`
    UPDATE clinical_data
    SET vitals   = ${JSON.stringify(val.data.vitals ?? {})},
        symptoms = ${JSON.stringify(val.data.symptoms ?? [])}
    WHERE data_id = ${dataId}
    RETURNING data_id, patient_id, vitals, symptoms, created_at
  `;

  if (typeof updated.vitals === 'string') { try { updated.vitals = JSON.parse(updated.vitals); } catch { updated.vitals = {}; } }
  if (typeof updated.vitals !== 'object' || updated.vitals === null || Array.isArray(updated.vitals)) updated.vitals = {};
  if (typeof updated.symptoms === 'string') { try { updated.symptoms = JSON.parse(updated.symptoms); } catch { updated.symptoms = []; } }
  if (!Array.isArray(updated.symptoms)) updated.symptoms = [];

  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_CLINICAL_DATA_UPDATED', data: { clinicalData: updated } });
});

export const deleteClinicalData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { dataId } = req.params;

  const [existing] = await sql`
    SELECT data_id FROM clinical_data WHERE data_id = ${dataId}
  `;
  if (!existing) return next(new AppError('ERROR_CLINICAL_DATA_NOT_FOUND', 404));

  await sql`
    DELETE FROM clinical_data WHERE data_id = ${dataId}
  `;

  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_CLINICAL_DATA_DELETED' });
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

  // Alert lab techs in same org
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

// ─── Predictions (Image 2 pipeline) ──────────────────────────────────────────

/**
 * POST /api/doctor/predictions
 *
 * Image 2 sequence:
 *   1. Fetch ClinicalData by patient_id
 *   2. Fetch LabTestResults by patient_id
 *   3. Send payload {clinical, lab, model_version} → AIService
 *   4. AIService runs Random Forest / XGBoost / NN
 *   5. Receive {risk_score, risk_level, confidence, raw_payload}
 *   6. INSERT PredictionResult
 *   7. INSERT FeatureExplanation rows (from raw_payload)
 *   8. INSERT InfectionRisk record
 *   9. INCREMENT predictions_used
 *  10. Return 201 {request_id, risk_level, confidence}
 *      + overage warning if isOverage (Image 1)
 */
export const createPrediction = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = predictionSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { patient_id, model_version } = val.data;
  const ctx = req.subscriptionCtx;

  // ── Step 1: Fetch ClinicalData by patient_id ────────────────────────────
  const [clinicalRecord] = await sql`
    SELECT data_id, vitals, symptoms
    FROM clinical_data
    WHERE patient_id = ${patient_id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  // Normalize JSONB for postgres.js v3 (returns strings instead of parsed objects)
  if (clinicalRecord) {
    try { if (typeof clinicalRecord.vitals === 'string') clinicalRecord.vitals = JSON.parse(clinicalRecord.vitals); } catch { clinicalRecord.vitals = null; }
    try { if (typeof clinicalRecord.symptoms === 'string') clinicalRecord.symptoms = JSON.parse(clinicalRecord.symptoms); } catch { clinicalRecord.symptoms = []; }
  }

  // ── Step 2: Fetch LabTestResults by patient_id ──────────────────────────
  const labResults = await sql`
    SELECT
      ltr.analyte_name,
      ltr.value,
      ltr.flag,
      ltr.reference_low,
      ltr.reference_high
    FROM lab_test_results ltr
    JOIN lab_tests lt ON lt.test_id = ltr.test_id
    WHERE lt.patient_id = ${patient_id}
      AND lt.status = 'COMPLETED'
      AND lt.deleted_at IS NULL
    ORDER BY ltr.created_at DESC
  `;

  // ── Step 3: Create pending request record ────────────────────────────────
  const [predRequest] = await sql`
    INSERT INTO prediction_requests (
      patient_id, clinical_data_id, requested_by, model_version, status
    )
    VALUES (
      ${patient_id},
      ${clinicalRecord?.data_id ?? null},
      ${req.user!.user_id},
      ${model_version},
      'PROCESSING'
    )
    RETURNING request_id
  `;

  // ── Step 3: Fake prediction result ────────────────────────────────────────
  const symptomCount = clinicalRecord?.symptoms?.length ?? 0;
  const labAbnormal  = labResults.filter(r => r.flag === 'ABNORMAL' || r.flag === 'CRITICAL').length;
  const riskScore    = Math.min(0.15 + labAbnormal * 0.12 + symptomCount * 0.07, 0.98);
  const riskLevel    = riskScore >= 0.85 ? 'CRITICAL' : riskScore >= 0.60 ? 'HIGH' : riskScore >= 0.35 ? 'MODERATE' : 'LOW';

  const features: { feature_name: string; contribution: number; direction: 'POSITIVE' | 'NEGATIVE'; rank: number }[] = [
    ...labResults.map((r, i) => ({
      feature_name: r.analyte_name,
      contribution: r.flag === 'CRITICAL' ? 0.28 : r.flag === 'ABNORMAL' ? 0.12 : 0.02,
      direction:    (r.flag !== 'NORMAL' ? 'POSITIVE' : 'NEGATIVE') as 'POSITIVE' | 'NEGATIVE',
      rank:         i + 1,
    })),
    ...(clinicalRecord?.symptoms ?? []).map((s: string, i: number) => ({
      feature_name: `Symptom: ${s}`,
      contribution: 0.07,
      direction:    'POSITIVE' as 'POSITIVE' | 'NEGATIVE',
      rank:         labResults.length + i + 1,
    })),
  ];

  if (features.length === 0) {
    features.push(
      { feature_name: 'No clinical data', contribution: 0.10, direction: 'POSITIVE', rank: 1 },
      { feature_name: 'No lab results',   contribution: 0.05, direction: 'NEGATIVE', rank: 2 },
    );
  }

  const risk_score           = Math.round(riskScore * 1000) / 1000;
  const risk_level           = riskLevel;
  const confidence           = Math.round((0.75 + Math.random() * 0.2) * 1000) / 1000;
  const raw_payload          = { model: 'mock', model_version, features };
  const feature_explanations = features;

  // ── Step 6: INSERT PredictionResult ─────────────────────────────────────
  const [predResult] = await sql`
    INSERT INTO prediction_results (request_id, risk_score, risk_level, confidence, raw_payload)
    VALUES (${predRequest.request_id}, ${risk_score}, ${risk_level}, ${confidence}, ${JSON.stringify(raw_payload)})
    RETURNING result_id
  `;

  // ── Step 7: INSERT FeatureExplanation rows (from raw_payload) ────────────
  for (const fe of feature_explanations) {
    await sql`
      INSERT INTO feature_explanations (result_id, feature_name, contribution, direction, rank)
      VALUES (
        ${predResult.result_id},
        ${fe.feature_name},
        ${fe.contribution},
        ${fe.direction},
        ${fe.rank}
      )
    `;
  }

  // ── Step 8: INSERT InfectionRisk record ──────────────────────────────────
  await sql`
    INSERT INTO infection_risks (patient_id, risk_score, risk_level, model_version, message)
    VALUES (
      ${patient_id},
      ${risk_score},
      ${risk_level},
      ${model_version},
      ${`AI prediction: ${risk_level} infection risk (confidence ${Math.round(confidence * 100)}%)`}
    )
  `;

  // ── Step 9: UPDATE request status + INCREMENT predictions_used ───────────
  await sql`
    UPDATE prediction_requests SET status = 'COMPLETED'
    WHERE request_id = ${predRequest.request_id}
  `;

  if (ctx?.usage_id) {
    await sql`
      UPDATE usage_records
      SET prediction_used = prediction_used + 1
      WHERE usage_id = ${ctx.usage_id}
    `;
  }

  // ── Step 10: Return 201 {request_id, risk_level, confidence} ─────────────
  // Image 1: if isOverage → include overage_warning in response
  res.status(201).json({
    status: 'success',
    messageKey: ctx?.isOverage ? 'SUCCESS_PREDICTION_OVERAGE' : 'SUCCESS_PREDICTION_REQUESTED',
    data: {
      predictionRequest: {
        request_id:    predRequest.request_id,
        risk_level,
        risk_score,
        confidence,
        model_version,
      },
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
      pr.request_id,
      pr.patient_id,
      p.name  AS patient_name,
      pr.model_version,
      pr.status,
      pr.created_at,
      pres.risk_score,
      pres.risk_level,
      pres.confidence
    FROM prediction_requests pr
    JOIN patients p ON p.patient_id = pr.patient_id
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
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
    LEFT JOIN feature_explanations fe ON fe.result_id = pres.result_id
    WHERE pr.request_id = ${predictionId}
    GROUP BY pr.request_id, p.name, pres.result_id
    LIMIT 1
  `;

  if (!prediction) return next(new AppError('ERROR_PREDICTION_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { prediction } });
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const getAlerts = catchAsync(async (req: Request, res: Response) => {
  const alerts = await sql`
    SELECT
      a.alert_id, a.patient_id, pat.name AS patient_name,
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

// GET /api/doctor/lab-results/:testId
// Returns all analyte results for a completed test, scoped to the doctor's org.
// Shows both active and amended rows so the doctor can see correction history.
export const getLabTestResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;
  const orgId = req.user!.org_id;

  // Verify the test belongs to this organisation
  const [test] = await sql`
    SELECT lt.test_id, lt.test_type, lt.status,
           pat.name AS patient_name, pat.age, pat.gender
    FROM   lab_tests lt
    JOIN   patients pat ON pat.patient_id = lt.patient_id
    WHERE  lt.test_id = ${testId}
      AND  lt.deleted_at IS NULL
      ${orgId ? sql`AND lt.requested_by IN (
           SELECT user_id FROM users
           WHERE  organization_id = ${orgId} AND deleted_at IS NULL
         )` : sql``}
    LIMIT 1
  `;

  if (!test) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  const results = await sql`
    SELECT
      ltr.result_id,
      ltr.analyte_name,
      ltr.value,
      ltr.reference_low,
      ltr.reference_high,
      ltr.flag,
      ltr.sub_panel,
      ltr.is_amended,
      ltr.original_result_id,
      ltr.acknowledged_at,
      ltr.acknowledged_by,
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

// PATCH /api/doctor/lab-results/:resultId/acknowledge
// The doctor confirms they have received and acted on a CRITICAL result.
// Only CRITICAL, non-amended, not-yet-acknowledged results are accepted.
export const acknowledgeResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { resultId } = req.params;

  const [result] = await sql`
    SELECT result_id, flag, is_amended, acknowledged_at
    FROM   lab_test_results
    WHERE  result_id = ${resultId}
    LIMIT  1
  `;

  if (!result)                 return next(new AppError('ERROR_RESULT_NOT_FOUND', 404));
  if (result.flag !== 'CRITICAL')   return next(new AppError('ERROR_NOT_CRITICAL', 400));
  if (result.is_amended)            return next(new AppError('ERROR_RESULT_AMENDED', 409));
  if (result.acknowledged_at)       return next(new AppError('ERROR_ALREADY_ACKNOWLEDGED', 409));

  const [updated] = await sql`
    UPDATE lab_test_results
    SET    acknowledged_at = NOW(),
           acknowledged_by = ${req.user!.user_id}
    WHERE  result_id = ${resultId}
    RETURNING result_id, flag, acknowledged_at
  `;

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULT_ACKNOWLEDGED',
    data: { result: updated },
  });
});

