/**
 * Email service — uses Nodemailer with SMTP (e.g. Gmail).
 * Add to .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=your_app_password
 *   FROM_EMAIL=DiagInfect <you@gmail.com>
 *
 * Falls back to console.log when SMTP_PASS is not set (dev/test).
 */

import nodemailer from 'nodemailer';

interface InvitationEmailOpts {
  to:               string;
  org_name:         string;
  role:             string;
  activation_url:   string;
  invited_by_name:  string;
  expires_in_days?: number;
}

interface WelcomeEmailOpts {
  to:       string;
  username: string;
  role:     string;
  org_name: string;
}

interface PasswordResetEmailOpts {
  to: string;
  reset_url: string;
}

interface VerificationEmailOpts {
  to: string;
  verify_url: string;
}

interface SubscriptionChangeEmailOpts {
  to: string;
  verify_url: string;
  plan_name: string;
}

// ─── Role label helper ────────────────────────────────────────────────────────
function roleLabel(role: string): string {
  return role === 'LAB_TECH' ? 'Lab Technician'
    : role === 'DOCTOR'  ? 'Doctor'
    : role === 'MANAGER' ? 'Hospital Manager'
    : role;
}

// ─── Nodemailer transporter (created once, reused) ────────────────────────────
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_PASS) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10_000,  // 10s to establish connection
      greetingTimeout:   10_000,  // 10s for SMTP greeting
      socketTimeout:     10_000,  // 10s for socket inactivity
    } as any);
  }

  return transporter;
}

// ─── HTML templates ───────────────────────────────────────────────────────────
function invitationHtml(opts: InvitationEmailOpts): string {
  const { org_name, role, activation_url, invited_by_name, expires_in_days = 7 } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You've been invited to DiagInfect</title></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:#1d4ed8;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:8px;">
          <span style="color:#fff;font-size:18px;font-weight:700;">DI</span>
        </div>
        <span style="color:#fff;font-size:20px;font-weight:700;">DiagInfect</span>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">You've been invited!</h1>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
        <strong>${invited_by_name}</strong> has invited you to join
        <strong>${org_name}</strong> on DiagInfect as a
        <strong>${roleLabel(role)}</strong>.
      </p>

      <a href="${activation_url}"
         style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                font-weight:600;font-size:15px;padding:13px 28px;border-radius:8px;">
        Accept Invitation &amp; Set Password
      </a>

      <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
        This link expires in ${expires_in_days} days. If you weren't expecting this invitation,
        you can safely ignore this email.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:8px 0 0;word-break:break-all;">
        Or copy this link: ${activation_url}
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © ${new Date().getFullYear()} DiagInfect. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function welcomeHtml(opts: WelcomeEmailOpts): string {
  const { username, role, org_name } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome to DiagInfect</title></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">DiagInfect</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Welcome, ${username}!</h1>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Your account as <strong>${roleLabel(role)}</strong> at
        <strong>${org_name}</strong> is now active. Sign in to get started.
      </p>
      <a href="${process.env.CLIENT_URL}/login"
         style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                font-weight:600;font-size:15px;padding:13px 28px;border-radius:8px;">
        Sign In to DiagInfect
      </a>
    </div>
  </div>
</body>
</html>`;
}

function passwordResetHtml(opts: PasswordResetEmailOpts): string {
  const { reset_url } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset Your Password</title></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">DiagInfect</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Reset Your Password</h1>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Click the button below to set a new password.
      </p>
      <a href="${reset_url}"
         style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                font-weight:600;font-size:15px;padding:13px 28px;border-radius:8px;">
        Reset Password
      </a>
      <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function verificationHtml(opts: VerificationEmailOpts): string {
  const { verify_url } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify Your Email Address</title></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">DiagInfect</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Verify Your Email Address</h1>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Thank you for registering. Please click the button below to verify your email address and activate your account.
      </p>
      <a href="${verify_url}"
         style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                font-weight:600;font-size:15px;padding:13px 28px;border-radius:8px;">
        Verify Email Address
      </a>
      <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function subscriptionChangeHtml(opts: SubscriptionChangeEmailOpts): string {
  const { verify_url, plan_name } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Confirm Subscription Change</title></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">DiagInfect</span>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Confirm Subscription Change</h1>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
        You have requested to change your organization's subscription to the <strong>${plan_name}</strong> plan. 
        Please click the button below to confirm and apply the change.
      </p>
      <a href="${verify_url}"
         style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
                font-weight:600;font-size:15px;padding:13px 28px;border-radius:8px;">
        Confirm Plan Change
      </a>
      <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;">
        If you didn't request this change, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Send via Nodemailer (or console.log in dev) ──────────────────────────────
async function send(opts: { to: string; subject: string; html: string }): Promise<void> {
  const mailer = getTransporter();
  const from   = process.env.FROM_EMAIL ?? 'DiagInfect <no-reply@diaginfect.dz>';

  if (!mailer) {
    console.warn('[EmailService] SMTP_PASS not set — logging email instead');
    console.log(`  TO:      ${opts.to}`);
    console.log(`  SUBJECT: ${opts.subject}`);
    return;
  }

  const info = await mailer.sendMail({
    from,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
  });

  console.log('[EmailService] Email sent:', info.messageId);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function sendInvitationEmail(opts: InvitationEmailOpts): Promise<void> {
  await send({
    to:      opts.to,
    subject: `You've been invited to join ${opts.org_name} on DiagInfect`,
    html:    invitationHtml(opts),
  });
}

export async function sendWelcomeEmail(opts: WelcomeEmailOpts): Promise<void> {
  await send({
    to:      opts.to,
    subject: `Welcome to DiagInfect — your account is ready`,
    html:    welcomeHtml(opts),
  });
}

export async function sendPasswordResetEmail(opts: PasswordResetEmailOpts): Promise<void> {
  await send({
    to:      opts.to,
    subject: `Reset your DiagInfect password`,
    html:    passwordResetHtml(opts),
  });
}

export async function sendVerificationEmail(opts: VerificationEmailOpts): Promise<void> {
  await send({
    to:      opts.to,
    subject: `Verify your DiagInfect email address`,
    html:    verificationHtml(opts),
  });
}

export async function sendSubscriptionChangeEmail(opts: SubscriptionChangeEmailOpts): Promise<void> {
  await send({
    to:      opts.to,
    subject: `Confirm your subscription change to ${opts.plan_name}`,
    html:    subscriptionChangeHtml(opts),
  });
}
