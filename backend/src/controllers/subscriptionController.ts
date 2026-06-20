import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSubscriptionChangeEmail } from '../services/emailService.js';

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
      p.name_en,
      p.name_ar,
      p.description_en,
      p.description_ar,
      p.price_monthly,
      p.price_annually,
      p.is_trial,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'name_en',    pf.name_en,
            'name_ar',    pf.name_ar,
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
    SELECT plan_id, is_trial, price_monthly, price_annually FROM plans
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

  // Annual-only plans bill yearly; everything else monthly (trial is rejected above)
  const cycleDays = plan.price_annually != null && plan.price_monthly == null ? 365 : 30;
  const cycleEnd = sql`NOW()::DATE + (${cycleDays} || ' days')::INTERVAL`;

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

// PATCH /api/subscriptions/change-plan — switch to a different plan (initiate)
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
    SELECT plan_id, name_en, name_ar, is_trial FROM plans
    WHERE plan_id = ${plan_id} AND is_active = TRUE AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!plan) return next(new AppError('ERROR_PLAN_NOT_FOUND', 404));

  if (plan.is_trial) {
    return next(new AppError('ERROR_TRIAL_NOT_ALLOWED', 403));
  }

  const [user] = await sql`SELECT email FROM users WHERE user_id = ${req.user!.user_id} LIMIT 1`;
  if (!user) return next(new AppError('ERROR_USER_NOT_FOUND', 404));

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

  await sql`
    INSERT INTO subscription_change_tokens (organization_id, user_id, new_plan_id, token_hash, expires_at)
    VALUES (${req.user!.org_id}, ${req.user!.user_id}, ${plan_id}, ${tokenHash}, NOW() + INTERVAL '1 hour')
  `;

  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-subscription?token=${verifyToken}`;
  
  sendSubscriptionChangeEmail({
    to: user.email,
    verify_url: verifyUrl,
    plan_name: plan.name_en
  }).catch(err => console.error('Failed to send subscription change email:', err));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_PLAN_CHANGE_EMAIL_SENT',
  });
});

const verifyChangeSchema = z.object({
  token: z.string().min(1, { message: 'ERR_TOKEN_REQUIRED' }),
  external_payment_ref: z.string().optional(),
});

// POST /api/subscriptions/verify-change — complete the plan switch
export const verifyChangePlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const val = verifyChangeSchema.safeParse(req.body);
  if (!val.success) return next(new AppError('ERROR_VALIDATION_FAILED', 422));

  const { token, external_payment_ref } = val.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const [storedToken] = await sql`
    SELECT token_id, organization_id, new_plan_id, expires_at, used_at
    FROM subscription_change_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;

  if (!storedToken || storedToken.used_at || new Date(storedToken.expires_at) < new Date()) {
    return next(new AppError('ERROR_TOKEN_INVALID', 400));
  }

  const subscription = await sql.begin(async (tx) => {
    // Annual-only plans bill yearly; everything else monthly
    const [newPlan] = await tx`
      SELECT price_monthly, price_annually FROM plans
      WHERE plan_id = ${storedToken.new_plan_id} LIMIT 1
    `;
    const cycleDays = newPlan?.price_annually != null && newPlan?.price_monthly == null ? 365 : 30;

    // Cancel current
    await tx`
      UPDATE subscriptions
      SET status = 'CANCELLED', cancelled_at = NOW()
      WHERE organization_id = ${storedToken.organization_id} AND status = 'ACTIVE'
    `;

    // Create new
    const [sub] = await tx`
      INSERT INTO subscriptions (
        organization_id, plan_id, status,
        current_cycle_start, current_cycle_end, external_payment_ref
      )
      VALUES (
        ${storedToken.organization_id},
        ${storedToken.new_plan_id},
        'ACTIVE',
        NOW()::DATE,
        NOW()::DATE + (${cycleDays} || ' days')::INTERVAL,
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

    await tx`
      UPDATE subscription_change_tokens
      SET used_at = NOW()
      WHERE token_id = ${storedToken.token_id}
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
      ON pf.plan_id = s.plan_id AND pf.name_en = 'predictions_per_month'
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
    JOIN usage_records ur ON ur.usage_id = oe.usage_id
    JOIN subscriptions s ON s.subscription_id = ur.subscription_id
    WHERE s.organization_id = ${req.user.org_id}
    ORDER BY oe.created_at DESC
  `;

  res.status(200).json({ status: 'success', data: { events } });
});
