import { z } from 'zod';

// ─── Utility ──────────────────────────────────────────────────────────────────
/** Flatten Zod errors into a { fieldName: message } record for form display */
export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM VALIDATION SCHEMAS  (client-side, pre-submission)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required.').email('Valid email required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const registerOrgStep1Schema = z.object({
  username:       z.string().min(3, 'At least 3 characters.'),
  email:          z.string().email('Valid email required.'),
  password:       z.string().min(8, 'At least 8 characters.'),
  confirm:        z.string(),
  preferred_lang: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match.',
  path:    ['confirm'],
});

export const registerOrgStep2Schema = z.object({
  org_name:  z.string().min(2, 'At least 2 characters.'),
  org_type:  z.string().min(1, 'Please select a type.'),
  org_email: z.string().email('Valid email required.'),
  org_address: z.string().optional(),
});

export const registerOrgStep3Schema = z.object({
  plan_id: z.string().min(1, 'Please select a plan.'),
});

export const activateAccountSchema = z.object({
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(8, 'Min. 8 characters.'),
  confirm:  z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match.',
  path:    ['confirm'],
});

// ── Doctor ────────────────────────────────────────────────────────────────────
export const addPatientSchema = z.object({
  name:   z.string().min(1, 'Name is required.'),
  age:    z.coerce.number({ message: 'Valid age required.' })
            .int().min(0, 'Valid age required.').max(150, 'Valid age required.'),
  gender: z.string().min(1, 'Gender is required.'),
});

export const labOrderSchema = z.object({
  test_type: z.string().min(1, 'Test type is required.'),
  notes:     z.string().optional(),
});

export const clinicalDataSchema = z.object({
  temperature: z.string().optional(),
  heart_rate:  z.string().optional(),
  spo2:        z.string().optional(),
  bp_sys:      z.string().optional(),
  bp_dia:      z.string().optional(),
  symptoms:    z.string().optional(),
});

// ── Lab ───────────────────────────────────────────────────────────────────────
const labResultRowSchema = z.object({
  analyte_name: z.string().min(1, 'Analyte name is required.'),
  value:        z.string().min(1, 'Value is required.'),
  reference_low:  z.string().optional(),
  reference_high: z.string().optional(),
  flag:           z.string().min(1, 'Flag is required.'),
});

export const labResultsSchema = z.object({
  results: z.array(labResultRowSchema).min(1, 'At least one result is required.'),
});

// ── Manager ───────────────────────────────────────────────────────────────────
export const inviteStaffSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Valid email required.'),
  role:  z.string().min(1, 'Role is required.'),
  dept_id: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE SCHEMAS  (runtime parsing of backend payloads)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Auth responses ────────────────────────────────────────────────────────────
export const apiAuthUserSchema = z.object({
  user_id:        z.string(),
  username:       z.string(),
  email:          z.string(),
  role:           z.enum(['DOCTOR', 'LAB_TECH', 'MANAGER']),
  org_id:         z.string().nullable(),
  preferred_lang: z.string(),
});

export const apiLoginResponseSchema = z.object({
  accessToken: z.string(),
  user:        apiAuthUserSchema,
});

export const apiProfileResponseSchema = z.object({
  user: z.object({
    user_id:        z.string(),
    username:       z.string(),
    email:          z.string(),
    org_name:       z.string().nullable(),
    department_id:  z.string().nullable().optional(),
    preferred_lang: z.string(),
    status:         z.string(),
    role:           z.string(),
    created_at:     z.string().optional(),
  }),
});

// ── Plans ─────────────────────────────────────────────────────────────────────
const planFeatureSchema = z.object({
  name:       z.string(),
  is_enabled: z.boolean(),
  value:      z.number().nullable(),
});

const planSchema = z.object({
  plan_id:        z.string(),
  name:           z.string(),
  description:    z.string(),
  price_monthly:  z.number().nullable(),
  price_annually: z.number().nullable().optional(),
  is_trial:       z.boolean(),
  features:       z.array(planFeatureSchema).default([]),
});

export const apiPlansResponseSchema = z.object({
  plans: z.array(planSchema).default([]),
});

// ── Patients ──────────────────────────────────────────────────────────────────
const patientSchema = z.object({
  patient_id:  z.string(),
  name:        z.string(),
  age:         z.number(),
  gender:      z.string(),
  risk_status: z.string().nullable().optional(),
  risk_score:  z.number().nullable().optional(),
  created_at:  z.string(),
});

export const apiPatientsResponseSchema = z.object({
  patients: z.array(patientSchema).default([]),
});

const clinicalRecordSchema = z.object({
  data_id: z.string(),
  vitals: z.object({
    temperature:              z.number().optional(),
    heart_rate:               z.number().optional(),
    spo2:                     z.number().optional(),
    blood_pressure_systolic:  z.number().optional(),
    blood_pressure_diastolic: z.number().optional(),
  }).default({}),
  symptoms:   z.array(z.string()).default([]),
  created_at: z.string(),
});

const labTestSchema = z.object({
  test_id:   z.string(),
  test_type: z.string(),
  status:    z.string(),
  notes:     z.string().default(''),
  ordered_at: z.string(),
});

export const apiPatientDetailResponseSchema = z.object({
  patient: z.object({
    patient_id:      z.string(),
    name:            z.string(),
    age:             z.number(),
    gender:          z.string(),
    medical_history: z.record(z.string(), z.unknown()).default({}),
    risk_level:      z.string().nullable().optional(),
    risk_score:      z.number().nullable().optional(),
    created_at:      z.string(),
    clinicalData:    z.array(clinicalRecordSchema).default([]),
    labTests:        z.array(labTestSchema).default([]),
  }),
});

// ── Predictions ───────────────────────────────────────────────────────────────
const predictionSchema = z.object({
  request_id:    z.string(),
  patient_id:    z.string().optional(),
  patient_name:  z.string().optional(),
  model_version: z.string().optional(),
  status:        z.string().optional(),
  created_at:    z.string(),
  risk_score:    z.number().nullable(),
  risk_level:    z.string().nullable(),
  confidence:    z.number().nullable(),
});

export const apiPredictionsResponseSchema = z.object({
  predictions: z.array(predictionSchema).default([]),
});

const featureExplanationSchema = z.object({
  feature_name: z.string(),
  contribution: z.number(),
  direction:    z.enum(['POSITIVE', 'NEGATIVE']),
  rank:         z.number(),
});

export const apiPredictionDetailResponseSchema = z.object({
  prediction: predictionSchema.extend({
    feature_explanations: z.array(featureExplanationSchema).default([]),
    raw_payload:          z.record(z.string(), z.unknown()).default({}),
  }),
});

// ── Alerts ────────────────────────────────────────────────────────────────────
const alertSchema = z.object({
  alert_id:     z.string(),
  patient_name: z.string().nullable(),
  alert_type:   z.string(),
  message:      z.string(),
  is_read:      z.boolean(),
  created_at:   z.string(),
});

export const apiAlertsResponseSchema = z.object({
  alerts: z.array(alertSchema).default([]),
});

// ── Lab Orders ────────────────────────────────────────────────────────────────
const labOrderResponseSchema = z.object({
  test_id:         z.string(),
  test_type:       z.string(),
  status:          z.string(),
  patient_name:    z.string(),
  patient_age:     z.number().optional(),
  patient_gender:  z.string().optional(),
  ordered_by_name: z.string().nullable().optional(),
  notes:           z.string().default(''),
  ordered_at:      z.string(),
  medical_history: z.record(z.string(), z.unknown()).optional(),
  results:         z.array(z.object({
    result_id:    z.string(),
    analyte_name: z.string(),
    value:        z.string(),
    flag:         z.string(),
    unit_symbol:  z.string().default(''),
  })).default([]),
});

export const apiLabOrdersResponseSchema = z.object({
  orders: z.array(labOrderResponseSchema).default([]),
});

export const apiLabOrderDetailResponseSchema = z.object({
  order: labOrderResponseSchema,
});

// ── Lab Stats ─────────────────────────────────────────────────────────────────
export const apiLabStatsResponseSchema = z.object({
  stats: z.object({
    pending_count:    z.string(),
    inprogress_count: z.string(),
    completed_today:  z.string(),
    total_completed:  z.string(),
  }),
});

// ── Manager Reports ───────────────────────────────────────────────────────────
export const apiReportsResponseSchema = z.object({
  reports: z.object({
    staffCounts: z.object({
      doctors:   z.string(),
      lab_techs: z.string(),
      managers:  z.string(),
      total:     z.string(),
    }),
    labStats: z.object({
      total_tests:      z.string(),
      pending:          z.string(),
      completed:        z.string(),
      critical_results: z.string(),
    }),
    predStats: z.object({
      total_predictions: z.string(),
      critical:          z.string(),
      high:              z.string(),
      moderate:          z.string(),
      low:               z.string(),
    }),
    usageStats: z.object({
      prediction_used:    z.number(),
      prediction_overage: z.number(),
      prediction_limit:   z.number().nullable(),
    }).nullable(),
  }),
});

// ── Subscription ──────────────────────────────────────────────────────────────
export const apiSubscriptionResponseSchema = z.object({
  subscription: z.object({
    subscription_id:     z.string(),
    plan_id:             z.string(),
    plan_name:           z.string(),
    plan_description:    z.string(),
    price_monthly:       z.number().nullable(),
    is_trial:            z.boolean(),
    status:              z.string(),
    current_cycle_start: z.string(),
    current_cycle_end:   z.string(),
    features:            z.array(planFeatureSchema).default([]),
    usage: z.object({
      prediction_used:    z.number(),
      prediction_overage: z.number(),
    }),
  }),
});

// ── Invitations ───────────────────────────────────────────────────────────────
const invitationSchema = z.object({
  invitation_id:   z.string(),
  email:           z.string(),
  role:            z.string(),
  department_name: z.string().nullable(),
  status:          z.enum(['PENDING', 'ACCEPTED', 'EXPIRED']),
  created_at:      z.string(),
  expires_at:      z.string(),
});

export const apiInvitationsResponseSchema = z.object({
  invitations: z.array(invitationSchema).default([]),
});

// ── Departments ───────────────────────────────────────────────────────────────
export const apiDepartmentsResponseSchema = z.object({
  departments: z.array(z.object({
    department_id: z.string(),
    name:          z.string(),
  })).default([]),
});

// ── Staff ─────────────────────────────────────────────────────────────────────
const staffMemberSchema = z.object({
  user_id:         z.string(),
  username:        z.string(),
  email:           z.string(),
  role:            z.enum(['DOCTOR', 'LAB_TECH', 'MANAGER']),
  status:          z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  department_name: z.string().nullable(),
  created_at:      z.string(),
});

export const apiStaffResponseSchema = z.object({
  staff: z.array(staffMemberSchema).default([]),
});
