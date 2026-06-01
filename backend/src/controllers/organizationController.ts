import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

const registerOrgSchema = z.object({
  username:       z.string().min(3,  { message: 'ERR_USERNAME_TOO_SHORT' }),
  email:          z.string().email({ message: 'ERR_EMAIL_INVALID' }),
  password:       z.string().min(8,  { message: 'ERR_PASSWORD_TOO_SHORT' }),
  preferred_lang: z.enum(['en','ar']).default('en'),
  org_name:       z.string().min(2,  { message: 'ERR_NAME_TOO_SHORT' }),
  org_type:       z.enum(['HOSPITAL','CLINIC','LAB','OTHER'], { message: 'ERR_TYPE_INVALID' }),
  org_email:      z.string().email({ message: 'ERR_ORG_EMAIL_INVALID' }),
  org_address:    z.string().optional(),
  plan_id:        z.string().uuid({ message: 'ERR_PLAN_INVALID' }),
});

const createDeptSchema = z.object({
  name: z.string().min(2, { message: 'ERR_NAME_TOO_SHORT' }),
  icon: z.string().optional(),
});

const updateDeptSchema = z.object({
  name: z.string().min(2, { message: 'ERR_NAME_TOO_SHORT' }).optional(),
  icon: z.string().optional(),
});

export const registerOrganization = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = registerOrgSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const {
      username, email, password, preferred_lang,
      org_name, org_type, org_email, org_address,
      plan_id,
    } = val.data;

    const [conflict] = await sql`
      SELECT user_id FROM users
      WHERE (email = ${email} OR username = ${username})
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (conflict) return next(new AppError('ERROR_ACCOUNT_EXISTS', 409));

    const [plan] = await sql`
      SELECT plan_id, name, is_trial FROM plans
      WHERE plan_id = ${plan_id} AND is_active = TRUE AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!plan) return next(new AppError('ERROR_PLAN_NOT_FOUND', 404));

    const [org] = await sql`
      INSERT INTO organizations (name, type, email, address)
      VALUES (${org_name}, ${org_type}, ${org_email}, ${org_address ?? null})
      RETURNING organization_id, name
    `;

    const cycleIntervalDays = plan.is_trial ? 14 : 30;

    const [subscription] = await sql`
      INSERT INTO subscriptions (
        organization_id, plan_id, status,
        current_cycle_start, current_cycle_end, trial_end_at
      )
      VALUES (
        ${org.organization_id},
        ${plan_id},
        'ACTIVE',
        NOW()::DATE,
        NOW()::DATE + (${cycleIntervalDays} || ' days')::INTERVAL,
        ${plan.is_trial ? sql`NOW()::DATE + INTERVAL '14 days'` : null as unknown as null}
      )
      RETURNING subscription_id, current_cycle_end
    `;

    await sql`
      INSERT INTO usage_records (subscription_id, cycle_start, cycle_end)
      VALUES (
        ${subscription.subscription_id},
        NOW()::DATE,
        ${subscription.current_cycle_end}
      )
    `;

    const password_hash = await bcrypt.hash(password, 12);

    const [user] = await sql`
      INSERT INTO users (username, email, password_hash, organization_id, preferred_lang, status)
      VALUES (
        ${username}, ${email}, ${password_hash},
        ${org.organization_id}, ${preferred_lang}, 'ACTIVE'
      )
      RETURNING user_id
    `;

    const [manager] = await sql`
      INSERT INTO hospital_managers (user_id)
      VALUES (${user.user_id})
      RETURNING manager_id
    `;

    res.status(201).json({
      status:     'success',
      messageKey: 'SUCCESS_ORG_REGISTERED',
      data: {
        org_id:     org.organization_id,
        org_name:   org.name,
        manager_id: manager.manager_id,
        plan_name:  plan.name,
        is_trial:   plan.is_trial,
      },
    });
  }
);

// ─── Departments ──────────────────────────────────────────────────────────────

export const getDepartments = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const departments = await sql`
      SELECT department_id, name, icon, created_at
      FROM departments
      WHERE organization_id = ${req.user.org_id}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    res.status(200).json({ status: 'success', data: { departments } });
  }
);

export const createDepartment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const val = createDeptSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const [dept] = await sql`
      INSERT INTO departments (organization_id, name, icon)
      VALUES (${req.user.org_id}, ${val.data.name}, ${val.data.icon ?? 'Building2'})
      RETURNING department_id, name, icon, created_at
    `;

    res.status(201).json({
      status: 'success', messageKey: 'SUCCESS_DEPT_CREATED',
      data: { department: dept },
    });
  }
);

export const updateDepartment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const { departmentId } = req.params;
    const val = updateDeptSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    // Build partial update — only set fields that were sent
    const { name, icon } = val.data;
    const [dept] = await sql`
      UPDATE departments
      SET
        name = COALESCE(${name ?? null}, name),
        icon = COALESCE(${icon ?? null}, icon)
      WHERE department_id   = ${departmentId}
        AND organization_id = ${req.user.org_id}
        AND deleted_at IS NULL
      RETURNING department_id, name, icon, created_at
    `;

    if (!dept) return next(new AppError('ERROR_DEPT_NOT_FOUND', 404));

    res.status(200).json({
      status: 'success', messageKey: 'SUCCESS_DEPT_UPDATED',
      data: { department: dept },
    });
  }
);

export const deleteDepartment = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const { departmentId } = req.params;

    const [dept] = await sql`
      UPDATE departments
      SET deleted_at = NOW()
      WHERE department_id   = ${departmentId}
        AND organization_id = ${req.user.org_id}
        AND deleted_at IS NULL
      RETURNING department_id
    `;

    if (!dept) return next(new AppError('ERROR_DEPT_NOT_FOUND', 404));

    res.status(200).json({
      status: 'success', messageKey: 'SUCCESS_DEPT_DELETED',
    });
  }
);

export const getDepartmentMembers = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const { departmentId } = req.params;

    // Verify dept belongs to this org
    const [dept] = await sql`
      SELECT department_id FROM departments
      WHERE department_id   = ${departmentId}
        AND organization_id = ${req.user.org_id}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!dept) return next(new AppError('ERROR_DEPT_NOT_FOUND', 404));

    const members = await sql`
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.status,
        CASE
          WHEN d.doctor_id      IS NOT NULL THEN 'DOCTOR'
          WHEN lt.technician_id IS NOT NULL THEN 'LAB_TECH'
          ELSE 'UNKNOWN'
        END AS role
      FROM users u
      LEFT JOIN doctors         d  ON d.user_id      = u.user_id
      LEFT JOIN lab_technicians lt ON lt.user_id     = u.user_id
      WHERE u.department_id = ${departmentId}
        AND u.organization_id = ${req.user.org_id}
        AND u.deleted_at IS NULL
      ORDER BY role, u.username
    `;

    res.status(200).json({ status: 'success', data: { members } });
  }
);
