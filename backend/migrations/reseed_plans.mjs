/**
 * Reseed subscription plans (update-in-place) with EN + AR content and DZD pricing.
 *
 *   Trial            — 14-day free trial
 *   Private Clinic   — 50,000 DA / month
 *   Grand Hospital   — 8,000,000 DA / year (unlimited)
 *
 * Existing plan rows are rewritten so active subscriptions stay intact.
 * Run once:  node migrations/reseed_plans.mjs
 */
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const TRIAL    = '11111111-1111-1111-1111-111111111111';
const CLINIC   = '22222222-2222-2222-2222-222222222222';
const HOSPITAL = '33333333-3333-3333-3333-333333333333';

// name_en is the machine identifier used by the backend — DO NOT translate it.
const AR = {
  predictions_per_month: 'تنبؤات الذكاء الاصطناعي شهرياً',
  users_limit:           'عدد المستخدمين',
  xai_explanations:      'تفسيرات الذكاء الاصطناعي (XAI)',
  priority_support:      'دعم ذو أولوية',
  api_access:            'الوصول عبر واجهة برمجة التطبيقات (API)',
};

const PLANS = [
  {
    plan_id: TRIAL,
    name_en: 'Trial',
    name_ar: 'نسخة تجريبية',
    description_en: 'Full platform access for 14 days. No credit card required.',
    description_ar: 'وصول كامل إلى المنصة لمدة 14 يوماً. لا حاجة لبطاقة ائتمان.',
    price_monthly: null,
    price_annually: null,
    is_trial: true,
    features: [
      { name: 'predictions_per_month', enabled: true,  value: 50 },
      { name: 'users_limit',           enabled: true,  value: 5 },
      { name: 'xai_explanations',      enabled: true,  value: null },
      { name: 'priority_support',      enabled: false, value: null },
      { name: 'api_access',            enabled: false, value: null },
    ],
  },
  {
    plan_id: CLINIC,
    name_en: 'Private Clinic',
    name_ar: 'عيادة خاصة',
    description_en: 'For private clinics and small practices. Billed monthly.',
    description_ar: 'للعيادات الخاصة والممارسات الصغيرة. فوترة شهرية.',
    price_monthly: 50000,
    price_annually: null,
    is_trial: false,
    features: [
      { name: 'predictions_per_month', enabled: true,  value: 500 },
      { name: 'users_limit',           enabled: true,  value: 20 },
      { name: 'xai_explanations',      enabled: true,  value: null },
      { name: 'priority_support',      enabled: true,  value: null },
      { name: 'api_access',            enabled: false, value: null },
    ],
  },
  {
    plan_id: HOSPITAL,
    name_en: 'Grand Hospital',
    name_ar: 'مستشفى كبير',
    description_en: 'Enterprise plan for large hospital networks. Unlimited usage, billed annually.',
    description_ar: 'خطة المؤسسات لشبكات المستشفيات الكبيرة. استخدام غير محدود مع فوترة سنوية.',
    price_monthly: null,
    price_annually: 8000000,
    is_trial: false,
    features: [
      { name: 'predictions_per_month', enabled: true,  value: null },
      { name: 'users_limit',           enabled: true,  value: null },
      { name: 'xai_explanations',      enabled: true,  value: null },
      { name: 'priority_support',      enabled: true,  value: null },
      { name: 'api_access',            enabled: true,  value: null },
    ],
  },
];

await sql.begin(async (tx) => {
  for (const p of PLANS) {
    await tx`
      UPDATE plans SET
        name_en        = ${p.name_en},
        name_ar        = ${p.name_ar},
        description_en = ${p.description_en},
        description_ar = ${p.description_ar},
        price_monthly  = ${p.price_monthly},
        price_annually = ${p.price_annually},
        is_trial       = ${p.is_trial},
        is_active      = TRUE,
        deleted_at     = NULL
      WHERE plan_id = ${p.plan_id}
    `;

    // Replace features for this plan
    await tx`DELETE FROM plan_features WHERE plan_id = ${p.plan_id}`;
    for (const f of p.features) {
      await tx`
        INSERT INTO plan_features (plan_id, name_en, name_ar, is_enabled, value)
        VALUES (${p.plan_id}, ${f.name}, ${AR[f.name]}, ${f.enabled}, ${f.value})
      `;
    }
  }
});

// Verify
const out = await sql`
  SELECT p.name_en, p.name_ar, p.price_monthly, p.price_annually, p.is_trial,
         COUNT(pf.feature_id) AS features
  FROM plans p LEFT JOIN plan_features pf ON pf.plan_id = p.plan_id
  WHERE p.deleted_at IS NULL
  GROUP BY p.plan_id, p.name_en, p.name_ar, p.price_monthly, p.price_annually, p.is_trial
  ORDER BY p.is_trial DESC, COALESCE(p.price_monthly, p.price_annually) ASC NULLS LAST`;
console.table(out);

await sql.end();
console.log('✓ Plans reseeded.');
