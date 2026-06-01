-- ============================================================
-- DiagInfect — Complete Database Schema
-- Fresh install on empty Supabase PostgreSQL
-- Run this file once, then you're done.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. ORGANIZATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  organization_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  type             TEXT         NOT NULL CHECK (type IN ('HOSPITAL','CLINIC','LAB','OTHER')),
  email            TEXT,
  address          TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. DEPARTMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE departments (
  department_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID         NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  icon             TEXT         DEFAULT 'Building2',  -- Lucide icon name
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_org ON departments(organization_id);

-- ─────────────────────────────────────────────────────────────
-- 3. USERS  (credentials live here — no separate auth table)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  user_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username             TEXT         NOT NULL,
  email                TEXT         NOT NULL,
  password_hash        TEXT,                          -- nullable until invitation is activated
  organization_id      UUID         REFERENCES organizations(organization_id) ON DELETE SET NULL,
  department_id        UUID         REFERENCES departments(department_id)     ON DELETE SET NULL,
  preferred_lang       TEXT         NOT NULL DEFAULT 'en' CHECK (preferred_lang IN ('en','ar')),
  status               TEXT         NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  failed_login_count   INTEGER      NOT NULL DEFAULT 0,
  locked_until         TIMESTAMPTZ,
  last_login_at        TIMESTAMPTZ,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_email    ON users(email)    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX        idx_users_org      ON users(organization_id);

-- ─────────────────────────────────────────────────────────────
-- 4. ROLE SUBTYPE TABLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE doctors (
  doctor_id   UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lab_technicians (
  technician_id  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID  NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hospital_managers (
  manager_id  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5. PLANS & FEATURES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE plans (
  plan_id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT          NOT NULL,
  description      TEXT,
  price_monthly    NUMERIC(10,2),
  price_annually   NUMERIC(10,2),
  is_trial         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE plan_features (
  feature_id   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID     NOT NULL REFERENCES plans(plan_id) ON DELETE CASCADE,
  name         TEXT     NOT NULL,   -- e.g. 'predictions_per_month', 'users_limit', 'xai_explanations'
  is_enabled   BOOLEAN  NOT NULL DEFAULT TRUE,
  value        NUMERIC,             -- numeric limit (NULL = unlimited)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, name)
);

CREATE INDEX idx_plan_features_plan ON plan_features(plan_id);

-- ─────────────────────────────────────────────────────────────
-- 6. SUBSCRIPTIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  subscription_id       UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID   NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  plan_id               UUID   NOT NULL REFERENCES plans(plan_id),
  status                TEXT   NOT NULL DEFAULT 'ACTIVE'
                                CHECK (status IN ('ACTIVE','CANCELLED','EXPIRED','PAST_DUE')),
  current_cycle_start   DATE,
  current_cycle_end     DATE,
  trial_end_at          TIMESTAMPTZ,
  external_payment_ref  TEXT,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_org    ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ─────────────────────────────────────────────────────────────
-- 7. USAGE RECORDS + OVERAGE EVENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE usage_records (
  usage_id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id      UUID    NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE CASCADE,
  cycle_start          DATE    NOT NULL,
  cycle_end            DATE    NOT NULL,
  prediction_used      INTEGER NOT NULL DEFAULT 0,
  prediction_overage   INTEGER NOT NULL DEFAULT 0,
  overage_notified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, cycle_start)
);

CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id);

CREATE TABLE overage_events (
  event_id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id    UUID  NOT NULL REFERENCES usage_records(usage_id) ON DELETE CASCADE,
  event_type  TEXT  NOT NULL CHECK (event_type IN ('LIMIT_REACHED','OVERAGE_STARTED','USER_ADDED')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. PATIENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE patients (
  patient_id       UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT   NOT NULL,
  age              INTEGER CHECK (age >= 0 AND age <= 150),
  gender           TEXT   CHECK (gender IN ('MALE','FEMALE','OTHER')),
  medical_history  JSONB  NOT NULL DEFAULT '{}',
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 9. CLINICAL DATA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE clinical_data (
  data_id      UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID  NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  vitals       JSONB NOT NULL DEFAULT '{}',
  symptoms     JSONB NOT NULL DEFAULT '[]',
  recorded_by  UUID  REFERENCES users(user_id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinical_data_patient ON clinical_data(patient_id);

-- ─────────────────────────────────────────────────────────────
-- 10. UNITS (for lab result values)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE units (
  unit_id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT  NOT NULL,
  symbol     TEXT  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 11. LAB TESTS + RESULTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lab_tests (
  test_id       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID  NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  test_type     TEXT  NOT NULL,
  status        TEXT  NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','INPROGRESS','COMPLETED','CANCELLED')),
  requested_by  UUID  REFERENCES users(user_id) ON DELETE SET NULL,
  notes         TEXT,
  ordered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX idx_lab_tests_status  ON lab_tests(status);

CREATE TABLE lab_test_results (
  result_id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        UUID     NOT NULL REFERENCES lab_tests(test_id) ON DELETE CASCADE,
  analyte_name   TEXT     NOT NULL,
  value          TEXT     NOT NULL,
  unit_id        UUID     REFERENCES units(unit_id) ON DELETE SET NULL,
  reference_low  NUMERIC,
  reference_high NUMERIC,
  flag           TEXT     NOT NULL CHECK (flag IN ('NORMAL','ABNORMAL','CRITICAL')),
  entered_by     UUID     REFERENCES lab_technicians(technician_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_test_results_test ON lab_test_results(test_id);

-- ─────────────────────────────────────────────────────────────
-- 12. AI PREDICTION PIPELINE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE prediction_requests (
  request_id        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID  NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  clinical_data_id  UUID  REFERENCES clinical_data(data_id) ON DELETE SET NULL,
  requested_by      UUID  REFERENCES users(user_id) ON DELETE SET NULL,
  model_version     TEXT  NOT NULL DEFAULT 'v2.3.1',
  status            TEXT  NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prediction_requests_patient    ON prediction_requests(patient_id);
CREATE INDEX idx_prediction_requests_requested  ON prediction_requests(requested_by);

CREATE TABLE prediction_results (
  result_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID          NOT NULL UNIQUE REFERENCES prediction_requests(request_id) ON DELETE CASCADE,
  risk_score   NUMERIC(5,4)  NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
  risk_level   TEXT          NOT NULL CHECK (risk_level IN ('LOW','MODERATE','HIGH','CRITICAL')),
  confidence   NUMERIC(5,4)  NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  raw_payload  JSONB,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE feature_explanations (
  explanation_id  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id       UUID          NOT NULL REFERENCES prediction_results(result_id) ON DELETE CASCADE,
  feature_name    TEXT          NOT NULL,
  contribution    NUMERIC(6,4)  NOT NULL,
  direction       TEXT          NOT NULL CHECK (direction IN ('POSITIVE','NEGATIVE')),
  rank            INTEGER       NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_explanations_result ON feature_explanations(result_id);

-- ─────────────────────────────────────────────────────────────
-- 13. INFECTION RISKS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE infection_risks (
  risk_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID          NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  risk_score     NUMERIC(5,4)  NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
  risk_level     TEXT          NOT NULL CHECK (risk_level IN ('LOW','MODERATE','HIGH','CRITICAL')),
  model_version  TEXT,
  message        TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_infection_risks_patient ON infection_risks(patient_id);

-- ─────────────────────────────────────────────────────────────
-- 14. AUTH — REFRESH TOKENS + BLACKLIST
-- ─────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id           UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID   NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash   TEXT   NOT NULL UNIQUE,
  family       UUID   NOT NULL DEFAULT gen_random_uuid(),
  device_info  JSONB,
  ip_address   TEXT,
  revoked_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_hash   ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family);
CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens(user_id);

CREATE TABLE token_blacklist (
  jti         TEXT        PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 15. INVITATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE invitations (
  invitation_id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT  NOT NULL,
  role             TEXT  NOT NULL CHECK (role IN ('DOCTOR','LAB_TECH','MANAGER')),
  organization_id  UUID  NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  department_id    UUID  REFERENCES departments(department_id) ON DELETE SET NULL,
  invited_by       UUID  NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash       TEXT  NOT NULL UNIQUE,
  activated_at     TIMESTAMPTZ,
  activated_by     UUID  REFERENCES users(user_id) ON DELETE SET NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_org        ON invitations(organization_id);
CREATE INDEX idx_invitations_email      ON invitations(email);

-- ─────────────────────────────────────────────────────────────
-- 16. ALERTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  alert_id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID    REFERENCES patients(patient_id) ON DELETE CASCADE,  -- nullable for system alerts
  recipient_id  UUID    NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  alert_type    TEXT    NOT NULL,
  message       TEXT    NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_recipient ON alerts(recipient_id);
CREATE INDEX idx_alerts_patient   ON alerts(patient_id);
CREATE INDEX idx_alerts_is_read   ON alerts(recipient_id, is_read);

-- ─────────────────────────────────────────────────────────────
-- 17. updated_at TRIGGERS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_usage_records_updated_at
  BEFORE UPDATE ON usage_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_lab_tests_updated_at
  BEFORE UPDATE ON lab_tests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_prediction_requests_updated_at
  BEFORE UPDATE ON prediction_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 18. SEED DATA — Units
-- ─────────────────────────────────────────────────────────────
INSERT INTO units (name, symbol) VALUES
  ('Cells per microliter',      'cells/μL'),
  ('Grams per deciliter',       'g/dL'),
  ('Milligrams per deciliter',  'mg/dL'),
  ('Millimoles per liter',      'mmol/L'),
  ('International units/liter', 'IU/L'),
  ('Millimeters of mercury',    'mmHg'),
  ('Beats per minute',          'bpm'),
  ('Degrees Celsius',           '°C'),
  ('Percentage',                '%'),
  ('Milliseconds',              'ms'),
  ('Micrograms per liter',      'μg/L'),
  ('Nanograms per milliliter',  'ng/mL')
ON CONFLICT (symbol) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 19. SEED DATA — Plans + Features
-- ─────────────────────────────────────────────────────────────
INSERT INTO plans (plan_id, name, description, price_monthly, price_annually, is_trial, is_active)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Trial',
    'Full platform access for 14 days. No credit card required.',
    NULL, NULL, TRUE, TRUE
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Clinic',
    'Ideal for small to medium clinics with up to 15 staff members.',
    299.00, 2868.00, FALSE, TRUE
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Hospital',
    'Enterprise-grade plan for large hospital networks with unlimited usage.',
    799.00, 7668.00, FALSE, TRUE
  );

-- Trial plan features
INSERT INTO plan_features (plan_id, name, is_enabled, value) VALUES
  ('11111111-1111-1111-1111-111111111111', 'predictions_per_month', TRUE,  50),
  ('11111111-1111-1111-1111-111111111111', 'users_limit',           TRUE,  5),
  ('11111111-1111-1111-1111-111111111111', 'xai_explanations',      FALSE, NULL),
  ('11111111-1111-1111-1111-111111111111', 'priority_support',      FALSE, NULL),
  ('11111111-1111-1111-1111-111111111111', 'api_access',            FALSE, NULL);

-- Clinic plan features
INSERT INTO plan_features (plan_id, name, is_enabled, value) VALUES
  ('22222222-2222-2222-2222-222222222222', 'predictions_per_month', TRUE,  500),
  ('22222222-2222-2222-2222-222222222222', 'users_limit',           TRUE,  20),
  ('22222222-2222-2222-2222-222222222222', 'xai_explanations',      TRUE,  NULL),
  ('22222222-2222-2222-2222-222222222222', 'priority_support',      TRUE,  NULL),
  ('22222222-2222-2222-2222-222222222222', 'api_access',            FALSE, NULL);

-- Hospital plan features
INSERT INTO plan_features (plan_id, name, is_enabled, value) VALUES
  ('33333333-3333-3333-3333-333333333333', 'predictions_per_month', TRUE,  NULL),
  ('33333333-3333-3333-3333-333333333333', 'users_limit',           TRUE,  NULL),
  ('33333333-3333-3333-3333-333333333333', 'xai_explanations',      TRUE,  NULL),
  ('33333333-3333-3333-3333-333333333333', 'priority_support',      TRUE,  NULL),
  ('33333333-3333-3333-3333-333333333333', 'api_access',            TRUE,  NULL);

-- ─────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────
-- Tables created:
--   organizations, departments, users
--   doctors, lab_technicians, hospital_managers
--   plans, plan_features
--   subscriptions, usage_records, overage_events
--   patients, clinical_data
--   units, lab_tests, lab_test_results
--   prediction_requests, prediction_results, feature_explanations
--   infection_risks
--   refresh_tokens, token_blacklist
--   invitations, alerts
--
-- Seed data inserted:
--   12 common medical units
--   3 plans: Trial / Clinic / Hospital
--   15 plan features (5 per plan)
-- ─────────────────────────────────────────────────────────────
