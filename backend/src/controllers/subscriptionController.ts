import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

const createSubscriptionSchema = z.object({
  plan_id: z.string().uuid({ message: 'ERR_PLAN_INVALID' }),
  external_payment_ref: z.string().optional(),
});

const changePlanSchema = z.object({
  plan_id: z.string().uuid({ message: 'ERR_PLAN_INVALID' }),
  external_payment_ref: z.string().optional(),
});

// GET /api/subscriptions/my  — current subscription for the user's org
export const getMySubscription = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const [subscription] = await sql`
    SELECT
      s.subscription_id,
      s.organization_id,
      s.plan_id,
      s.status,
      s.current_cycle_start,
      s.current_cycle_end,
      s.trial_end_at,
      s.external_payment_ref,
      s.created_at,
      p.name        AS plan_name,
      p.description AS plan_description,
      p.price_monthly,
      p.price_annually,
      p.is_trial,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'name',       pf.name,
            'is_enabled', pf.is_enabled,
            'value',      pf.value
          )
        ) FILTER (WHERE pf.feature_id IS NOT NULL),
        '[]'
      ) AS features
    FROM subscriptions s
    JOIN plans p ON p.plan_id = s.plan_id
    LEFT JOIN plan_features pf ON pf.plan_id = s.plan_id
    WHERE s.organization_id = ${req.user.org_id}
      AND s.status = 'ACTIVE'
    GROUP BY s.subscription_id, p.plan_id
    ORDER BY s.created_at DESC
    LIMIT 1
  `;

  if (!subscription) {
    return next(new AppError('ERROR_NO_ACTIVE_SUBSCRIPTION', 404));
  }

  // Fetch usage for current cycle
  const [usage] = await sql`
    SELECT prediction_used, prediction_overage
    FROM usage_records
    WHERE subscription_id = ${subscription.subscription_id}
      AND cycle_start <= NOW()::DATE
      AND cycle_end >= NOW()::DATE
    LIMIT 1
  `;

  res.status(200).json({
    status: 'success',
    data: {
      subscription: {
        ...subscription,
        usage: usage ?? { prediction_used: 0, prediction_overage: 0 },
      },
    },
  });
});

// POST /api/subscriptions  — create a new subscription for an org
export const createSubscription = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const val = createSubscriptionSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { plan_id, external_payment_ref } = val.data;

  // Verify plan exists
  const [plan] = await sql`
    SELECT plan_id, is_trial FROM plans
    WHERE plan_id = ${plan_id} AND is_active = TRUE AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!plan) return next(new AppError('ERROR_PLAN_NOT_FOUND', 404));

  // Bug-fix: trial plans are only allowed at org registration, not via this endpoint
  if (plan.is_trial) {
    return next(new AppError('ERROR_TRIAL_NOT_ALLOWED', 403));
  }

  // Cancel any existing active subscriptions
  await sql`
    UPDATE subscriptions
    SET status = 'CANCELLED', cancelled_at = NOW()
    WHERE organization_id = ${req.user.org_id}
      AND status = 'ACTIVE'
  `;

  const cycleEnd = plan.is_trial
    ? sql`NOW()::DATE + INTERVAL '14 days'`
    : sql`NOW()::DATE + INTERVAL '30 days'`;

  const [subscription] = await sql`
    INSERT INTO subscriptions (
      organization_id,
      plan_id,
      status,
      current_cycle_start,
      current_cycle_end,
      trial_end_at,
      external_payment_ref
    )
    VALUES (
      ${req.user.org_id},
      ${plan_id},
      'ACTIVE',
      NOW()::DATE,
      ${cycleEnd as unknown as string},
      ${plan.is_trial ? sql`NOW()::DATE + INTERVAL '14 days'` as unknown as null : null},
      ${external_payment_ref ?? null}
    )
    RETURNING subscription_id, plan_id, status, current_cycle_start, current_cycle_end
  `;

  // Create initial usage record
  await sql`
    INSERT INTO usage_records (subscription_id, cycle_start, cycle_end)
    VALUES (
      ${subscription.subscription_id},
      ${subscription.current_cycle_start},
      ${subscription.current_cycle_end}
    )
  `;

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_SUBSCRIPTION_CREATED',
    data: { subscription },
  });
});

// PATCH /api/subscriptions/change-plan — switch to a different plan
export const changePlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const val = changePlanSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { plan_id, external_payment_ref } = val.data;

  const [plan] = await sql`
    SELECT plan_id, is_trial FROM plans
    WHERE plan_id = ${plan_id} AND is_active = TRUE AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!plan) return next(new AppError('ERROR_PLAN_NOT_FOUND', 404));

  // Bug-fix: trial plans cannot be selected via changePlan (prevents infinite trial extension)
  if (plan.is_trial) {
    return next(new AppError('ERROR_TRIAL_NOT_ALLOWED', 403));
  }

  // Bug-fix: wrap cancel + create + usage insert in a transaction to prevent orphaned orgs
  const subscription = await sql.begin(async (tx) => {
    // Cancel current
    await tx`
      UPDATE subscriptions
      SET status = 'CANCELLED', cancelled_at = NOW()
      WHERE organization_id = ${req.user!.org_id} AND status = 'ACTIVE'
    `;

    // Create new
    const [sub] = await tx`
      INSERT INTO subscriptions (
        organization_id, plan_id, status,
        current_cycle_start, current_cycle_end, external_payment_ref
      )
      VALUES (
        ${req.user!.org_id},
        ${plan_id},
        'ACTIVE',
        NOW()::DATE,
        NOW()::DATE + INTERVAL '30 days',
        ${external_payment_ref ?? null}
      )
      RETURNING subscription_id, plan_id, status, current_cycle_start, current_cycle_end
    `;

    await tx`
      INSERT INTO usage_records (subscription_id, cycle_start, cycle_end)
      VALUES (
        ${sub.subscription_id},
        ${sub.current_cycle_start},
        ${sub.current_cycle_end}
      )
    `;

    return sub;
  });

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_PLAN_CHANGED',
    data: { subscription },
  });
});

// DELETE /api/subscriptions/my — cancel current active subscription
export const cancelSubscription = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const [subscription] = await sql`
    UPDATE subscriptions
    SET status = 'CANCELLED', cancelled_at = NOW()
    WHERE organization_id = ${req.user.org_id} AND status = 'ACTIVE'
    RETURNING subscription_id, plan_id, status, current_cycle_start, current_cycle_end, cancelled_at
  `;

  if (!subscription) return next(new AppError('ERROR_NO_ACTIVE_SUBSCRIPTION', 404));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_DEFAULT',
    data: { subscription },
  });
});

// GET /api/subscriptions/usage  — usage stats for current cycle
export const getUsage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const [usage] = await sql`
    SELECT
      ur.usage_id,
      ur.prediction_used,
      ur.prediction_overage,
      ur.cycle_start,
      ur.cycle_end,
      pf.value AS prediction_limit
    FROM subscriptions s
    JOIN usage_records ur ON ur.subscription_id = s.subscription_id
    LEFT JOIN plan_features pf
      ON pf.plan_id = s.plan_id AND pf.name = 'predictions_per_month'
    WHERE s.organization_id = ${req.user.org_id}
      AND s.status = 'ACTIVE'
      AND ur.cycle_start <= NOW()::DATE
      AND ur.cycle_end >= NOW()::DATE
    ORDER BY ur.created_at DESC
    LIMIT 1
  `;

  if (!usage) return next(new AppError('ERROR_NO_ACTIVE_SUBSCRIPTION', 404));

  res.status(200).json({ status: 'success', data: { usage } });
});

// GET /api/subscriptions/overage  — get overage events for the org
export const getOverageEvents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const events = await sql`
    SELECT
      oe.event_id,
      oe.feature_name,
      oe.overage_amount,
      oe.created_at,
      s.plan_id
    FROM overage_events oe
    JOIN subscriptions s ON s.subscription_id = oe.subscription_id
    WHERE s.organization_id = ${req.user.org_id}
    ORDER BY oe.created_at DESC
  `;

  res.status(200).json({ status: 'success', data: { events } });
});
