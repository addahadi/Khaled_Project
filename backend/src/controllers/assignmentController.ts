import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createAssignmentSchema = z.object({
  doctor_id:   z.string().uuid({ message: 'ERR_DOCTOR_INVALID' }),
  role:        z.enum(['CONSULTING', 'COVERING'], { message: 'ERR_ROLE_INVALID' }),
  notes:       z.string().max(500).optional(),
  valid_until: z.string().datetime({ offset: true }).optional(),
}).refine(data => {
  if (data.role === 'COVERING' && !data.valid_until) return false;
  return true;
}, { message: 'ERR_VALID_UNTIL_REQUIRED_FOR_COVERING', path: ['valid_until'] });


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the patient if it belongs to the requesting doctor's org, or 404. */
async function requireOrgPatient(
  patientId: string,
  orgId: string | null,
  next: NextFunction,
) {
  const [patient] = await sql`
    SELECT patient_id FROM patients
    WHERE  patient_id      = ${patientId}
      AND  deleted_at      IS NULL
      ${orgId ? sql`AND organization_id = ${orgId}` : sql``}
    LIMIT  1
  `;
  if (!patient) { next(new AppError('ERROR_PATIENT_NOT_FOUND', 404)); return null; }
  return patient;
}

// ─── GET /doctor/patients/:patientId/assignments ──────────────────────────────

export const getAssignments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;

  if (!(await requireOrgPatient(patientId, req.user!.org_id, next))) return;

  const assignments = await sql`
    SELECT
      pa.assignment_id,
      pa.role,
      pa.assigned_at,
      pa.discharged_at,
      pa.valid_until,
      pa.notes,
      u.user_id  AS doctor_id,
      u.username AS doctor_name
    FROM patient_assignments pa
    JOIN users u ON u.user_id = pa.doctor_id
    WHERE pa.patient_id    = ${patientId}
      AND pa.discharged_at IS NULL
      AND (pa.valid_until IS NULL OR pa.valid_until > NOW())
    ORDER BY
      CASE pa.role
        WHEN 'PRIMARY'    THEN 1
        WHEN 'COVERING'   THEN 2
        ELSE                   3
      END,
      pa.assigned_at ASC
  `;

  res.status(200).json({ status: 'success', data: { assignments } });
});

// ─── POST /doctor/patients/:patientId/assignments ─────────────────────────────
// Assign a colleague (CONSULTING or COVERING). Only the PRIMARY doctor may call this.

export const createAssignment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId } = req.params;
  const orgId = req.user!.org_id;

  const val = createAssignmentSchema.safeParse(req.body);
  if (!val.success) {
    const fields: Record<string, string> = {};
    val.error.issues.forEach(i => { fields[String(i.path[0])] = i.message; });
    return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
  }

  if (!(await requireOrgPatient(patientId, orgId, next))) return;

  // Only the current PRIMARY may invite colleagues
  const [currentPrimary] = await sql`
    SELECT assignment_id FROM patient_assignments
    WHERE  patient_id    = ${patientId}
      AND  doctor_id     = ${req.user!.user_id}
      AND  role          = 'PRIMARY'
      AND  discharged_at IS NULL
    LIMIT  1
  `;
  if (!currentPrimary) return next(new AppError('ERROR_NOT_PRIMARY_DOCTOR', 403));

  // Cannot assign yourself — use joinCareTeam for self-assignment
  if (val.data.doctor_id === req.user!.user_id) {
    return next(new AppError('ERROR_CANNOT_ASSIGN_SELF', 400));
  }

  // Target must be a DOCTOR in the same org
  const [targetDoctor] = await sql`
    SELECT u.user_id FROM users u
    JOIN   doctors d ON d.user_id = u.user_id
    WHERE  u.user_id        = ${val.data.doctor_id}
      AND  u.deleted_at     IS NULL
      ${orgId ? sql`AND u.organization_id = ${orgId}` : sql``}
    LIMIT  1
  `;
  if (!targetDoctor) return next(new AppError('ERROR_USER_NOT_FOUND', 404));

  // Already actively assigned?
  const [existing] = await sql`
    SELECT assignment_id FROM patient_assignments
    WHERE  patient_id    = ${patientId}
      AND  doctor_id     = ${val.data.doctor_id}
      AND  discharged_at IS NULL
      AND  (valid_until IS NULL OR valid_until > NOW())
    LIMIT  1
  `;
  if (existing) return next(new AppError('ERROR_ALREADY_ASSIGNED', 409));

  const [assignment] = await sql`
    INSERT INTO patient_assignments (patient_id, doctor_id, role, assigned_by, notes, valid_until)
    VALUES (${patientId}, ${val.data.doctor_id}, ${val.data.role}, ${req.user!.user_id}, ${val.data.notes ?? null}, ${val.data.valid_until ?? null})
    RETURNING assignment_id, role, assigned_at, valid_until, notes
  `;

  // Alert the assigned doctor
  await sql`
    INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
    VALUES (
      ${patientId},
      ${val.data.doctor_id},
      'PATIENT_ASSIGNED',
      ${'You have been added as ' + val.data.role + ' for a patient.'}
    )
  `;

  res.status(201).json({
    status: 'success',
    messageKey: 'SUCCESS_ASSIGNMENT_CREATED',
    data: { assignment },
  });
});

// ─── DELETE /doctor/patients/:patientId/assignments/:assignmentId ─────────────
// Discharge a CONSULTING or COVERING assignment.
// PRIMARY cannot be discharged directly — use the transfer endpoint.

export const dischargeAssignment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId, assignmentId } = req.params;
  const orgId = req.user!.org_id;

  const [assignment] = await sql`
    SELECT pa.assignment_id, pa.doctor_id, pa.role
    FROM   patient_assignments pa
    JOIN   patients p ON p.patient_id = pa.patient_id
    WHERE  pa.assignment_id  = ${assignmentId}
      AND  pa.patient_id     = ${patientId}
      AND  pa.discharged_at  IS NULL
      AND  (pa.valid_until IS NULL OR pa.valid_until > NOW())
      ${orgId ? sql`AND p.organization_id = ${orgId}` : sql``}
    LIMIT  1
  `;
  if (!assignment) return next(new AppError('ERROR_ASSIGNMENT_NOT_FOUND', 404));

  // PRIMARY cannot be discharged directly
  if (assignment.role === 'PRIMARY') {
    return next(new AppError('ERROR_CANNOT_DISCHARGE_PRIMARY', 400));
  }

  // Only the PRIMARY or the assigned doctor themselves can discharge
  const [currentPrimary] = await sql`
    SELECT assignment_id FROM patient_assignments
    WHERE  patient_id    = ${patientId}
      AND  doctor_id     = ${req.user!.user_id}
      AND  role          = 'PRIMARY'
      AND  discharged_at IS NULL
    LIMIT  1
  `;
  const isSelf = assignment.doctor_id === req.user!.user_id;
  if (!currentPrimary && !isSelf) {
    return next(new AppError('ERROR_FORBIDDEN', 403));
  }

  await sql`
    UPDATE patient_assignments
    SET    discharged_at = NOW()
    WHERE  assignment_id = ${assignmentId}
  `;

  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_ASSIGNMENT_DISCHARGED' });
});

// ─── PATCH /doctor/patients/:patientId/assignments/:assignmentId/transfer ─────
// Transfer PRIMARY ownership to the doctor referenced by the given assignment.
// Only the current PRIMARY may call this.

export const transferPrimary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { patientId, assignmentId } = req.params;
  const orgId = req.user!.org_id;

  if (!(await requireOrgPatient(patientId, orgId, next))) return;

  // Requester must be the current PRIMARY
  const [myPrimary] = await sql`
    SELECT assignment_id FROM patient_assignments
    WHERE  patient_id    = ${patientId}
      AND  doctor_id     = ${req.user!.user_id}
      AND  role          = 'PRIMARY'
      AND  discharged_at IS NULL
    LIMIT  1
  `;
  if (!myPrimary) return next(new AppError('ERROR_NOT_PRIMARY_DOCTOR', 403));

  // Target assignment must exist, be active, and belong to this patient
  const [target] = await sql`
    SELECT assignment_id, doctor_id FROM patient_assignments
    WHERE  assignment_id  = ${assignmentId}
      AND  patient_id     = ${patientId}
      AND  discharged_at  IS NULL
      AND  (valid_until IS NULL OR valid_until > NOW())
    LIMIT  1
  `;
  if (!target) return next(new AppError('ERROR_ASSIGNMENT_NOT_FOUND', 404));

  // Cannot transfer to yourself
  if (target.doctor_id === req.user!.user_id) {
    return next(new AppError('ERROR_CANNOT_TRANSFER_TO_SELF', 400));
  }

  // Atomic swap inside a transaction
  await sql.begin(async tx => {
    // Discharge current PRIMARY
    await tx`
      UPDATE patient_assignments
      SET    discharged_at = NOW()
      WHERE  assignment_id = ${myPrimary.assignment_id}
    `;
    // Elevate target to PRIMARY
    await tx`
      UPDATE patient_assignments
      SET    role        = 'PRIMARY',
             assigned_at = NOW()
      WHERE  assignment_id = ${target.assignment_id}
    `;
  });

  // Alert the new primary
  await sql`
    INSERT INTO alerts (patient_id, recipient_id, alert_type, message)
    VALUES (${patientId}, ${target.doctor_id}, 'PRIMARY_TRANSFERRED', 'You are now the primary doctor for this patient.')
  `;

  res.status(200).json({ status: 'success', messageKey: 'SUCCESS_PRIMARY_TRANSFERRED' });
});



// ─── GET /doctor/org-doctors ──────────────────────────────────────────────────
// Returns all DOCTOR-role users in the org (excluding self) for the assign-
// colleague dialog. No sensitive data — just user_id + username.

export const getOrgDoctors = catchAsync(async (req: Request, res: Response) => {
  const orgId = req.user!.org_id;

  const doctors = await sql`
    SELECT u.user_id, u.username
    FROM   users u
    JOIN   doctors d ON d.user_id = u.user_id
    WHERE  u.organization_id = ${orgId}
      AND  u.deleted_at      IS NULL
      AND  u.user_id        != ${req.user!.user_id}
    ORDER  BY u.username ASC
  `;

  res.status(200).json({ status: 'success', data: { doctors } });
});
