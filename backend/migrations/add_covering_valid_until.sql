-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add_covering_valid_until
-- Adds valid_until column for COVERING doctor assignments.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.patient_assignments
ADD COLUMN IF NOT EXISTS valid_until timestamptz;

-- Recreate indexes to include valid_until consideration if needed
-- Drop existing fast lookup indexes for active assignments so we can redefine them
DROP INDEX IF EXISTS public.idx_patient_assignments_doctor;
DROP INDEX IF EXISTS public.idx_patient_assignments_patient;

-- Fast lookup: all active assignments for a given doctor.
-- Active means not discharged. (valid_until filtering will be done at runtime)
CREATE INDEX idx_patient_assignments_doctor
  ON public.patient_assignments (doctor_id)
  WHERE discharged_at IS NULL;

-- Fast lookup: all active assignments for a given patient.
CREATE INDEX idx_patient_assignments_patient
  ON public.patient_assignments (patient_id)
  WHERE discharged_at IS NULL;
