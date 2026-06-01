import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { sendInvitationEmail, sendWelcomeEmail } from '../services/emailService.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email:   z.string().email({ message: 'ERR_EMAIL_INVALID' }),
  role:    z.enum(['DOCTOR','LAB_TECH','MANAGER'], { message: 'ERR_ROLE_INVALID' }),
  dept_id: z.string().uuid({ message: 'ERR_DEPT_INVALID' }).optional(),
});

const activateSchema = z.object({
  username: z.string().min(3, { message: 'ERR_USERNAME_TOO_SHORT' }),
  password: z.string().min(8, { message: 'ERR_PASSWORD_TOO_SHORT' }),
});

// ─── POST /api/invitations ────────────────────────────────────────────────────
/**
 * Image 3 + Image 4 Phase 3 — Invite a staff member.
 * Middleware chain: authenticate → requireRole(MANAGER) → checkUserLimit → inviteStaff
 */
export const inviteStaff = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const val = inviteSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const { email, role, dept_id } = val.data;

    const limitCtx = (req as Request & {
      userLimitCtx?: {
        subscription_id: string; plan_id: string; is_trial: boolean;
        max_users: number | null; current_count: number; isUserOverage: boolean;
      };
    }).userLimitCtx;

    // Prevent duplicate pending invite
    const [existing] = await sql`
      SELECT invitation_id FROM invitations
      WHERE email           = ${email}
        AND organization_id = ${req.user.org_id}
        AND activated_at IS NULL
        AND expires_at > NOW()
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing) return next(new AppError('ERROR_INVITATION_ALREADY_SENT', 409));

    // Fetch org name + inviter name for email copy
    const [meta] = await sql`
      SELECT o.name AS org_name, u.username AS inviter_name
      FROM organizations o
      JOIN users u ON u.user_id = ${req.user.user_id}
      WHERE o.organization_id = ${req.user.org_id}
      LIMIT 1
    `;

    // Image 3: paid plan AND count >= max_users → INSERT OverageEvent
    if (limitCtx?.isUserOverage) {
      await sql`
        INSERT INTO overage_events (usage_id, event_type, metadata)
        SELECT ur.usage_id,
               'USER_ADDED',
               ${JSON.stringify({ role, qty: 1 })}
        FROM usage_records ur
        JOIN subscriptions s ON s.subscription_id = ur.subscription_id
        WHERE s.organization_id = ${req.user.org_id}
          AND s.status = 'ACTIVE'
          AND ur.cycle_start <= NOW()::DATE
          AND ur.cycle_end   >= NOW()::DATE
        LIMIT 1
      `;
    }

    // Generate secure token
    const rawToken  = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invitation] = await sql`
      INSERT INTO invitations (
        email, role, organization_id, department_id,
        invited_by, token_hash, expires_at
      )
      VALUES (
        ${email}, ${role}, ${req.user.org_id},
        ${dept_id ?? null}, ${req.user.user_id},
        ${tokenHash}, ${expiresAt.toISOString()}
      )
      RETURNING invitation_id
    `;

    // Send invitation email
    const activationUrl = `${process.env.CLIENT_URL}/activate/${rawToken}`;
    await sendInvitationEmail({
      to:              email,
      org_name:        meta?.org_name    ?? 'Your Organization',
      role,
      activation_url:  activationUrl,
      invited_by_name: meta?.inviter_name ?? 'Your administrator',
      expires_in_days: 7,
    });

    res.status(201).json({
      status:     'success',
      messageKey: limitCtx?.isUserOverage
        ? 'SUCCESS_INVITATION_SENT_OVERAGE'
        : 'SUCCESS_INVITATION_SENT',
      data: {
        invite_sent:   true,
        invitation_id: invitation.invitation_id,
        email,
        role,
        expires_at:    expiresAt.toISOString(),
        ...(limitCtx?.isUserOverage && {
          overage_notice: {
            message:       'User limit exceeded. Overage billing will apply.',
            current_count: limitCtx.current_count,
            max_users:     limitCtx.max_users,
          },
        }),
      },
    });
  }
);

// ─── GET /api/invitations ─────────────────────────────────────────────────────
export const getInvitations = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const invitations = await sql`
      SELECT
        i.invitation_id, i.email, i.role,
        i.department_id, d.name AS department_name,
        i.expires_at, i.activated_at, i.created_at,
        CASE
          WHEN i.activated_at IS NOT NULL THEN 'ACCEPTED'
          WHEN i.expires_at < NOW()       THEN 'EXPIRED'
          ELSE 'PENDING'
        END AS status
      FROM invitations i
      LEFT JOIN departments d ON d.department_id = i.department_id
      WHERE i.organization_id = ${req.user.org_id}
        AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC
    `;

    res.status(200).json({ status: 'success', data: { invitations } });
  }
);

// ─── PATCH /api/invitations/activate/:token ───────────────────────────────────
/**
 * Image 4 Phase 3 — Staff clicks invite link and sets their password.
 *
 * No auth_users table — user record is created directly in users with
 * password_hash stored on the row itself.
 */
export const activateInvitation = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params;

    const val = activateSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const { username, password } = val.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Resolve invitation
    const [invitation] = await sql`
      SELECT
        invitation_id, email, role,
        organization_id, department_id,
        activated_at, expires_at
      FROM invitations
      WHERE token_hash = ${tokenHash}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!invitation)
      return next(new AppError('ERROR_INVITATION_INVALID',      404));
    if (invitation.activated_at)
      return next(new AppError('ERROR_INVITATION_ALREADY_USED', 409));
    if (new Date(invitation.expires_at) < new Date())
      return next(new AppError('ERROR_INVITATION_EXPIRED',      410));

    // Guard against email already registered
    const [existingUser] = await sql`
      SELECT user_id FROM users
      WHERE email = ${invitation.email} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existingUser) return next(new AppError('ERROR_ACCOUNT_EXISTS', 409));

    // Guard against username collision
    const [existingUsername] = await sql`
      SELECT user_id FROM users
      WHERE username = ${username} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existingUsername) return next(new AppError('ERROR_USERNAME_TAKEN', 409));

    // Hash password and INSERT user — credentials on users table directly
    const password_hash = await bcrypt.hash(password, 12);

    const [user] = await sql`
      INSERT INTO users (
        username, email, password_hash,
        organization_id, department_id, status
      )
      VALUES (
        ${username}, ${invitation.email}, ${password_hash},
        ${invitation.organization_id}, ${invitation.department_id ?? null},
        'ACTIVE'
      )
      RETURNING user_id
    `;

    // INSERT role-specific subtype record
    if (invitation.role === 'DOCTOR') {
      await sql`INSERT INTO doctors (user_id) VALUES (${user.user_id})`;
    } else if (invitation.role === 'LAB_TECH') {
      await sql`INSERT INTO lab_technicians (user_id) VALUES (${user.user_id})`;
    } else if (invitation.role === 'MANAGER') {
      await sql`INSERT INTO hospital_managers (user_id) VALUES (${user.user_id})`;
    }

    // Mark invitation as activated
    await sql`
      UPDATE invitations
      SET activated_at = NOW(),
          activated_by = ${user.user_id}
      WHERE invitation_id = ${invitation.invitation_id}
    `;

    // Fetch org name for welcome email
    const [org] = await sql`
      SELECT name FROM organizations
      WHERE organization_id = ${invitation.organization_id}
      LIMIT 1
    `;

    // Send welcome email (non-blocking)
    sendWelcomeEmail({
      to:       invitation.email,
      username,
      role:     invitation.role,
      org_name: org?.name ?? 'Your Organization',
    }).catch(err => console.error('[EmailService] Welcome email failed:', err));

    // 200 { activated: true } → frontend redirects to role dashboard
    res.status(200).json({
      status:     'success',
      messageKey: 'SUCCESS_ACCOUNT_ACTIVATED',
      data: {
        activated: true,
        user_id:   user.user_id,
        email:     invitation.email,
        role:      invitation.role,
      },
    });
  }
);

// ─── DELETE /api/invitations/:invitationId ────────────────────────────────────
export const cancelInvitation = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.org_id) return next(new AppError('ERROR_NO_ORGANIZATION', 403));

    const { invitationId } = req.params;

    const [inv] = await sql`
      UPDATE invitations SET deleted_at = NOW()
      WHERE invitation_id   = ${invitationId}
        AND organization_id = ${req.user.org_id}
        AND activated_at IS NULL
        AND deleted_at   IS NULL
      RETURNING invitation_id
    `;

    if (!inv) return next(new AppError('ERROR_INVITATION_NOT_FOUND', 404));

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_INVITATION_CANCELLED' });
  }
);
