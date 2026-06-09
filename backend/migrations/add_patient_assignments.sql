-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: patient_assignments
-- Run once against the live Supabase database.
-- Safe to run on a database that already has the patients table populated:
-- existing patients will have no assignments until backfilled.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.patient_assignments (
  assignment_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid        NOT NULL REFERENCES public.patients(patient_id)  ON DELETE CASCADE,
  doctor_id      uuid        NOT NULL REFERENCES public.users(user_id)         ON DELETE CASCADE,
  role           text        NOT NULL DEFAULT 'PRIMARY'
                             CHECK (role IN ('PRIMARY', 'CONSULTING', 'COVERING')),
  assigned_by    uuid        REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  discharged_at  timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Enforce: each patient can have at most ONE active PRIMARY doctor.
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_assignments_active_primary
  ON public.patient_assignments (patient_id)
  WHERE role = 'PRIMARY' AND discharged_at IS NULL;

-- Fast lookup: all active assignments for a given doctor.
CREATE INDEX IF NOT EXISTS idx_patient_assignments_doctor
  ON public.patient_assignments (doctor_id)
  WHERE discharged_at IS NULL;

-- Fast lookup: all active assignments for a given patient.
CREATE INDEX IF NOT EXISTS idx_patient_assignments_patient
  ON public.patient_assignments (patient_id)
  WHERE discharged_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: assign existing patients to their created_by doctor as PRIMARY.
-- Only runs for patients that have a created_by value AND that user is a DOCTOR.
-- Skipped automatically if no such patients exist.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.patient_assignments (patient_id, doctor_id, role, assigned_by)
SELECT
  p.patient_id,
  p.created_by,
  'PRIMARY',
  p.created_by
FROM public.patients p
JOIN public.doctors d ON d.user_id = p.created_by
WHERE p.deleted_at  IS NULL
  AND p.created_by  IS NOT NULL
  -- Skip if already has an active PRIMARY (idempotent re-run safety)
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_assignments pa
    WHERE pa.patient_id    = p.patient_id
      AND pa.role          = 'PRIMARY'
      AND pa.discharged_at IS NULL
  )
ON CONFLICT DO NOTHING;
