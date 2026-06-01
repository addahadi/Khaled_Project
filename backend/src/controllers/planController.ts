import { Request, Response } from 'express';
import sql from '../config/db.js';
import catchAsync from '../utils/catchAsync.js';

export const getPlans = catchAsync(async (_req: Request, res: Response) => {
  const plans = await sql`
    SELECT
      p.plan_id,
      p.name,
      p.description,
      p.price_monthly,
      p.price_annually,
      p.is_trial,
      p.is_active,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'feature_id', pf.feature_id,
            'name',       pf.name,
            'is_enabled', pf.is_enabled,
            'value',      pf.value
          ) ORDER BY pf.name
        ) FILTER (WHERE pf.feature_id IS NOT NULL),
        '[]'
      ) AS features
    FROM plans p
    LEFT JOIN plan_features pf ON pf.plan_id = p.plan_id
    WHERE p.is_active = TRUE
      AND p.deleted_at IS NULL
    GROUP BY p.plan_id
    ORDER BY p.price_monthly ASC NULLS LAST
  `;

  res.status(200).json({ status: 'success', data: { plans } });
});

export const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const { planId } = req.params;

  const [plan] = await sql`
    SELECT
      p.plan_id,
      p.name,
      p.description,
      p.price_monthly,
      p.price_annually,
      p.is_trial,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'feature_id', pf.feature_id,
            'name',       pf.name,
            'is_enabled', pf.is_enabled,
            'value',      pf.value
          )
        ) FILTER (WHERE pf.feature_id IS NOT NULL),
        '[]'
      ) AS features
    FROM plans p
    LEFT JOIN plan_features pf ON pf.plan_id = p.plan_id
    WHERE p.plan_id = ${planId}
      AND p.is_active = TRUE
      AND p.deleted_at IS NULL
    GROUP BY p.plan_id
    LIMIT 1
  `;

  if (!plan) {
    res.status(404).json({ status: 'fail', messageKey: 'ERROR_PLAN_NOT_FOUND' });
    return;
  }

  res.status(200).json({ status: 'success', data: { plan } });
});
