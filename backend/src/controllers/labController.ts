import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// ─── Flag computation (server-side) ─────────────────────────────────────────
//
//  NORMAL   : refLow ≤ value ≤ refHigh
//  ABNORMAL : outside range but within 30 % of the range width
//  CRITICAL : more than 30 % beyond either boundary  (panic-value heuristic)
//
//  Edge-case guards (fixes from QA audit):
//    • refLow > refHigh  (inverted range) → fall through to qualitative branch
//    • refLow === refHigh (point reference) → exact match = NORMAL, else ABNORMAL
//    • Non-numeric value with numeric refs   → fall through to qualitative branch
// ─────────────────────────────────────────────────────────────────────────────
function computeFlag(
  value: string,
  refLow:  number | null | undefined,
  refHigh: number | null | undefined,
  clientFallback?: string | null,
): 'NORMAL' | 'ABNORMAL' | 'CRITICAL' {
  const num = parseFloat(value);

  if (!isNaN(num) && refLow != null && refHigh != null) {
    // Guard: inverted range is a data-entry error — skip numeric logic
    if (refLow > refHigh) {
      // fall through to qualitative branch below
    } else if (refLow === refHigh) {
      // Point reference — exact match is NORMAL; any deviation is ABNORMAL (not CRITICAL)
      return num === refLow ? 'NORMAL' : 'ABNORMAL';
    } else {
      if (num >= refLow && num <= refHigh) return 'NORMAL';
      const margin = (refHigh - refLow) * 0.3;
      if (num < refLow - margin || num > refHigh + margin) return 'CRITICAL';
      return 'ABNORMAL';
    }
  }

  // Qualitative / no usable reference range — honour client fallback
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Org-scope filter: only tests ordered by doctors in this org. */
function orgFilter(orgId: string | null) {
  return orgId
    ? sql`AND lt.requested_by IN (
          SELECT user_id FROM users
          WHERE organization_id = ${orgId} AND deleted_at IS NULL
        )`
    : sql``;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

// GET /api/lab/orders?status=PENDING&search=john&page=1&limit=20
export const getLabOrders = catchAsync(async (req: Request, res: Response) => {
  const orgId  = req.user!.org_id;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL';
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
  const offset = (page - 1) * limit;

  // Resolve current tech's ID so we can flag is_mine
  const [techRow] = await sql`
    SELECT technician_id FROM lab_technicians
    WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;
  const myTechId: string | null = techRow?.technician_id ?? null;

  const statusFilter = ['PENDING', 'INPROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)
    ? sql`AND lt.status = ${status}`
    : sql``;

  const searchFilter = search
    ? sql`AND (pat.name ILIKE ${'%' + search + '%'} OR lt.test_type ILIKE ${'%' + search + '%'})`
    : sql``;

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
      u.username  AS ordered_by_name,
      lt.assigned_to,
      lt.assigned_at,
      tech_u.username AS assigned_tech_name,
      (lt.assigned_to = ${myTechId}::uuid) AS is_mine
    FROM lab_tests lt
    JOIN patients pat ON pat.patient_id = lt.patient_id
    LEFT JOIN users u ON u.user_id = lt.requested_by
    LEFT JOIN lab_technicians lt_tech ON lt_tech.technician_id = lt.assigned_to
    LEFT JOIN users tech_u ON tech_u.user_id = lt_tech.user_id
    WHERE lt.deleted_at IS NULL
    ${orgFilter(orgId)}
    ${statusFilter}
    ${searchFilter}
    ORDER BY
      (lt.assigned_to = ${myTechId}::uuid) DESC NULLS LAST,
      CASE lt.status
        WHEN 'INPROGRESS' THEN 1
        WHEN 'PENDING'    THEN 2
        WHEN 'COMPLETED'  THEN 3
        ELSE 4
      END,
      lt.ordered_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await sql`
    SELECT COUNT(*) AS total
    FROM lab_tests lt
    JOIN patients pat ON pat.patient_id = lt.patient_id
    WHERE lt.deleted_at IS NULL
    ${orgFilter(orgId)}
    ${statusFilter}
    ${searchFilter}
  `;

  res.status(200).json({
    status: 'success',
    data: {
      orders,
      pagination: {
        page,
        limit,
        total: Number(countRow.total),
        pages: Math.ceil(Number(countRow.total) / limit),
      },
    },
  });
});

// GET /api/lab/orders/:testId  — order detail with analyte results
export const getLabOrderById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;
  const orgId = req.user!.org_id;

  const [order] = await sql`
    SELECT
      lt.test_id,
      lt.test_type,
      lt.status,
      lt.notes,
      lt.ordered_at,
      lt.assigned_to,
      lt.assigned_at,
      pat.patient_id,
      pat.name  AS patient_name,
      pat.age,
      pat.gender,
      pat.medical_history,
      u.username AS ordered_by_name,
      tech_u.username AS assigned_tech_name
    FROM lab_tests lt
    JOIN patients pat ON pat.patient_id = lt.patient_id
    LEFT JOIN users u ON u.user_id = lt.requested_by
    LEFT JOIN lab_technicians lt_tech ON lt_tech.technician_id = lt.assigned_to
    LEFT JOIN users tech_u ON tech_u.user_id = lt_tech.user_id
    WHERE lt.test_id = ${testId}
      AND lt.deleted_at IS NULL
      ${orgFilter(orgId)}
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

// PATCH /api/lab/orders/:testId/start
// Atomically claims the order: only succeeds if PENDING and unassigned.
// The AND assigned_to IS NULL + UPDATE row-lock prevents two techs claiming simultaneously.
export const startOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;
  const orgId = req.user!.org_id;

  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;
  if (!tech) return next(new AppError('ERROR_FORBIDDEN', 403));

  // Verify test belongs to this org before claiming
  const [existing] = await sql`
    SELECT test_id, status, assigned_to FROM lab_tests lt
    WHERE lt.test_id = ${testId}
      AND lt.deleted_at IS NULL
      ${orgFilter(orgId)}
    LIMIT 1
  `;
  if (!existing) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));
  if (existing.assigned_to && existing.assigned_to !== tech.technician_id) {
    return next(new AppError('ERROR_ORDER_ALREADY_CLAIMED', 409));
  }
  if (existing.status !== 'PENDING') return next(new AppError('ERROR_ORDER_NOT_CLAIMABLE', 409));

  // Atomic claim: row-lock ensures only one concurrent request wins
  const [order] = await sql`
    UPDATE lab_tests
    SET status      = 'INPROGRESS',
        assigned_to = ${tech.technician_id},
        assigned_at = NOW()
    WHERE test_id      = ${testId}
      AND status       = 'PENDING'
      AND (assigned_to IS NULL OR assigned_to = ${tech.technician_id})
      AND deleted_at  IS NULL
    RETURNING test_id, status, assigned_to, assigned_at
  `;

  if (!order) return next(new AppError('ERROR_ORDER_ALREADY_CLAIMED', 409));

  // Notify PRIMARY and COVERING doctors that someone picked up the order
  await sql`
    INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
    SELECT pa.patient_id, pa.doctor_id, 'RESULT_READY',
           ${'Lab order is being processed by a technician.'}
    FROM patient_assignments pa
    WHERE pa.patient_id = (SELECT patient_id FROM lab_tests WHERE test_id = ${testId})
      AND pa.role IN ('PRIMARY', 'COVERING')
      AND pa.discharged_at IS NULL
      AND (pa.valid_until IS NULL OR pa.valid_until > NOW())
  `;

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_ORDER_CLAIMED',
    data: { order },
  });
});

// PATCH /api/lab/orders/:testId/release
// Releases a claimed (INPROGRESS) order back to PENDING — only by the owning tech.
export const releaseOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;

  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;
  if (!tech) return next(new AppError('ERROR_FORBIDDEN', 403));

  const [order] = await sql`
    UPDATE lab_tests
    SET status      = 'PENDING',
        assigned_to = NULL,
        assigned_at = NULL
    WHERE test_id      = ${testId}
      AND status       = 'INPROGRESS'
      AND assigned_to  = ${tech.technician_id}
      AND deleted_at  IS NULL
    RETURNING test_id, status
  `;

  if (!order) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_ORDER_RELEASED',
    data: { order },
  });
});

// POST /api/lab/results
// Guards:
//  1. Org-scope: test must belong to tech's org
//  2. Status: test must not already be COMPLETED
//  3. Assigned-to: only the assigned tech (or any tech if unassigned) can submit
export const enterResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = resultSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { test_id, results } = val.data;
  const orgId = req.user!.org_id;

  // Guard 1 + 2: org-scope and status check
  const [test] = await sql`
    SELECT lt.test_id, lt.patient_id, lt.requested_by, lt.status, lt.assigned_to
    FROM lab_tests lt
    WHERE lt.test_id    = ${test_id}
      AND lt.deleted_at IS NULL
      ${orgFilter(orgId)}
    LIMIT 1
  `;
  if (!test) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));
  if (test.status === 'COMPLETED') return next(new AppError('ERROR_ORDER_ALREADY_COMPLETED', 409));
  if (test.status === 'CANCELLED') return next(new AppError('ERROR_ORDER_NOT_CLAIMABLE', 409));

  // Guard 3: if an order is assigned, only the assigned tech may submit
  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;
  if (test.assigned_to && tech?.technician_id !== test.assigned_to) {
    return next(new AppError('ERROR_ORDER_NOT_ASSIGNED_TO_YOU', 403));
  }

  // Insert each result row with SERVER-SIDE flag computation
  const insertedResults: Array<Record<string, unknown>> = [];
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
        flag, sub_panel, entered_by
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

  // Transition PENDING → INPROGRESS (do NOT mark COMPLETED yet)
  if (test.status === 'PENDING') {
    await sql`
      UPDATE lab_tests
      SET status      = 'INPROGRESS',
          assigned_to = ${tech?.technician_id ?? null},
          assigned_at = NOW()
      WHERE test_id = ${test_id}
        AND status  = 'PENDING'
    `;
  }

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULTS_ENTERED',
    data: { results: insertedResults },
  });
});

// PATCH /api/lab/orders/:testId/complete
// Explicitly marks a test as COMPLETED after the tech has entered all analytes.
// Moves alert + infection_risk logic here so partial submissions don't trigger them.
export const completeOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { testId } = req.params;
  const orgId = req.user!.org_id;

  // Verify tech identity
  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;
  if (!tech) return next(new AppError('ERROR_FORBIDDEN', 403));

  // Load test with org-scope
  const [test] = await sql`
    SELECT lt.test_id, lt.patient_id, lt.status, lt.assigned_to
    FROM lab_tests lt
    WHERE lt.test_id    = ${testId}
      AND lt.deleted_at IS NULL
      ${orgFilter(orgId)}
    LIMIT 1
  `;
  if (!test) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));
  if (test.status === 'COMPLETED') return next(new AppError('ERROR_ORDER_ALREADY_COMPLETED', 409));
  if (test.status === 'CANCELLED') return next(new AppError('ERROR_ORDER_NOT_CLAIMABLE', 409));
  if (test.status === 'PENDING')   return next(new AppError('ERROR_ORDER_NO_RESULTS', 422));

  // Only the assigned tech (or any tech if unassigned) may complete
  if (test.assigned_to && tech.technician_id !== test.assigned_to) {
    return next(new AppError('ERROR_ORDER_NOT_ASSIGNED_TO_YOU', 403));
  }

  // Ensure at least one result row exists
  const [countRow] = await sql`
    SELECT COUNT(*) AS cnt FROM lab_test_results
    WHERE test_id = ${testId} AND is_amended = FALSE
  `;
  if (Number(countRow.cnt) === 0) {
    return next(new AppError('ERROR_ORDER_NO_RESULTS', 422));
  }

  // Mark COMPLETED
  await sql`
    UPDATE lab_tests
    SET status = 'COMPLETED', assigned_to = NULL, updated_at = NOW()
    WHERE test_id = ${testId}
  `;

  // Read active results for alert + risk computation
  const activeResults = await sql`
    SELECT flag FROM lab_test_results
    WHERE test_id = ${testId} AND is_amended = FALSE
  `;
  const hasCritical = (activeResults as Array<Record<string, unknown>>).some(r => r['flag'] === 'CRITICAL');
  const hasAbnormal = (activeResults as Array<Record<string, unknown>>).some(r => r['flag'] === 'ABNORMAL');

  // Alert PRIMARY and COVERING doctors
  const alertRecipients = await sql`
    SELECT doctor_id FROM patient_assignments
    WHERE patient_id = ${test.patient_id}
      AND role IN ('PRIMARY', 'COVERING')
      AND discharged_at IS NULL
      AND (valid_until IS NULL OR valid_until > NOW())
  `;

  if (alertRecipients.length > 0) {
    const alertType = hasCritical ? 'CRITICAL_RESULT' : hasAbnormal ? 'ABNORMAL_RESULT' : 'RESULT_READY';
    const message   = hasCritical
      ? 'Critical lab result entered — immediate review and acknowledgment required.'
      : hasAbnormal
      ? 'Abnormal lab result entered — review recommended.'
      : 'Lab results are ready for review.';

    for (const rec of alertRecipients) {
      await sql`
        INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
        VALUES (${test.patient_id}, ${rec.doctor_id}, ${alertType}, ${message})
      `;
    }
  }

  // Insert infection risk heuristic for flagged results
  if (hasCritical || hasAbnormal) {
    const riskLevel = hasCritical ? 'CRITICAL' : 'HIGH';
    const riskScore = hasCritical ? 0.9 : 0.65;
    await sql`
      INSERT INTO infection_risks (patient_id, risk_score, risk_level, message, model_version)
      VALUES (
        ${test.patient_id}, ${riskScore}, ${riskLevel},
        ${'Risk inferred from lab results'}, ${'rule-engine-v1'}
      )
    `;
  }

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_ORDER_COMPLETED',
    data: { test_id: testId },
  });
});

// POST /api/lab/results/:resultId/amend
// Marks the original row as amended and inserts a corrected replacement.
// After amendment, re-evaluates infection_risks for the patient based on current active results.
export const amendResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { resultId } = req.params;

  const val = amendRowSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const [original] = await sql`
    SELECT result_id, test_id, is_amended
    FROM lab_test_results
    WHERE result_id = ${resultId}
    LIMIT 1
  `;
  if (!original)           return next(new AppError('ERROR_RESULT_NOT_FOUND', 404));
  if (original.is_amended) return next(new AppError('ERROR_RESULT_ALREADY_AMENDED', 409));

  const { analyte_name, value, unit_id, reference_low, reference_high, sub_panel, fallback_flag } = val.data;
  const computedFlag = computeFlag(value, reference_low ?? null, reference_high ?? null, fallback_flag ?? null);

  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;

  // Mark original as amended (audit trail preserved)
  await sql`UPDATE lab_test_results SET is_amended = TRUE WHERE result_id = ${resultId}`;

  // Insert corrected row linking back to original
  const [corrected] = await sql`
    INSERT INTO lab_test_results (
      test_id, analyte_name, value, unit_id,
      reference_low, reference_high,
      flag, sub_panel, original_result_id, entered_by
    )
    VALUES (
      ${original.test_id},
      ${analyte_name},
      ${value},
      ${unit_id       ?? null},
      ${reference_low  ?? null},
      ${reference_high ?? null},
      ${computedFlag},
      ${sub_panel     ?? null},
      ${resultId},
      ${tech?.technician_id ?? null}
    )
    RETURNING result_id, analyte_name, value, flag, sub_panel, original_result_id
  `;

  // ── Re-evaluate infection risk after amendment ────────────────────────────
  // Read all active (non-amended) results for this test to determine updated risk
  const [testMeta] = await sql`
    SELECT patient_id FROM lab_tests WHERE test_id = ${original.test_id} LIMIT 1
  `;

  if (testMeta) {
    const activeResults = await sql`
      SELECT flag FROM lab_test_results
      WHERE test_id = ${original.test_id}
        AND is_amended = FALSE
    `;

    const hasCritical = (activeResults as Array<Record<string, unknown>>).some(r => r['flag'] === 'CRITICAL');
    const hasAbnormal = (activeResults as Array<Record<string, unknown>>).some(r => r['flag'] === 'ABNORMAL');

    // Only insert a new infection_risk entry when the overall level changes
    let newRiskLevel: string | null = null;
    let newRiskScore: number | null = null;
    let riskMessage: string | null  = null;

    if (!hasCritical && !hasAbnormal) {
      newRiskLevel = 'LOW';
      newRiskScore = 0.10;
      riskMessage  = 'Risk reassessed after result amendment — all values now within normal range.';
    } else if (!hasCritical && hasAbnormal) {
      newRiskLevel = 'HIGH';
      newRiskScore = 0.65;
      riskMessage  = 'Risk reassessed after result amendment — abnormal values remain.';
    }
    // If still CRITICAL after amendment, no downgrade needed

    if (newRiskLevel !== null) {
      await sql`
        INSERT INTO infection_risks (patient_id, risk_score, risk_level, message, model_version)
        VALUES (
          ${testMeta.patient_id}, ${newRiskScore!}, ${newRiskLevel},
          ${riskMessage!}, ${'rule-engine-v1'}
        )
      `;
    }
  }

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_RESULT_AMENDED',
    data: { corrected },
  });
});

// GET /api/lab/alerts
export const getLabAlerts = catchAsync(async (req: Request, res: Response) => {
  const alerts = await sql`
    SELECT
      a.alert_id,
      a.patient_id,
      pat.name AS patient_name,
      a.alert_type,
      a.message,
      a.is_read,
      a.read_at,
      a.created_at
    FROM alerts a
    LEFT JOIN patients pat ON pat.patient_id = a.patient_id
    WHERE a.recipient_id = ${req.user!.user_id}
    ORDER BY a.created_at DESC
    LIMIT 50
  `;

  const unread_count = (alerts as Array<Record<string, unknown>>).filter(a => !a['is_read']).length;

  res.status(200).json({ status: 'success', data: { alerts, unread_count } });
});

// PATCH /api/lab/alerts/:alertId/read
export const markLabAlertRead = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { alertId } = req.params;

  const [alert] = await sql`
    UPDATE alerts SET is_read = TRUE, read_at = NOW()
    WHERE alert_id = ${alertId} AND recipient_id = ${req.user!.user_id}
    RETURNING alert_id
  `;

  if (!alert) return next(new AppError('ERROR_ALERT_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_ALERT_READ' });
});

// GET /api/lab/units
export const getUnits = catchAsync(async (_req: Request, res: Response) => {
  const units = await sql`
    SELECT unit_id, name, symbol FROM units ORDER BY name ASC
  `;
  res.status(200).json({ status: 'success', data: { units } });
});

// POST /api/lab/units
export const createUnitSchema = z.object({
  name:   z.string().min(1, { message: 'ERR_UNIT_NAME_REQUIRED' }).max(100),
  symbol: z.string().min(1, { message: 'ERR_UNIT_SYMBOL_REQUIRED' }).max(20),
});

export const createUnit = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // Body is already validated by validateBody middleware
  const { name, symbol } = req.body as z.infer<typeof createUnitSchema>;

  // Check for duplicate symbol
  const [existing] = await sql`
    SELECT unit_id FROM units WHERE LOWER(symbol) = LOWER(${symbol}) LIMIT 1
  `;
  if (existing) return next(new AppError('ERROR_UNIT_SYMBOL_EXISTS', 409));

  const [unit] = await sql`
    INSERT INTO units (name, symbol) VALUES (${name}, ${symbol})
    RETURNING unit_id, name, symbol
  `;

  res.status(201).json({ status: 'success', data: { unit } });
});

// GET /api/lab/stats  — dashboard stats for lab tech
export const getLabStats = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;

  const [tech] = await sql`
    SELECT technician_id FROM lab_technicians WHERE user_id = ${req.user!.user_id} LIMIT 1
  `;

  const filter = orgId
    ? sql`AND lt.requested_by IN (SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL)`
    : sql``;

  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE lt.status = 'PENDING')                       AS pending_count,
      COUNT(*) FILTER (WHERE lt.status = 'INPROGRESS')                    AS inprogress_count,
      COUNT(*) FILTER (WHERE lt.status = 'COMPLETED'
        AND lt.updated_at::DATE = NOW()::DATE)                             AS completed_today,
      COUNT(*) FILTER (WHERE lt.status = 'COMPLETED')                     AS total_completed,
      COUNT(*) FILTER (WHERE lt.assigned_to = ${tech?.technician_id ?? null}::uuid
        AND lt.status = 'INPROGRESS')                                      AS my_inprogress
    FROM lab_tests lt
    WHERE lt.deleted_at IS NULL
    ${filter}
  `;

  res.status(200).json({ status: 'success', data: { stats } });
});
