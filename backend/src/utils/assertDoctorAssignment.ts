import { NextFunction } from 'express';
import sql from '../config/db.js';
import AppError from './AppError.js';

/**
 * Verifies the requesting doctor has an active (non-discharged) assignment
 * to the given patient.
 *
 * Returns true  → caller may proceed.
 * Returns false → next(AppError) was already called; caller must return immediately.
 *
 * Usage in a controller:
 *   if (!(await assertDoctorAssignment(patientId, req.user!.user_id, next))) return;
 */
export async function assertDoctorAssignment(
  patientId: string,
  doctorId:  string,
  next:      NextFunction,
): Promise<boolean> {
  const [assignment] = await sql`
    SELECT assignment_id
    FROM   patient_assignments
    WHERE  patient_id    = ${patientId}
      AND  doctor_id     = ${doctorId}
      AND  discharged_at IS NULL
      AND  (valid_until IS NULL OR valid_until > NOW())
    LIMIT  1
  `;

  if (!assignment) {
    next(new AppError('ERROR_NOT_ASSIGNED_TO_PATIENT', 403));
    return false;
  }

  return true;
}
