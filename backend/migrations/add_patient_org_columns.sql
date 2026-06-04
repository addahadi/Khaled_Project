-- Migration: Add organization_id and created_by columns to patients table
-- Allows patients to be scoped to an organization without requiring a prediction_request record

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(organization_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_org      ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(created_by);

COMMENT ON COLUMN patients.organization_id IS 'The organization this patient belongs to';
COMMENT ON COLUMN patients.created_by      IS 'The user who created this patient record';
