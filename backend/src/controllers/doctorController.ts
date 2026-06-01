import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { runPrediction } from '../services/aiService.js';

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
    ${orgId ? sql`AND p.patient_id IN (
        SELECT DISTINCT patient_id FROM prediction_requests pr
        JOIN users u ON u.user_id = pr.requested_by
        WHERE u.organization_id = ${orgId}
      )` : sql``}
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

  const clinicalData = await sql`
    SELECT data_id, vitals, symptoms, recorded_by, created_at
    FROM clinical_data WHERE patient_id = ${patientId} ORDER BY created_at DESC
  `;

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
    INSERT INTO patients (name, age, gender, medical_history)
    VALUES (${val.data.name}, ${val.data.age}, ${val.data.gender}, ${JSON.stringify(val.data.medical_history ?? {})})
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

  const [cd] = await sql`
    INSERT INTO clinical_data (patient_id, vitals, symptoms, recorded_by)
    VALUES (
      ${val.data.patient_id},
      ${JSON.stringify(val.data.vitals)},
      ${JSON.stringify(val.data.symptoms)},
      ${req.user!.user_id}
    )
    RETURNING data_id, patient_id, vitals, symptoms, created_at
  `;

  res.status(201).json({ status: 'success', messageKey: 'SUCCESS_CLINICAL_DATA_SAVED', data: { clinicalData: cd } });
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

  // ── Step 3: Send payload {clinical, lab, model_version} → AIService ──────
  let aiResult;
  try {
    aiResult = await runPrediction({
      clinical:      clinicalRecord
        ? { vitals: clinicalRecord.vitals, symptoms: clinicalRecord.symptoms }
        : null,
      lab:labResults,
      model_version,
    });
  } catch (err) {
    // Mark request as FAILED then propagate
    await sql`
      UPDATE prediction_requests SET status = 'FAILED'
      WHERE request_id = ${predRequest.request_id}
    `;
    return next(new AppError('ERROR_AI_SERVICE_UNAVAILABLE', 503));
  }

  const { risk_score, risk_level, confidence, raw_payload, feature_explanations } = aiResult;

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
