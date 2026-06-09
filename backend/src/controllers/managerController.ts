import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const departmentSchema = z.object({
  name: z.string().min(2, { message: 'ERR_NAME_TOO_SHORT' }),
});

const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED'], { message: 'ERR_STATUS_INVALID' }),
});

const updateProfileSchema = z.object({
  username: z.string().min(3, { message: 'ERR_USERNAME_TOO_SHORT' }).optional(),
  department_id: z.string().uuid({ message: 'ERR_DEPT_INVALID' }).nullable().optional(),
});

const updateOrganizationSchema = z.object({
  name: z.string().min(2, { message: 'ERR_NAME_TOO_SHORT' }).optional(),
  type: z.enum(['HOSPITAL', 'CLINIC', 'LAB', 'OTHER'], { message: 'ERR_TYPE_INVALID' }).optional(),
  email: z.string().email({ message: 'ERR_EMAIL_INVALID' }).optional(),
  address: z.string().optional(),
});

// ─── Organization ─────────────────────────────────────────────────────────────

export const getOrganization = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const [org] = await sql`
    SELECT
      o.organization_id,
      o.name,
      o.type,
      o.address,
      o.created_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('department_id', d.department_id, 'name', d.name)
        ) FILTER (WHERE d.department_id IS NOT NULL),
        '[]'
      ) AS departments
    FROM organizations o
    LEFT JOIN departments d ON d.organization_id = o.organization_id AND d.deleted_at IS NULL
    WHERE o.organization_id = ${req.user.org_id}
      AND o.deleted_at IS NULL
    GROUP BY o.organization_id
    LIMIT 1
  `;

  if (!org) return next(new AppError('ERROR_ORG_NOT_FOUND', 404));

  res.status(200).json({ status: 'success', data: { organization: org } });
});

export const updateOrganization = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const val = updateOrganizationSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { name, type, email, address } = val.data;

  const [org] = await sql`
    UPDATE organizations
    SET
      name = COALESCE(${name ?? null}, name),
      type = COALESCE(${type ?? null}, type),
      email = COALESCE(${email ?? null}, email),
      address = COALESCE(${address ?? null}, address)
    WHERE organization_id = ${req.user.org_id}
      AND deleted_at IS NULL
    RETURNING organization_id, name, type, email, address
  `;

  if (!org) return next(new AppError('ERROR_ORG_NOT_FOUND', 404));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_ORG_UPDATED',
    data: { organization: org },
  });
});

// ─── Staff ────────────────────────────────────────────────────────────────────

export const getStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const staff = await sql`
    SELECT
      u.user_id,
      u.username,
      u.email,
      u.status,
      u.department_id,
      dep.name AS department_name,
      u.created_at,
      CASE
        WHEN d.doctor_id IS NOT NULL THEN 'DOCTOR'
        WHEN lt.technician_id IS NOT NULL THEN 'LAB_TECH'
        WHEN hm.manager_id IS NOT NULL THEN 'MANAGER'
        ELSE 'USER'
      END AS role
    FROM users u
    LEFT JOIN departments dep ON dep.department_id = u.department_id
    LEFT JOIN doctors d ON d.user_id = u.user_id
    LEFT JOIN lab_technicians lt ON lt.user_id = u.user_id
    LEFT JOIN hospital_managers hm ON hm.user_id = u.user_id
    WHERE u.organization_id = ${req.user.org_id}
      AND u.deleted_at IS NULL
    ORDER BY u.created_at DESC
  `;

  res.status(200).json({ status: 'success', data: { staff } });
});

export const updateStaffStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const { userId } = req.params;
  const val = updateUserStatusSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  // Bug-fix: prevent a manager from changing their own status (self-lockout)
  if (userId === req.user.user_id) {
    return next(new AppError('ERROR_CANNOT_UPDATE_OWN_STATUS', 403));
  }

  // Bug-fix: prevent deactivating/suspending the last active manager in the org
  if (val.data.status !== 'ACTIVE') {
    const [targetManager] = await sql`
      SELECT manager_id FROM hospital_managers
      WHERE user_id = ${userId} LIMIT 1
    `;

    if (targetManager) {
      const [{ count }] = await sql`
        SELECT COUNT(*)::int AS count
        FROM hospital_managers hm
        JOIN users u ON u.user_id = hm.user_id
        WHERE u.organization_id = ${req.user.org_id}
          AND u.status = 'ACTIVE'
          AND u.deleted_at IS NULL
          AND u.user_id != ${userId}
      `;

      if (count === 0) {
        return next(new AppError('ERROR_LAST_ACTIVE_MANAGER', 409));
      }
    }
  }

  // Ensure user belongs to the same org
  const [user] = await sql`
    UPDATE users SET status = ${val.data.status}
    WHERE user_id = ${userId}
      AND organization_id = ${req.user.org_id}
      AND deleted_at IS NULL
    RETURNING user_id, status
  `;

  if (!user) return next(new AppError('ERROR_USER_NOT_FOUND', 404));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_STATUS_UPDATED',
    data: { user },
  });
});

export const deleteStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const { userId } = req.params;

  if (userId === req.user.user_id) {
    return next(new AppError('ERROR_CANNOT_DELETE_SELF', 403)); // Will need translation if required
  }

  // Check if target is last manager
  const [targetManager] = await sql`
    SELECT manager_id FROM hospital_managers
    WHERE user_id = ${userId} LIMIT 1
  `;

  if (targetManager) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM hospital_managers hm
      JOIN users u ON u.user_id = hm.user_id
      WHERE u.organization_id = ${req.user.org_id}
        AND u.status = 'ACTIVE'
        AND u.deleted_at IS NULL
        AND u.user_id != ${userId}
    `;

    if (count === 0) {
      return next(new AppError('ERROR_LAST_ACTIVE_MANAGER', 409));
    }
  }

  const [user] = await sql`
    UPDATE users SET deleted_at = NOW()
    WHERE user_id = ${userId}
      AND organization_id = ${req.user.org_id}
      AND deleted_at IS NULL
    RETURNING user_id
  `;

  if (!user) return next(new AppError('ERROR_USER_NOT_FOUND', 404));

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_DELETED',
  });
});

export const updateStaffProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const { userId } = req.params;
  const val = updateProfileSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { username, department_id } = val.data;

  // Check if user exists
  const [user] = await sql`
    SELECT user_id FROM users
    WHERE user_id = ${userId} AND organization_id = ${req.user.org_id} AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!user) return next(new AppError('ERROR_USER_NOT_FOUND', 404));

  await sql.begin(async (tx) => {
    if (username !== undefined || department_id !== undefined) {
      if (username !== undefined && department_id !== undefined) {
        await tx`UPDATE users SET username = ${username}, department_id = ${department_id} WHERE user_id = ${userId}`;
      } else if (username !== undefined) {
        await tx`UPDATE users SET username = ${username} WHERE user_id = ${userId}`;
      } else if (department_id !== undefined) {
        await tx`UPDATE users SET department_id = ${department_id} WHERE user_id = ${userId}`;
      }
    }
  });

  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_SAVED' });
});

// ─── Departments ──────────────────────────────────────────────────────────────

export const createDepartment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const val = departmentSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const [dept] = await sql`
    INSERT INTO departments (organization_id, name)
    VALUES (${req.user.org_id}, ${val.data.name})
    RETURNING department_id, name, created_at
  `;

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_DEPT_CREATED',
    data: { department: dept },
  });
});

// ─── Reports / Analytics ──────────────────────────────────────────────────────

export const getReports = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const orgId = req.user.org_id;

  // Staff count by role
  const [staffCounts] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE d.doctor_id IS NOT NULL)  AS doctors,
      COUNT(*) FILTER (WHERE lt.technician_id IS NOT NULL) AS lab_techs,
      COUNT(*) FILTER (WHERE hm.manager_id IS NOT NULL) AS managers,
      COUNT(*) AS total
    FROM users u
    LEFT JOIN doctors d ON d.user_id = u.user_id
    LEFT JOIN lab_technicians lt ON lt.user_id = u.user_id
    LEFT JOIN hospital_managers hm ON hm.user_id = u.user_id
    WHERE u.organization_id = ${orgId}
      AND u.deleted_at IS NULL
      AND u.status = 'ACTIVE'
  `;

  // Lab test stats (last 30 days)
  const [labStats] = await sql`
    SELECT
      COUNT(*)                                         AS total_tests,
      COUNT(*) FILTER (WHERE lt.status = 'PENDING')   AS pending,
      COUNT(*) FILTER (WHERE lt.status = 'COMPLETED') AS completed,
      COUNT(*) FILTER (
        WHERE ltr.flag = 'CRITICAL'
      ) AS critical_results
    FROM lab_tests lt
    LEFT JOIN lab_test_results ltr ON ltr.test_id = lt.test_id
    WHERE lt.requested_by IN (
        SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL
      )
      AND lt.ordered_at >= NOW() - INTERVAL '30 days'
      AND lt.deleted_at IS NULL
  `;

  // Prediction stats (last 30 days)
  const [predStats] = await sql`
    SELECT
      COUNT(*) AS total_predictions,
      COUNT(*) FILTER (WHERE pres.risk_level = 'CRITICAL') AS critical,
      COUNT(*) FILTER (WHERE pres.risk_level = 'HIGH')     AS high,
      COUNT(*) FILTER (WHERE pres.risk_level = 'MODERATE') AS moderate,
      COUNT(*) FILTER (WHERE pres.risk_level = 'LOW')      AS low
    FROM prediction_requests pr
    LEFT JOIN prediction_results pres ON pres.request_id = pr.request_id
    WHERE pr.requested_by IN (
        SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL
      )
      AND pr.created_at >= NOW() - INTERVAL '30 days'
  `;

  // Usage for current cycle
  const [usageStats] = await sql`
    SELECT ur.prediction_used, ur.prediction_overage, pf.value AS prediction_limit
    FROM subscriptions s
    JOIN usage_records ur ON ur.subscription_id = s.subscription_id
    LEFT JOIN plan_features pf
      ON pf.plan_id = s.plan_id AND pf.name = 'predictions_per_month'
    WHERE s.organization_id = ${orgId}
      AND s.status = 'ACTIVE'
      AND ur.cycle_start <= NOW()::DATE
      AND ur.cycle_end >= NOW()::DATE
    LIMIT 1
  `;

  res.status(200).json({
    status: 'success',
    data: {
      reports: {
        staffCounts,
        labStats,
        predStats,
        usageStats: usageStats ?? null,
      },
    },
  });
});

// ─── Lab order reassignment ───────────────────────────────────────────────────

const reassignSchema = z.object({
  technician_id: z.string().uuid({ message: 'ERR_TECH_INVALID' }),
});

// PATCH /api/manager/lab-orders/:testId/reassign
// Allows a manager to assign or reassign a lab order to a specific technician.
export const reassignLabOrder = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

  const { testId } = req.params;
  const orgId = req.user.org_id;

  const val = reassignSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  const { technician_id } = val.data;

  // Verify the tech belongs to the same org
  const [tech] = await sql`
    SELECT lt.technician_id, u.user_id
    FROM lab_technicians lt
    JOIN users u ON u.user_id = lt.user_id
    WHERE lt.technician_id = ${technician_id}
      AND u.organization_id = ${orgId}
      AND u.deleted_at IS NULL
    LIMIT 1
  `;
  if (!tech) return next(new AppError('ERROR_TECH_NOT_FOUND', 404));

  // Verify the test belongs to the org and is not yet completed/cancelled
  const [existing] = await sql`
    SELECT test_id, status FROM lab_tests lt
    WHERE lt.test_id = ${testId}
      AND lt.deleted_at IS NULL
      AND lt.requested_by IN (
          SELECT user_id FROM users WHERE organization_id = ${orgId} AND deleted_at IS NULL
        )
    LIMIT 1
  `;
  if (!existing) return next(new AppError('ERROR_ORDER_NOT_FOUND', 404));
  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    return next(new AppError('ERROR_ORDER_NOT_CLAIMABLE', 409));
  }

  const [order] = await sql`
    UPDATE lab_tests
    SET assigned_to = ${technician_id},
        assigned_at = NOW(),
        status      = CASE WHEN status = 'PENDING' THEN 'INPROGRESS' ELSE status END
    WHERE test_id = ${testId}
    RETURNING test_id, status, assigned_to, assigned_at
  `;

  // Notify the newly assigned tech
  await sql`
    INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
    SELECT lt.patient_id, ${tech.user_id}, 'NEW_LAB_ORDER',
           ${'A lab order has been assigned to you by the manager.'}
    FROM lab_tests lt WHERE lt.test_id = ${testId}
  `;

  res.status(200).json({
    status: 'success',
    messageKey: 'SUCCESS_ORDER_REASSIGNED',
    data: { order },
  });
});
