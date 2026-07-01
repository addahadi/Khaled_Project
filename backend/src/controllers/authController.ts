import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import type { JwtPayload } from '../middleware/authenticate.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signAccessToken(payload: Omit<JwtPayload, 'jti'>): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  return {
    token: jwt.sign({ ...payload, jti }, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '1h') as any,
    }),
    jti,
  };
}

function makeRefreshToken(userId: string) {
  const raw  = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const jwt_token = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as any }
  );
  return { raw, hash, jwt_token };
}

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   30 * 24 * 60 * 60 * 1000,
    path:     '/api/auth',
  });
}

/**
 * Determine role from which subtype table the user appears in.
 * Returns 'DOCTOR' | 'LAB_TECH' | 'MANAGER' | null.
 */
async function resolveRole(userId: string): Promise<JwtPayload['role'] | null> {
  const [row] = await sql`
    SELECT
      CASE
        WHEN d.doctor_id      IS NOT NULL THEN 'DOCTOR'
        WHEN lt.technician_id IS NOT NULL THEN 'LAB_TECH'
        WHEN hm.manager_id    IS NOT NULL THEN 'MANAGER'
        ELSE NULL
      END AS role
    FROM users u
    LEFT JOIN doctors            d  ON d.user_id       = u.user_id
    LEFT JOIN lab_technicians    lt ON lt.user_id       = u.user_id
    LEFT JOIN hospital_managers  hm ON hm.user_id       = u.user_id
    WHERE u.user_id = ${userId}
    LIMIT 1
  `;
  return (row?.role ?? null) as JwtPayload['role'] | null;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z.string().min(3,  { message: 'ERR_USERNAME_TOO_SHORT' }),
  email:    z.string().email({ message: 'ERR_EMAIL_INVALID' }),
  password: z.string().min(8,  { message: 'ERR_PASSWORD_TOO_SHORT' }),
  role:     z.enum(['DOCTOR', 'LAB_TECH', 'MANAGER'], { message: 'ERR_ROLE_INVALID' }),
  organization_id: z.string().uuid({ message: 'ERR_ORG_INVALID' }).optional(),
  department_id:   z.string().uuid({ message: 'ERR_DEPT_INVALID' }).optional(),
});

const loginSchema = z.object({
  email:    z.string().email({ message: 'ERR_EMAIL_INVALID' }),
  password: z.string().min(1, { message: 'ERR_PASSWORD_REQUIRED' }),
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'ERR_EMAIL_INVALID' }),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'ERR_TOKEN_REQUIRED' }),
  password: z.string().min(8, { message: 'ERR_PASSWORD_TOO_SHORT' }),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, { message: 'ERR_TOKEN_REQUIRED' }),
});

const updateProfileSchema = z.object({
  username: z.string().min(3, { message: 'ERR_USERNAME_TOO_SHORT' }),
  preferred_lang: z.enum(['en', 'ar']).optional(),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

export const register = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = registerSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const { username, email, password, role, organization_id, department_id } = val.data;

    // Check uniqueness against users table directly
    const [existing] = await sql`
      SELECT user_id FROM users
      WHERE (email = ${email} OR username = ${username})
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing) return next(new AppError('ERROR_ACCOUNT_EXISTS', 409));

    const password_hash = await bcrypt.hash(password, 12);

    // INSERT directly into users — no auth_users table
    const [user] = await sql`
      INSERT INTO users (username, email, password_hash, organization_id, department_id, status)
      VALUES (
        ${username}, ${email}, ${password_hash},
        ${organization_id ?? null}, ${department_id ?? null},
        'PENDING_VERIFICATION'
      )
      RETURNING user_id
    `;

    // INSERT role-specific subtype record
    if (role === 'DOCTOR') {
      await sql`INSERT INTO doctors (user_id) VALUES (${user.user_id})`;
    } else if (role === 'LAB_TECH') {
      await sql`INSERT INTO lab_technicians (user_id) VALUES (${user.user_id})`;
    } else if (role === 'MANAGER') {
      await sql`INSERT INTO hospital_managers (user_id) VALUES (${user.user_id})`;
    }

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');

    await sql`
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
      VALUES (${user.user_id}, ${verifyTokenHash}, NOW() + INTERVAL '24 hours')
    `;

    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verifyToken}`;
    sendVerificationEmail({ to: email, verify_url: verifyUrl }).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    res.status(201).json({ status: 'success', messageKey: 'SUCCESS_REGISTERED_CHECK_EMAIL' });
  }
);

export const login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = loginSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const { email, password } = val.data;

    // Fetch user with credentials from users table
    const [user] = await sql`
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.password_hash,
        u.failed_login_count,
        u.locked_until,
        u.organization_id,
        u.preferred_lang,
        u.status
      FROM users u
      WHERE u.email = ${email}
        AND u.deleted_at IS NULL
      LIMIT 1
    `;

    // Enumeration-safe: identical response for wrong email or wrong password
    const badCredentials = () => next(new AppError('ERROR_INVALID_CREDENTIALS', 401));

    if (!user) return badCredentials();

    // Brute-force lock
    if (user.locked_until) {
      if (new Date(user.locked_until) > new Date()) {
        return next(new AppError('ERROR_ACCOUNT_LOCKED', 423));
      } else {
        user.failed_login_count = 0;
        user.locked_until = null;
      }
    }

    // Account status check
    if (user.status !== 'ACTIVE') {
      return next(new AppError('ERROR_ACCOUNT_INACTIVE', 403));
    }

    const isMatch = await bcrypt.compare(password, user.password_hash ?? '');
    if (!isMatch) {
      const newCount  = (user.failed_login_count ?? 0) + 1;
      const lockUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await sql`
        UPDATE users
        SET failed_login_count = ${newCount},
            locked_until       = ${lockUntil}
        WHERE user_id = ${user.user_id}
      `;
      return badCredentials();
    }

    // Resolve role from subtype table
    const role = await resolveRole(user.user_id);
    if (!role) return next(new AppError('ERROR_ACCOUNT_INCOMPLETE', 403));

    // Reset failed login count
    await sql`
      UPDATE users
      SET failed_login_count = 0,
          locked_until       = NULL,
          last_login_at      = NOW()
      WHERE user_id = ${user.user_id}
    `;

    // Issue tokens
    const payload: Omit<JwtPayload, 'jti'> = {
      user_id: user.user_id,
      org_id:  user.organization_id,
      role,
    };
    const { token: accessToken }    = signAccessToken(payload);
    const { raw, hash, jwt_token }  = makeRefreshToken(user.user_id);

    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
      VALUES (
        ${user.user_id},
        ${hash},
        ${JSON.stringify({ userAgent: req.headers['user-agent'] ?? null })}::jsonb,
        ${req.ip ?? null},
        NOW() + INTERVAL '7 days'
      )
    `;

    setRefreshCookie(res, raw);

    res.status(200).json({
      status:     'success',
      messageKey: 'SUCCESS_LOGIN',
      data: {
        accessToken,
        user: {
          user_id:        user.user_id,
          username:       user.username,
          email:          user.email,
          role,
          org_id:         user.organization_id,
          preferred_lang: user.preferred_lang,
        },
      },
    });
  }
);

export const refresh = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rawToken: string | undefined = req.cookies?.refreshToken;
    if (!rawToken) return next(new AppError('ERROR_NO_REFRESH_TOKEN', 401));

    let decoded: { sub: string };
    try {
      decoded = jwt.verify(rawToken, process.env.JWT_REFRESH_SECRET!) as { sub: string };
    } catch {
      return next(new AppError('ERROR_TOKEN_INVALID', 401));
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const [stored] = await sql`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
      RETURNING id, user_id, family, expires_at
    `;

    if (!stored) {
      const [existing] = await sql`
        SELECT family FROM refresh_tokens WHERE token_hash = ${tokenHash} LIMIT 1
      `;
      if (!existing) return next(new AppError('ERROR_TOKEN_INVALID', 401));

      // Reuse detection: revoke entire family
      await sql`
        UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE family = ${existing.family}
      `;
      return next(new AppError('ERROR_TOKEN_REUSE_DETECTED', 401));
    }

    if (new Date(stored.expires_at) < new Date()) {
      return next(new AppError('ERROR_TOKEN_EXPIRED', 401));
    }

    // Fetch user
    const [user] = await sql`
      SELECT user_id, username, email, organization_id, preferred_lang, status
      FROM users
      WHERE user_id = ${decoded.sub} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!user || user.status !== 'ACTIVE') return next(new AppError('ERROR_USER_NOT_FOUND', 404));

    const role = await resolveRole(user.user_id);
    if (!role) return next(new AppError('ERROR_ACCOUNT_INCOMPLETE', 403));

    const { token: accessToken }   = signAccessToken({ user_id: user.user_id, org_id: user.organization_id, role });
    const { raw: newRaw, hash: newHash } = makeRefreshToken(user.user_id);

    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, family, device_info, ip_address, expires_at)
      VALUES (
        ${user.user_id}, ${newHash}, ${stored.family},
        ${JSON.stringify({ userAgent: req.headers['user-agent'] ?? null })}::jsonb,
        ${req.ip ?? null},
        NOW() + INTERVAL '7 days'
      )
    `;

    setRefreshCookie(res, newRaw);

    res.status(200).json({
      status: 'success',
      data: {
        accessToken,
        user: {
          user_id:        user.user_id,
          username:       user.username,
          email:          user.email,
          role,
          org_id:         user.organization_id,
          preferred_lang: user.preferred_lang,
        },
      },
    });
  }
);

export const logout = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const rawToken: string | undefined = req.cookies?.refreshToken;

    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await sql`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ${tokenHash}`;
    }

    // Blacklist the current access token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.decode(token) as { jti?: string; exp?: number };
        if (decoded?.jti && decoded?.exp) {
          await sql`
            INSERT INTO token_blacklist (jti, expires_at)
            VALUES (${decoded.jti}, TO_TIMESTAMP(${decoded.exp}))
            ON CONFLICT (jti) DO NOTHING
          `;
        }
      } catch { /* ignore */ }
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      path:     '/api/auth',
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_LOGOUT' });
  }
);

export const getMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const [user] = await sql`
      SELECT
        u.user_id, u.username, u.email, u.organization_id,
        u.department_id, u.preferred_lang, u.status,
        o.name AS org_name,
        CASE
          WHEN d.doctor_id      IS NOT NULL THEN 'DOCTOR'
          WHEN lt.technician_id IS NOT NULL THEN 'LAB_TECH'
          WHEN hm.manager_id    IS NOT NULL THEN 'MANAGER'
          ELSE NULL
        END AS role
      FROM users u
      LEFT JOIN organizations     o  ON o.organization_id = u.organization_id
      LEFT JOIN doctors            d  ON d.user_id = u.user_id
      LEFT JOIN lab_technicians    lt ON lt.user_id = u.user_id
      LEFT JOIN hospital_managers  hm ON hm.user_id = u.user_id
      WHERE u.user_id = ${req.user!.user_id}
        AND u.deleted_at IS NULL
      LIMIT 1
    `;

    if (!user) return next(new AppError('ERROR_USER_NOT_FOUND', 404));

    res.status(200).json({ status: 'success', data: { user } });
  }
);

export const forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = forgotPasswordSchema.safeParse(req.body);
    if (!val.success) return next(new AppError('ERROR_VALIDATION_FAILED', 422));

    const { email } = val.data;

    const [user] = await sql`SELECT user_id, status FROM users WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`;
    if (!user || user.status !== 'ACTIVE') {
      // Return success anyway to prevent email enumeration
      return res.status(200).json({ status: 'success', messageKey: 'SUCCESS_PASSWORD_RESET_EMAIL_SENT' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.user_id}, ${tokenHash}, NOW() + INTERVAL '1 hour')
    `;

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Fire & forget email
    sendPasswordResetEmail({ to: email, reset_url: resetUrl }).catch(err => {
      console.error('Failed to send password reset email:', err);
    });

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_PASSWORD_RESET_EMAIL_SENT' });
  }
);

export const resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = resetPasswordSchema.safeParse(req.body);
    if (!val.success) return next(new AppError('ERROR_VALIDATION_FAILED', 422));

    const { token, password } = val.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [storedToken] = await sql`
      SELECT token_id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (!storedToken || storedToken.used_at || new Date(storedToken.expires_at) < new Date()) {
      return next(new AppError('ERROR_TOKEN_INVALID', 400));
    }

    const password_hash = await bcrypt.hash(password, 12);

    await sql.begin(async (tx) => {
      await tx`UPDATE users SET password_hash = ${password_hash} WHERE user_id = ${storedToken.user_id}`;
      await tx`UPDATE password_reset_tokens SET used_at = NOW() WHERE token_id = ${storedToken.token_id}`;
    });

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_PASSWORD_RESET' });
  }
);

export const updateProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = updateProfileSchema.safeParse(req.body);
    if (!val.success) {
      const fields: Record<string, string> = {};
      val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }

    const { username, preferred_lang } = val.data;

    const [existing] = await sql`
      SELECT user_id FROM users
      WHERE username = ${username} AND user_id != ${req.user!.user_id} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing) return next(new AppError('ERROR_USERNAME_EXISTS', 409));

    await sql`
      UPDATE users
      SET username = ${username},
          preferred_lang = ${preferred_lang ?? 'en'},
          updated_at = NOW()
      WHERE user_id = ${req.user!.user_id}
    `;

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_PROFILE_UPDATED' });
  }
);

export const verifyEmail = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const val = verifyEmailSchema.safeParse(req.body);
    if (!val.success) return next(new AppError('ERROR_VALIDATION_FAILED', 422));

    const { token } = val.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [storedToken] = await sql`
      SELECT token_id, user_id, expires_at, used_at
      FROM email_verification_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (!storedToken || storedToken.used_at || new Date(storedToken.expires_at) < new Date()) {
      return next(new AppError('ERROR_TOKEN_INVALID', 400));
    }

    await sql.begin(async (tx) => {
      await tx`UPDATE users SET status = 'ACTIVE' WHERE user_id = ${storedToken.user_id}`;
      await tx`UPDATE email_verification_tokens SET used_at = NOW() WHERE token_id = ${storedToken.token_id}`;
    });

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_EMAIL_VERIFIED' });
  }
);

export const getSessions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const sessions = await sql`
      SELECT id, device_info, ip_address, created_at, expires_at, family
      FROM refresh_tokens
      WHERE user_id = ${req.user!.user_id}
        AND revoked_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
    res.status(200).json({ status: 'success', data: { sessions } });
  }
);

export const revokeSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id) return next(new AppError('ERROR_INVALID_REQUEST', 400));

    // Find family by id, revoke all tokens in family
    const [stored] = await sql`
      SELECT family FROM refresh_tokens
      WHERE id = ${id} AND user_id = ${req.user!.user_id}
      LIMIT 1
    `;

    if (!stored) return next(new AppError('ERROR_NOT_FOUND', 404));

    await sql`
      UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE family = ${stored.family}
    `;

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_SESSION_REVOKED' });
  }
);

export const revokeOtherSessions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rawToken: string | undefined = req.cookies?.refreshToken;
    if (!rawToken) return next(new AppError('ERROR_NO_REFRESH_TOKEN', 401));

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const [stored] = await sql`
      SELECT family FROM refresh_tokens WHERE token_hash = ${tokenHash} LIMIT 1
    `;

    if (!stored) return next(new AppError('ERROR_TOKEN_INVALID', 401));

    await sql`
      UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE user_id = ${req.user!.user_id} AND family != ${stored.family}
    `;

    res.status(200).json({ status: 'success', messageKey: 'SUCCESS_OTHER_SESSIONS_REVOKED' });
  }
);
