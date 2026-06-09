import { Request, Response, NextFunction } from 'express';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// Attach subscription context to req for downstream use
declare global {
  namespace Express {
    interface Request {
      subscriptionCtx?: {
        subscription_id: string;
        plan_id: string;
        plan_name: string;
        is_trial: boolean;
        max_predictions: number | null;
        predictions_used: number;
        predictions_overage: number;
        usage_id: string;
        overage_notified: boolean;
        isOverage: boolean;
      };
    }
  }
}

/**
 * IMAGE 1 — Case A: Prediction request hits limit
 *
 * Loads Subscription + Plan + UsageRecord.
 *
 * alt [Trial plan AND predictions_used >= max_predictions]
 *   → 402 { error: trial limit reached }
 *
 * alt [Paid plan AND predictions_used >= max_predictions]
 *   → INCREMENT predictions_overage
 *   → opt [overage_notified = false]
 *       → INSERT Alert {type=OVERAGE_STARTED}
 *       → SET overage_notified = true
 *   → Proceed to handler (req.subscriptionCtx.isOverage = true)
 *
 * [Within limit]
 *   → Proceed to handler (req.subscriptionCtx.isOverage = false)
 */
export const checkPredictionLimit = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.org_id) {
      return next(new AppError('ERROR_NO_ORGANIZATION', 403));
    }

    let shouldNotifyOverage = false;
    let overageMetadata: any = null;

    try {
      await sql.begin(async tx => {
        // ── Step 1: Load Subscription + Plan + UsageRecord ────────────────────
        const [row] = await tx`
          SELECT
            s.subscription_id,
            s.plan_id,
            s.status,
            p.name        AS plan_name,
            p.is_trial,
            pf.value      AS max_predictions,
            ur.usage_id,
            ur.prediction_used  AS predictions_used,
            ur.prediction_overage AS predictions_overage,
            ur.overage_notified
          FROM subscriptions s
          JOIN plans p ON p.plan_id = s.plan_id
          LEFT JOIN plan_features pf
            ON pf.plan_id = s.plan_id
           AND pf.name = 'predictions_per_month'
           AND pf.is_enabled = TRUE
          LEFT JOIN usage_records ur
            ON ur.subscription_id = s.subscription_id
           AND ur.cycle_start <= NOW()::DATE
           AND ur.cycle_end   >= NOW()::DATE
          WHERE s.organization_id = ${req.user!.org_id}
            AND s.status = 'ACTIVE'
          ORDER BY s.created_at DESC
          LIMIT 1
          FOR UPDATE OF ur
        `;

        if (!row) {
          throw new AppError('ERROR_NO_ACTIVE_SUBSCRIPTION', 403);
        }

        const maxPredictions: number | null = row.max_predictions
          ? Number(row.max_predictions)
          : null;
        const used:    number = Number(row.predictions_used ?? 0);
        const overage: number = Number(row.predictions_overage ?? 0);

        // ── Step 2: No limit defined → always allow ────────────────────────────
        if (maxPredictions === null) {
          await tx`UPDATE usage_records SET prediction_used = prediction_used + 1 WHERE usage_id = ${row.usage_id}`;
          req.subscriptionCtx = {
            subscription_id:    row.subscription_id,
            plan_id:            row.plan_id,
            plan_name:          row.plan_name,
            is_trial:           row.is_trial,
            max_predictions:    null,
            predictions_used:   used + 1,
            predictions_overage: overage,
            usage_id:           row.usage_id,
            overage_notified:   row.overage_notified ?? false,
            isOverage:          false,
          };
          return;
        }

        const limitReached = used >= maxPredictions;

        // ── Step 3 alt: Trial plan AND limit reached → 402 ───────────────────
        if (row.is_trial && limitReached) {
          throw new AppError('ERROR_TRIAL_PREDICTION_LIMIT', 402);
        }

        // ── Step 4 alt: Paid plan AND limit reached → overage path ───────────
        if (!row.is_trial && limitReached) {
          // INCREMENT predictions_overage and prediction_used
          await tx`
            UPDATE usage_records
            SET prediction_overage = prediction_overage + 1,
                prediction_used = prediction_used + 1
            WHERE usage_id = ${row.usage_id}
          `;

          // opt [overage_notified = false]
          if (!row.overage_notified) {
            shouldNotifyOverage = true;
            overageMetadata = {
              plan_id:         row.plan_id,
              max_predictions: maxPredictions,
              predictions_used: used + 1,
              usage_id:        row.usage_id
            };

            // SET overage_notified = true
            await tx`
              UPDATE usage_records
              SET overage_notified = TRUE
              WHERE usage_id = ${row.usage_id}
            `;
          }

          // Proceed to handler — isOverage = true
          req.subscriptionCtx = {
            subscription_id:     row.subscription_id,
            plan_id:             row.plan_id,
            plan_name:           row.plan_name,
            is_trial:            row.is_trial,
            max_predictions:     maxPredictions,
            predictions_used:    used + 1,
            predictions_overage: overage + 1,
            usage_id:            row.usage_id,
            overage_notified:    true,
            isOverage:           true,
          };
          return;
        }

        // ── Step 5: Within limit → Proceed normally ───────────────────────────
        await tx`UPDATE usage_records SET prediction_used = prediction_used + 1 WHERE usage_id = ${row.usage_id}`;
        req.subscriptionCtx = {
          subscription_id:     row.subscription_id,
          plan_id:             row.plan_id,
          plan_name:           row.plan_name,
          is_trial:            row.is_trial,
          max_predictions:     maxPredictions,
          predictions_used:    used + 1,
          predictions_overage: overage,
          usage_id:            row.usage_id,
          overage_notified:    row.overage_notified ?? false,
          isOverage:           false,
        };
      });
    } catch (err) {
      return next(err);
    }

    if (shouldNotifyOverage && overageMetadata) {
      // INSERT Alert {type = OVERAGE_STARTED}
      await sql`
        INSERT INTO overage_events (usage_id, event_type, metadata)
        VALUES (
          ${overageMetadata.usage_id},
          'OVERAGE_STARTED',
          ${JSON.stringify({
            plan_id:         overageMetadata.plan_id,
            max_predictions: overageMetadata.max_predictions,
            predictions_used: overageMetadata.predictions_used,
          })}::jsonb
        )
      `;

      // Notify the manager of this org
      const managers = await sql`
        SELECT u.user_id FROM users u
        JOIN hospital_managers hm ON hm.user_id = u.user_id
        WHERE u.organization_id = ${req.user.org_id}
          AND u.deleted_at IS NULL
      `;
      for (const m of managers) {
        await sql`
          INSERT INTO alerts (recipient_id, alert_type, message)
          VALUES (
            ${m.user_id},
            'OVERAGE_STARTED',
            ${'Your organization has exceeded the monthly prediction limit. Overage billing applies.'}
          )
        `;
      }
    }

    return next();
  }
);

/**
 * IMAGE 3 — Case B: Adding a user beyond plan limit
 *
 * Checks active user count against plan's user limit.
 * Attaches result to req for the invitation handler.
 */
export const checkUserLimit = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.org_id) {
      return next(new AppError('ERROR_NO_ORGANIZATION', 403));
    }

    // Load subscription + plan
    const [sub] = await sql`
      SELECT
        s.subscription_id,
        s.plan_id,
        p.is_trial,
        pf_users.value AS max_users
      FROM subscriptions s
      JOIN plans p ON p.plan_id = s.plan_id
      LEFT JOIN plan_features pf_users
        ON pf_users.plan_id = s.plan_id
       AND pf_users.name = 'users_limit'
       AND pf_users.is_enabled = TRUE
      WHERE s.organization_id = ${req.user.org_id}
        AND s.status = 'ACTIVE'
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    if (!sub) {
      return next(new AppError('ERROR_NO_ACTIVE_SUBSCRIPTION', 403));
    }

    // SELECT COUNT(*) Users WHERE org_id AND is_active = true
    const [countRow] = await sql`
      SELECT COUNT(*) AS current_users_count
      FROM users
      WHERE organization_id = ${req.user.org_id}
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
    `;
    const currentCount = Number(countRow.current_users_count ?? 0);
    const maxUsers: number | null = sub.max_users ? Number(sub.max_users) : null;

    // alt: Trial plan AND count >= max_users → 402
    if (sub.is_trial && maxUsers !== null && currentCount >= maxUsers) {
      return next(new AppError('ERROR_TRIAL_USER_LIMIT', 402));
    }

    // alt: Paid plan AND count >= max_users → overage path
    const isUserOverage = !sub.is_trial && maxUsers !== null && currentCount >= maxUsers;

    (req as Request & { userLimitCtx: unknown }).userLimitCtx = {
      subscription_id: sub.subscription_id,
      plan_id:         sub.plan_id,
      is_trial:        sub.is_trial,
      max_users:       maxUsers,
      current_count:   currentCount,
      isUserOverage,
    };

    return next();
  }
);

/**
 * Basic subscription existence check (for non-prediction-gated routes).
 */
export const checkSubscription = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.org_id) {
      return next(new AppError('ERROR_NO_ORGANIZATION', 403));
    }

    const [row] = await sql`
      SELECT s.subscription_id, s.plan_id, s.status
      FROM subscriptions s
      WHERE s.organization_id = ${req.user.org_id}
        AND s.status = 'ACTIVE'
      LIMIT 1
    `;

    if (!row) {
      return next(new AppError('ERROR_NO_ACTIVE_SUBSCRIPTION', 403));
    }

    next();
  }
);
