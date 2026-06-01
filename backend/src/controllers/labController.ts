import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const resultSchema = z.object({
  test_id: z.string().uuid({ message: 'ERR_TEST_INVALID' }),
  results: z.array(
    z.object({
      analyte_name:    z.string().min(1, { message: 'ERR_ANALYTE_REQUIRED' }),
      value:           z.string().min(1, { message: 'ERR_VALUE_REQUIRED' }),
      unit_id:         z.string().uuid().optional(),
      reference_low:   z.number().optional(),
      reference_high:  z.number().optional(),
      flag:            z.enum(['NORMAL', 'ABNORMAL', 'CRITICAL'], { message: 'ERR_FLAG_INVALID' }),
    })
  ).min(1, { message: 'ERR_RESULTS_REQUIRED' }),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

// GET /api/lab/orders  — all pending/in-progress orders for the org
export const getLabOrders = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;

  const orders = await sql`
    SELECT
      lt.test_id,
      lt.test_type,
      lt.status,
      lt.notes,
      lt.ordered_at,
      pat.patient_id,
      pat.name  AS patient_name,
      pat.age,
      pat.gender,
      u.username AS ordered_by_name
    FROM lab_tests lt
    JOIN patients pat ON pat.patient_id = lt.patient_id
    LEFT JOIN users u ON u.user_id = lt.requested_by
    WHERE lt.deleted_at IS NULL
    ${orgId ? sql`AND lt.requested_by IN (
        SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL
      )` : sql``}
    ORDER BY
      CASE lt.status
        WHEN 'INPROGRESS' THEN 1
        WHEN 'PENDING'    THEN 2
        WHEN 'COMPLETED'  THEN 3
        ELSE 4
      END,
      lt.ordered_at ASC
  `;

  res.status(200).json({ status: 'success', data: { orders } });
});

// GET /api/lab/orders/:testId  — order detail with any existing results
export const getLabOrderById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;

  const [order] = await sql`
    SELECT
      lt.test_id,
      lt.test_type,
      lt.status,
      lt.notes,
      lt.ordered_at,
      pat.patient_id,
      pat.name  AS patient_name,
      pat.age,
      pat.gender,
      pat.medical_history,
      u.username AS ordered_by_name
    FROM lab_tests lt
    JOIN patients pat ON pat.patient_id = lt.patient_id
    LEFT JOIN users u ON u.user_id = lt.requested_by
    WHERE lt.test_id = ${testId}
      AND lt.deleted_at IS NULL
    LIMIT 1
  `;

  if (!order) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  const results = await sql`
    SELECT
      ltr.result_id,
      ltr.analyte_name,
      ltr.value,
      ltr.reference_low,
      ltr.reference_high,
      ltr.flag,
      un.symbol AS unit_symbol,
      ltr.created_at
    FROM lab_test_results ltr
    LEFT JOIN units un ON un.unit_id = ltr.unit_id
    WHERE ltr.test_id = ${testId}
    ORDER BY ltr.created_at ASC
  `;

  res.status(200).json({ status: 'success', data: { order: { ...order, results } } });
});

// PATCH /api/lab/orders/:testId/start  — mark order as IN PROGRESS
export const startOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;

  const [order] = await sql`
    UPDATE lab_tests
    SET status = 'INPROGRESS'
    WHERE test_id = ${testId}
      AND status = 'PENDING'
      AND deleted_at IS NULL
    RETURNING test_id, status
  `;

  if (!order) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_ORDER_STARTED',
    data: { order },
  });
});

// POST /api/lab/results  — submit results for a test order
export const enterResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = resultSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { test_id, results } = val.data;

  // Verify test exists and get patient_id
  const [test] = await sql`
    SELECT test_id, patient_id, requested_by
    FROM lab_tests
    WHERE test_id = ${test_id} AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!test) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  // Get technician_id for entered_by
  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians
    WHERE user_id = ${req.user!.user_id}
    LIMIT 1
  `;

  // Insert each result row
  const insertedResults = [];
  for (const r of results) {
    const [inserted] = await sql`
      INSERT INTO lab_test_results (
        test_id, analyte_name, value, unit_id,
        reference_low, reference_high, flag, entered_by
      )
      VALUES (
        ${test_id},
        ${r.analyte_name},
        ${r.value},
        ${r.unit_id ?? null},
        ${r.reference_low ?? null},
        ${r.reference_high ?? null},
        ${r.flag},
        ${tech?.technician_id ?? null}
      )
      RETURNING result_id, analyte_name, value, flag
    `;
    insertedResults.push(inserted);
  }

  // Mark test as COMPLETED
  await sql`
    UPDATE lab_tests SET status = 'COMPLETED'
    WHERE test_id = ${test_id}
  `;

  // Alert the requesting doctor
  if (test.requested_by) {
    const hasCritical = results.some(r => r.flag === 'CRITICAL');
    const hasAbnormal = results.some(r => r.flag === 'ABNORMAL');
    const alertType = hasCritical ? 'CRITICAL_RESULT' : hasAbnormal ? 'ABNORMAL_RESULT' : 'RESULT_READY';
    const message = hasCritical
      ? 'Critical lab result entered — immediate review required.'
      : hasAbnormal
      ? 'Abnormal lab result entered — review recommended.'
      : 'Lab results are ready for review.';

    await sql`
      INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
      VALUES (${test.patient_id}, ${test.requested_by}, ${alertType}, ${message})
    `;
  }

  // Update infection risk if flagged results
  const hasCriticalResult = results.some(r => r.flag === 'CRITICAL');
  const hasAbnormalResult = results.some(r => r.flag === 'ABNORMAL');
  if (hasCriticalResult || hasAbnormalResult) {
    const riskLevel = hasCriticalResult ? 'CRITICAL' : 'HIGH';
    const riskScore = hasCriticalResult ? 0.9 : 0.65;
    await sql`
      INSERT INTO infection_risks (patient_id, risk_score, risk_level, message, model_version)
      VALUES (
        ${test.patient_id},
        ${riskScore},
        ${riskLevel},
        ${'Risk inferred from lab results'},
        ${'rule-engine-v1'}
      )
    `;
  }

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULTS_ENTERED',
    data: { results: insertedResults },
  });
});

// GET /api/lab/stats  — dashboard stats for lab tech
export const getLabStats = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;

  const orgFilter = orgId
    ? sql`AND lt.requested_by IN (SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL)`
    : sql``;

  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE lt.status = 'PENDING')    AS pending_count,
      COUNT(*) FILTER (WHERE lt.status = 'INPROGRESS') AS inprogress_count,
      COUNT(*) FILTER (WHERE lt.status = 'COMPLETED'
        AND lt.updated_at::DATE = NOW()::DATE)          AS completed_today,
      COUNT(*) FILTER (WHERE lt.status = 'COMPLETED')  AS total_completed
    FROM lab_tests lt
    WHERE lt.deleted_at IS NULL
    ${orgFilter}
  `;

  res.status(200).json({ status: 'success', data: { stats } });
});
