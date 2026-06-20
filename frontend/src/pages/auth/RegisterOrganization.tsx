import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2, UserCircle, Building2,
  CreditCard, CheckCircle2, ChevronRight, Check,
  Zap, Shield, Building,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { formatDZD } from '@/lib/formatPrice';
import {
  registerOrgStep1Schema, registerOrgStep2Schema, registerOrgStep3Schema,
  flattenZodErrors,
} from '@/api/schemas';
import { useTranslation, Trans } from 'react-i18next';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  plan_id:       string;
  name_en:       string;
  name_ar:       string;
  description_en:string;
  description_ar:string;
  price_monthly: number | null;
  price_annually:number | null;
  is_trial:      boolean;
  features:      { name_en: string; name_ar: string; is_enabled: boolean; value: number | null }[];
}

type Step = 1 | 2 | 3 | 4;

const FEATURE_LABELS: Record<string, string> = {
  predictions_per_month: 'AI Predictions / month',
  users_limit:           'Max staff members',
  xai_explanations:      'XAI explanations',
  priority_support:      'Priority support',
  api_access:            'API access',
};

const ORG_TYPES = [
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'CLINIC',   label: 'Clinic'   },
  { value: 'LAB',      label: 'Laboratory' },
  { value: 'OTHER',    label: 'Other'    },
];

const PLAN_ICON: Record<string, React.ElementType> = {
  'Trial':          Zap,
  'Private Clinic': Shield,
  'Grand Hospital': Building,
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const { t } = useTranslation('auth');
  const steps = [
    { n: 1, label: t('register.step1Label'),  icon: UserCircle },
    { n: 2, label: t('register.step2Label'),  icon: Building2  },
    { n: 3, label: t('register.step3Label'),  icon: CreditCard },
  ];
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {steps.map(({ n, label }, idx) => {
        const done   = current > n;
        const active = current === n;
        return (
          <div key={n} className="flex items-center gap-1">
            {/* Step bubble */}
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
              done   ? 'bg-[#00a89c] text-white'
              : active ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
            }`}>
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${
              active ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {label}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight className={`h-3.5 w-3.5 mx-1 ${done ? 'text-[#00a89c]' : 'text-muted-foreground/40'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Reusable field component ─────────────────────────────────────────────────
function Field({
  id, label, type = 'text', placeholder, value, onChange, error, optional,
}: {
  id: string; label: string; type?: string; placeholder?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {optional && <span className="text-muted-foreground text-xs font-normal ml-1 pr-1">{optional}</span>}
      </Label>
      <Input
        id={id} type={type} placeholder={placeholder}
        value={value} onChange={onChange}
        className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
        autoComplete={type === 'password' ? 'new-password' : id}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterOrganization() {
  const { t, i18n } = useTranslation('auth');
  const lang = i18n.language;
  const { t: c }  = useTranslation('common');
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [step,    setStep]    = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '', preferred_lang: 'en',
    org_name: '', org_type: '', org_email: '', org_address: '',
    plan_id: '',
  });

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  useEffect(() => {
    if (step === 3 && plans.length === 0) {
      ApiManager.execute({
        queryKey: ['plans'],
        endpoint:  '/plans',
        onSuccess: (d) => setPlans((d as { plans: Plan[] }).plans),
      });
    }
  }, [step]);

  const validateStep1 = () => {
    const result = registerOrgStep1Schema.safeParse(form);
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return false; }
    setErrors({}); return true;
  };
  const validateStep2 = () => {
    const result = registerOrgStep2Schema.safeParse(form);
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return false; }
    setErrors({}); return true;
  };
  const validateStep3 = () => {
    const result = registerOrgStep3Schema.safeParse(form);
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return false; }
    setErrors({}); return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) { setErrors({}); setStep(2); }
    if (step === 2 && validateStep2()) { setErrors({}); setStep(3); }
  };

  const handleSubmit = () => {
    if (!validateStep3()) return;
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/organizations', {
        username: form.username, email: form.email, password: form.password,
        preferred_lang: form.preferred_lang,
        org_name: form.org_name, org_type: form.org_type,
        org_email: form.org_email, org_address: form.org_address || undefined,
        plan_id: form.plan_id,
      }),
      onStart:   () => setLoading(true),
      onSuccess: (_data, msg) => {
        toast({ title: t('register.registrationSuccess'), description: msg });
        setStep(4);
      },
      onError: ({ message, fields }) => {
        if (fields) {
          setErrors(fields);
          const step1Keys = ['username', 'email', 'password'];
          const step2Keys = ['org_name', 'org_type', 'org_email'];
          if (Object.keys(fields).some(k => step1Keys.includes(k))) setStep(1);
          else if (Object.keys(fields).some(k => step2Keys.includes(k))) setStep(2);
        } else {
          toast({ title: t('register.registrationFailed'), description: message, variant: 'destructive' });
        }
      },
      onFinal: () => setLoading(false),
    });
  };

  // Password strength
  const pwChecks = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /[a-z]/.test(form.password),
    /[0-9]/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ];
  const pwScore = pwChecks.filter(Boolean).length;
  const pwLabels = ['', t('register.pwStrength.weak'), t('register.pwStrength.fair'), t('register.pwStrength.good'), t('register.pwStrength.strong'), t('register.pwStrength.veryStrong')];
  const pwBarColors = ['', 'bg-[#c0272d]', 'bg-[#e07020]', 'bg-[#faaf3a]', 'bg-[#00a89c]', 'bg-[#00a89c]'];
  const pwTextColors = ['', 'text-[#c0272d]', 'text-[#e07020]', 'text-[#a2680a]', 'text-[#007a71]', 'text-[#007a71]'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-between w-full mb-8">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <span className="text-xl font-semibold tracking-tight">{c('brand')}</span>
          </div>
          <LanguageToggle />
        </div>

        {step < 4 && <StepBar current={step} />}

        {/* ── Step 1: Account ─────────────────────────────────────────────── */}
        {step === 1 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-4 w-4 text-primary" />
                </div>
                {t('register.step1Title')}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                <Trans i18nKey="register.step1Description" t={t}>
                  You will become the <span className="font-medium text-foreground">Hospital Manager</span> of your organization. Doctors and lab technicians join later via invitation.
                </Trans>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="username" label={t('register.username')} placeholder={t('register.usernamePlaceholder')}
                value={form.username} onChange={set('username')} error={errors.username} />
              <Field id="email" label={t('register.email')} type="email" placeholder={t('register.emailPlaceholder')}
                value={form.email} onChange={set('email')} error={errors.email} />
              <div className="grid grid-cols-2 gap-3">
                <Field id="password" label={t('register.password')} type="password" placeholder={t('register.passwordPlaceholder')}
                  value={form.password} onChange={set('password')} error={errors.password} />
                <Field id="confirm" label={t('register.confirm')} type="password" placeholder={t('register.confirmPlaceholder')}
                  value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
              </div>

              {/* Password strength meter */}
              {form.password.length > 0 && (
                <div className="space-y-1.5 -mt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= pwScore ? pwBarColors[pwScore] : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${pwTextColors[pwScore]}`}>
                    {pwLabels[pwScore]}
                    {pwScore < 4 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        — {!pwChecks[0] ? t('register.pwStrength.hint8chars')
                           : !pwChecks[1] ? t('register.pwStrength.hintUppercase')
                           : !pwChecks[3] ? t('register.pwStrength.hintNumber')
                           : t('register.pwStrength.hintSpecial')}
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm">{t('register.language')}</Label>
                <Select value={form.preferred_lang} onValueChange={v => setForm(p => ({ ...p, preferred_lang: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{c('language.en')}</SelectItem>
                    <SelectItem value="ar">{c('language.ar')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full gap-2" onClick={nextStep}>
                {c('actions.continue')} <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Organization ────────────────────────────────────────── */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                {t('register.step2Title')}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {t('register.step2Description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="org_name" label={t('register.orgName')} placeholder={t('register.orgNamePlaceholder')}
                value={form.org_name} onChange={set('org_name')} error={errors.org_name} />

              <div className="space-y-1.5">
                <Label className="text-sm">{t('register.orgType')}</Label>
                <Select value={form.org_type} onValueChange={v => setForm(p => ({ ...p, org_type: v }))}>
                  <SelectTrigger className={errors.org_type ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('register.orgTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map(o => (
                      <SelectItem key={o.value} value={o.value}>{t(`register.orgTypes.${o.label.toLowerCase()}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.org_type && <p className="text-xs text-destructive">{errors.org_type}</p>}
              </div>

              <Field id="org_email" label={t('register.orgEmail')} type="email" placeholder={t('register.orgEmailPlaceholder')}
                value={form.org_email} onChange={set('org_email')} error={errors.org_email} />
              <Field id="org_address" label={t('register.orgAddress')} placeholder={t('register.orgAddressPlaceholder')}
                value={form.org_address} onChange={set('org_address')} optional={t('register.optional') as any} />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>{c('actions.back')}</Button>
                <Button className="flex-1 gap-2" onClick={nextStep}>
                  {c('actions.continue')} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Choose Plan ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  {t('register.step3Title')}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('register.step3Description')}
                </CardDescription>
              </CardHeader>
            </Card>

            {plans.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map(plan => {
                  const PlanIcon = PLAN_ICON[plan.name_en] ?? CreditCard;
                  const selected = form.plan_id === plan.plan_id;
                  const planName = lang === 'ar' && plan.name_ar ? plan.name_ar : plan.name_en;
                  const planDesc = lang === 'ar' && plan.description_ar ? plan.description_ar : plan.description_en;
                  return (
                    <button
                      key={plan.plan_id}
                      onClick={() => { setForm(p => ({ ...p, plan_id: plan.plan_id })); setErrors({}); }}
                      className={`w-full text-left rounded-[var(--radius)] border-2 p-4 transition-all ${
                        selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Plan icon */}
                        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center transition-colors ${
                          selected ? 'bg-primary' : 'bg-muted'
                        }`}>
                          <PlanIcon className={`h-5 w-5 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        </div>

                        {/* Plan details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-foreground">{planName}</span>
                            {plan.is_trial && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30">
                                {t('register.trialBadge')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{planDesc}</p>

                          {/* Price */}
                          <div className="flex items-baseline gap-1 mb-3">
                            {plan.price_monthly ? (
                              <>
                                <span className="text-2xl font-semibold text-foreground">{formatDZD(plan.price_monthly, lang)}</span>
                                <span className="text-xs text-muted-foreground">{t('register.perMonth')}</span>
                              </>
                            ) : plan.price_annually ? (
                              <>
                                <span className="text-2xl font-semibold text-foreground">{formatDZD(plan.price_annually, lang)}</span>
                                <span className="text-xs text-muted-foreground">{t('register.perYear')}</span>
                              </>
                            ) : (
                              <span className="text-lg font-semibold text-[#007a71]">{t('register.free')}</span>
                            )}
                          </div>

                          {/* Features */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {plan.features.map(f => (
                              <span
                                key={f.name_en}
                                className={`flex items-center gap-1 text-xs ${
                                  f.is_enabled ? 'text-foreground' : 'text-muted-foreground line-through'
                                }`}
                              >
                                <Check className={`h-3 w-3 ${f.is_enabled ? 'text-[#00a89c]' : 'text-muted-foreground'}`} />
                                {t(`register.featureLabels.${f.name_en}`) ?? (lang === 'ar' && f.name_ar ? f.name_ar : f.name_en)}
                                {f.value !== null && `: ${f.value}`}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Radio indicator */}
                        <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5 transition-all ${
                          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                        }`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {errors.plan_id && (
              <p className="text-sm text-destructive text-center">{errors.plan_id}</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>{c('actions.back')}</Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={loading || !form.plan_id}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('register.creating')}</>
                  : <>{t('register.completeRegistration')} <ChevronRight className="h-4 w-4" /></>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ────────────────────────────────────────────────── */}
        {step === 4 && (
          <Card>
            <CardContent className="pt-10 pb-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-[#00a89c]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground tracking-tight">{t('register.doneTitle')}</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
                  {t('register.doneDescription')}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" onClick={() => navigate('/login')}>
                  {t('register.signInNow')}
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/">{t('register.backToHome')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step < 4 && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('register.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">{t('register.signIn')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
