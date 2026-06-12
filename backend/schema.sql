-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.organizations (
  organization_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['HOSPITAL'::text, 'CLINIC'::text, 'LAB'::text, 'OTHER'::text])),
  email text,
  address text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (organization_id)
);
CREATE TABLE public.departments (
  department_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  icon text DEFAULT 'Building2'::text,
  CONSTRAINT departments_pkey PRIMARY KEY (department_id),
  CONSTRAINT departments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id)
);
CREATE TABLE public.users (
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  email text NOT NULL,
  password_hash text,
  organization_id uuid,
  department_id uuid,
  preferred_lang text NOT NULL DEFAULT 'en'::text CHECK (preferred_lang = ANY (ARRAY['en'::text, 'ar'::text])),
  status text NOT NULL DEFAULT 'ACTIVE'::text CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text, 'PENDING_VERIFICATION'::text])),
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  last_login_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
  CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(department_id)
);
CREATE TABLE public.doctors (
  doctor_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT doctors_pkey PRIMARY KEY (doctor_id),
  CONSTRAINT doctors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.lab_technicians (
  technician_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lab_technicians_pkey PRIMARY KEY (technician_id),
  CONSTRAINT lab_technicians_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.hospital_managers (
  manager_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT hospital_managers_pkey PRIMARY KEY (manager_id),
  CONSTRAINT hospital_managers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.plans (
  plan_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  description_en text,
  price_monthly numeric,
  price_annually numeric,
  is_trial boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name_ar text,
  description_ar text,
  CONSTRAINT plans_pkey PRIMARY KEY (plan_id)
);
CREATE TABLE public.plan_features (
  feature_id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  name_en text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  value numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name_ar text,
  CONSTRAINT plan_features_pkey PRIMARY KEY (feature_id),
  CONSTRAINT plan_features_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(plan_id)
);
CREATE TABLE public.subscriptions (
  subscription_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'::text CHECK (status = ANY (ARRAY['ACTIVE'::text, 'CANCELLED'::text, 'EXPIRED'::text, 'PAST_DUE'::text])),
  current_cycle_start date,
  current_cycle_end date,
  trial_end_at timestamp with time zone,
  external_payment_ref text,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_id),
  CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(plan_id)
);
CREATE TABLE public.usage_records (
  usage_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  prediction_used integer NOT NULL DEFAULT 0,
  prediction_overage integer NOT NULL DEFAULT 0,
  overage_notified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usage_records_pkey PRIMARY KEY (usage_id),
  CONSTRAINT usage_records_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(subscription_id)
);
CREATE TABLE public.overage_events (
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  usage_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['LIMIT_REACHED'::text, 'OVERAGE_STARTED'::text, 'USER_ADDED'::text])),
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT overage_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT overage_events_usage_id_fkey FOREIGN KEY (usage_id) REFERENCES public.usage_records(usage_id)
);
CREATE TABLE public.patients (
  patient_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer CHECK (age >= 0 AND age <= 150),
  gender text CHECK (gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text, 'OTHER'::text])),
  medical_history jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  organization_id uuid,
  created_by uuid,
  CONSTRAINT patients_pkey PRIMARY KEY (patient_id),
  CONSTRAINT patients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
  CONSTRAINT patients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.clinical_data (
  data_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  symptoms jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_at timestamp with time zone,
  visit_date date,
  deleted_at timestamp with time zone,
  CONSTRAINT clinical_data_pkey PRIMARY KEY (data_id),
  CONSTRAINT clinical_data_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id),
  CONSTRAINT clinical_data_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.units (
  unit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  symbol text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name_ar text,
  CONSTRAINT units_pkey PRIMARY KEY (unit_id)
);
CREATE TABLE public.lab_tests (
  test_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  test_type text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'INPROGRESS'::text, 'COMPLETED'::text, 'CANCELLED'::text])),
  requested_by uuid,
  notes text,
  ordered_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_to uuid,
  assigned_at timestamp with time zone,
  CONSTRAINT lab_tests_pkey PRIMARY KEY (test_id),
  CONSTRAINT lab_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id),
  CONSTRAINT lab_tests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id),
  CONSTRAINT lab_tests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.lab_technicians(technician_id)
);
CREATE TABLE public.lab_test_results (
  result_id uuid NOT NULL DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  analyte_name text NOT NULL,
  value text NOT NULL,
  unit_id uuid,
  reference_low numeric,
  reference_high numeric,
  flag text NOT NULL CHECK (flag = ANY (ARRAY['NORMAL'::text, 'ABNORMAL'::text, 'CRITICAL'::text])),
  entered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sub_panel text,
  is_amended boolean NOT NULL DEFAULT false,
  original_result_id uuid,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  CONSTRAINT lab_test_results_pkey PRIMARY KEY (result_id),
  CONSTRAINT lab_test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.lab_tests(test_id),
  CONSTRAINT lab_test_results_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(unit_id),
  CONSTRAINT lab_test_results_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.lab_technicians(technician_id),
  CONSTRAINT lab_test_results_original_result_id_fkey FOREIGN KEY (original_result_id) REFERENCES public.lab_test_results(result_id),
  CONSTRAINT lab_test_results_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.prediction_requests (
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  clinical_data_id uuid,
  requested_by uuid,
  model_version text NOT NULL DEFAULT 'v2.3.1'::text,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prediction_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT prediction_requests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id),
  CONSTRAINT prediction_requests_clinical_data_id_fkey FOREIGN KEY (clinical_data_id) REFERENCES public.clinical_data(data_id),
  CONSTRAINT prediction_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.prediction_results (
  result_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  risk_score numeric NOT NULL CHECK (risk_score >= 0::numeric AND risk_score <= 1::numeric),
  risk_level text NOT NULL CHECK (risk_level = ANY (ARRAY['LOW'::text, 'MODERATE'::text, 'HIGH'::text, 'CRITICAL'::text])),
  confidence numeric NOT NULL CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  raw_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prediction_results_pkey PRIMARY KEY (result_id),
  CONSTRAINT prediction_results_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.prediction_requests(request_id)
);
CREATE TABLE public.feature_explanations (
  explanation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL,
  feature_name text NOT NULL,
  contribution numeric NOT NULL,
  direction text NOT NULL CHECK (direction = ANY (ARRAY['POSITIVE'::text, 'NEGATIVE'::text])),
  rank integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feature_explanations_pkey PRIMARY KEY (explanation_id),
  CONSTRAINT feature_explanations_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.prediction_results(result_id)
);
CREATE TABLE public.infection_risks (
  risk_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  risk_score numeric NOT NULL CHECK (risk_score >= 0::numeric AND risk_score <= 1::numeric),
  risk_level text NOT NULL CHECK (risk_level = ANY (ARRAY['LOW'::text, 'MODERATE'::text, 'HIGH'::text, 'CRITICAL'::text])),
  model_version text,
  message_en text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  message_ar text,
  CONSTRAINT infection_risks_pkey PRIMARY KEY (risk_id),
  CONSTRAINT infection_risks_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id)
);
CREATE TABLE public.refresh_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  family uuid NOT NULL DEFAULT gen_random_uuid(),
  device_info jsonb,
  ip_address text,
  revoked_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.token_blacklist (
  jti text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT token_blacklist_pkey PRIMARY KEY (jti)
);
CREATE TABLE public.invitations (
  invitation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['DOCTOR'::text, 'LAB_TECH'::text, 'MANAGER'::text])),
  organization_id uuid NOT NULL,
  department_id uuid,
  invited_by uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  activated_at timestamp with time zone,
  activated_by uuid,
  expires_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invitations_pkey PRIMARY KEY (invitation_id),
  CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
  CONSTRAINT invitations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(department_id),
  CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(user_id),
  CONSTRAINT invitations_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.alerts (
  alert_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid,
  recipient_id uuid NOT NULL,
  alert_type text NOT NULL CHECK (alert_type = ANY (ARRAY['RISK_CRITICAL'::text, 'RISK_HIGH'::text, 'RISK_MODERATE'::text, 'RISK_LOW'::text, 'RESULT_READY'::text, 'ABNORMAL_RESULT'::text, 'CRITICAL_RESULT'::text, 'NEW_LAB_ORDER'::text, 'PATIENT_ASSIGNED'::text, 'PRIMARY_TRANSFERRED'::text, 'OVERAGE_STARTED'::text])),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alerts_pkey PRIMARY KEY (alert_id),
  CONSTRAINT alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id),
  CONSTRAINT alerts_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.patient_assignments (
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'PRIMARY'::text CHECK (role = ANY (ARRAY['PRIMARY'::text, 'CONSULTING'::text, 'COVERING'::text])),
  assigned_by uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  discharged_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone,
  CONSTRAINT patient_assignments_pkey PRIMARY KEY (assignment_id),
  CONSTRAINT patient_assignments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id),
  CONSTRAINT patient_assignments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(user_id),
  CONSTRAINT patient_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.password_reset_tokens (
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (token_id),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.email_verification_tokens (
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (token_id),
  CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.subscription_change_tokens (
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  new_plan_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_change_tokens_pkey PRIMARY KEY (token_id),
  CONSTRAINT subscription_change_tokens_org_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id),
  CONSTRAINT subscription_change_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT subscription_change_tokens_plan_id_fkey FOREIGN KEY (new_plan_id) REFERENCES public.plans(plan_id)
);