import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// ─── Flag computation (server-side) ─────────────────────────────────────────
//
// When both reference bounds and a numeric value are present, the server
// derives the flag — the client's flag field is ignored.
//
// Thresholds:
//   NORMAL   : refLow  ≤ value ≤ refHigh
//   ABNORMAL : outside range but within 30 % of the range width
//   CRITICAL : more than 30 % beyond either boundary  (panic-value heuristic)
//
// When no reference range is provided (qualitative results), the client's
// fallback_flag is used. Defaults to NORMAL if nothing is supplied.
// ─────────────────────────────────────────────────────────────────────────────
function computeFlag(
  value: string,
  refLow:  number | null | undefined,
  refHigh: number | null | undefined,
  clientFallback?: string | null,
): 'NORMAL' | 'ABNORMAL' | 'CRITICAL' {
  const num = parseFloat(value);

  if (!isNaN(num) && refLow != null && refHigh != null) {
    if (num >= refLow && num <= refHigh) return 'NORMAL';
    // Critical margin = 30 % of the reference range width (minimum 0.001 to avoid div-by-zero)
    const margin = Math.max((refHigh - refLow) * 0.3, 0.001);
    if (num < refLow - margin || num > refHigh + margin) return 'CRITICAL';
    return 'ABNORMAL';
  }

  // Qualitative / no reference range — honour client flag
  if (clientFallback === 'CRITICAL') return 'CRITICAL';
  if (clientFallback === 'ABNORMAL') return 'ABNORMAL';
  return 'NORMAL';
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const resultRowSchema = z.object({
  analyte_name:   z.string().min(1, { message: 'ERR_ANALYTE_REQUIRED' }),
  value:          z.string().min(1, { message: 'ERR_VALUE_REQUIRED' }),
  unit_id:        z.string().uuid().optional(),
  reference_low:  z.number().optional(),
  reference_high: z.number().optional(),
  sub_panel:      z.string().optional(),
  // flag is NOT used for computation — the server derives it from the reference range.
  // It is accepted here only as a fallback for qualitative results (no numeric range).
  fallback_flag:  z.enum(['NORMAL', 'ABNORMAL', 'CRITICAL']).optional(),
});

const resultSchema = z.object({
  test_id: z.string().uuid({ message: 'ERR_TEST_INVALID' }),
  results: z.array(resultRowSchema).min(1, { message: 'ERR_RESULTS_REQUIRED' }),
});

const amendRowSchema = z.object({
  analyte_name:   z.string().min(1, { message: 'ERR_ANALYTE_REQUIRED' }),
  value:          z.string().min(1, { message: 'ERR_VALUE_REQUIRED' }),
  unit_id:        z.string().uuid().optional(),
  reference_low:  z.number().optional(),
  reference_high: z.number().optional(),
  sub_panel:      z.string().optional(),
  fallback_flag:  z.enum(['NORMAL', 'ABNORMAL', 'CRITICAL']).optional(),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

// GET /api/lab/orders  — all orders for the org (sorted by urgency)
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

// GET /api/lab/orders/:testId  — order detail with analyte results
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
      ltr.sub_panel,
      ltr.is_amended,
      ltr.original_result_id,
      ltr.acknowledged_at,
      ltr.acknowledged_by,
      un.symbol AS unit_symbol,
      ltr.created_at
    FROM lab_test_results ltr
    LEFT JOIN units un ON un.unit_id = ltr.unit_id
    WHERE ltr.test_id = ${testId}
    ORDER BY ltr.sub_panel NULLS LAST, ltr.created_at ASC
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
// Flag is COMPUTED server-side from reference_low / reference_high.
// fallback_flag is only used when no numeric reference range is provided.
export const enterResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = resultSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { test_id, results } = val.data;

  // Verify test exists + get patient_id and requesting doctor
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

  // Insert each result row with SERVER-SIDE flag computation
  const insertedResults = [];
  for (const r of results) {
    const computedFlag = computeFlag(
      r.value,
      r.reference_low  ?? null,
      r.reference_high ?? null,
      r.fallback_flag  ?? null,
    );

    const [inserted] = await sql`
      INSERT INTO lab_test_results (
        test_id, analyte_name, value, unit_id,
        reference_low, reference_high,
        flag,
        sub_panel,
        entered_by
      )
      VALUES (
        ${test_id},
        ${r.analyte_name},
        ${r.value},
        ${r.unit_id      ?? null},
        ${r.reference_low  ?? null},
        ${r.reference_high ?? null},
        ${computedFlag},
        ${r.sub_panel    ?? null},
        ${tech?.technician_id ?? null}
      )
      RETURNING result_id, analyte_name, value, flag, sub_panel
    `;
    insertedResults.push(inserted);
  }

  // Mark test as COMPLETED
  await sql`UPDATE lab_tests SET status = 'COMPLETED' WHERE test_id = ${test_id}`;

  // Alert the requesting doctor (differentiated by severity)
  if (test.requested_by) {
    const hasCritical = insertedResults.some(r => r.flag === 'CRITICAL');
    const hasAbnormal = insertedResults.some(r => r.flag === 'ABNORMAL');
    const alertType = hasCritical ? 'CRITICAL_RESULT' : hasAbnormal ? 'ABNORMAL_RESULT' : 'RESULT_READY';
    const message = hasCritical
      ? 'Critical lab result entered — immediate review and acknowledgment required.'
      : hasAbnormal
      ? 'Abnormal lab result entered — review recommended.'
      : 'Lab results are ready for review.';

    await sql`
      INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
      VALUES (${test.patient_id}, ${test.requested_by}, ${alertType}, ${message})
    `;
  }

  // Update infection risk heuristic for flagged results
  const hasCriticalResult = insertedResults.some(r => r.flag === 'CRITICAL');
  const hasAbnormalResult = insertedResults.some(r => r.flag === 'ABNORMAL');
  if (hasCriticalResult || hasAbnormalResult) {
    const riskLevel = hasCriticalResult ? 'CRITICAL' : 'HIGH';
    const riskScore = hasCriticalResult ? 0.9 : 0.65;
    await sql`
      INSERT INTO infection_risks (patient_id, risk_score, risk_level, message, model_version)
      VALUES (
        ${test.patient_id}, ${riskScore}, ${riskLevel},
        ${'Risk inferred from lab results'}, ${'rule-engine-v1'}
      )
    `;
  }

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULTS_ENTERED',
    data: { results: insertedResults },
  });
});

// POST /api/lab/results/:resultId/amend
// Marks the original result row as amended and inserts a corrected replacement.
// The corrected row carries original_result_id pointing back to the old row.
export const amendResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { resultId } = req.params;

  const val = amendRowSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  // Verify the original result exists and has not already been amended
  const [original] = await sql`
    SELECT result_id, test_id, is_amended
    FROM lab_test_results
    WHERE result_id = ${resultId}
    LIMIT 1
  `;
  if (!original)       return next(new AppError('ERROR_RESULT_NOT_FOUND', 404));
  if (original.is_amended) return next(new AppError('ERROR_RESULT_ALREADY_AMENDED', 409));

  const { analyte_name, value, unit_id, reference_low, reference_high, sub_panel, fallback_flag } = val.data;
  const computedFlag = computeFlag(value, reference_low ?? null, reference_high ?? null, fallback_flag ?? null);

  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;

  // Mark original as amended (preserves it for audit trail)
  await sql`
    UPDATE lab_test_results SET is_amended = TRUE WHERE result_id = ${resultId}
  `;

  // Insert the corrected row, linking back to the original
  const [corrected] = await sql`
    INSERT INTO lab_test_results (
      test_id, analyte_name, value, unit_id,
      reference_low, reference_high,
      flag, sub_panel,
      original_result_id, entered_by
    )
    VALUES (
      ${original.test_id},
      ${analyte_name},
      ${value},
      ${unit_id      ?? null},
      ${reference_low  ?? null},
      ${reference_high ?? null},
      ${computedFlag},
      ${sub_panel    ?? null},
      ${resultId},
      ${tech?.technician_id ?? null}
    )
    RETURNING result_id, analyte_name, value, flag, sub_panel, original_result_id
  `;

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULT_AMENDED',
    data: { corrected },
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
