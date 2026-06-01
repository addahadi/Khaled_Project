import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Loader2, UserCircle, Building2,
  CreditCard, CheckCircle2, ChevronRight, Check,
  Zap, Shield, Building,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import {
  registerOrgStep1Schema, registerOrgStep2Schema, registerOrgStep3Schema,
  flattenZodErrors,
} from '@/api/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  plan_id:       string;
  name:          string;
  description:   string;
  price_monthly: number | null;
  is_trial:      boolean;
  features:      { name: string; is_enabled: boolean; value: number | null }[];
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
  { value: 'CLINIC',   label: 'Clinic' },
  { value: 'LAB',      label: 'Laboratory' },
  { value: 'OTHER',    label: 'Other' },
];

const PLAN_ICON: Record<string, React.ElementType> = {
  Trial:    Zap,
  Clinic:   Shield,
  Hospital: Building,
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Your Account',   icon: UserCircle },
    { n: 2, label: 'Organization',   icon: Building2 },
    { n: 3, label: 'Choose Plan',    icon: CreditCard },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map(({ n, label, icon: Icon }, idx) => {
        const done    = current > n;
        const active  = current === n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all
              ${done   ? 'bg-green-500 text-white'
              : active ? 'bg-primary text-primary-foreground'
              :          'bg-muted text-muted-foreground'}`}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </div>
            <span className={`hidden sm:block text-xs font-medium
              ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight className={`h-4 w-4 mx-1 ${done ? 'text-green-500' : 'text-muted-foreground'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegisterOrganization() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step,    setStep]    = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  // ── Form state across all 3 steps ────────────────────────────────────────
  const [form, setForm] = useState({
    // Step 1 — account
    username:       '',
    email:          '',
    password:       '',
    confirm:        '',
    preferred_lang: 'en',
    // Step 2 — organization
    org_name:    '',
    org_type:    '',
    org_email:   '',
    org_address: '',
    // Step 3 — plan
    plan_id: '',
  });

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  // Load plans when entering step 3
  useEffect(() => {
    if (step === 3 && plans.length === 0) {
      ApiManager.execute({
        queryKey: ['plans'],
        endpoint: '/plans',
        onSuccess: (d) => setPlans((d as { plans: Plan[] }).plans),
      });
    }
  }, [step]);

  // ── Validation per step (Zod) ──────────────────────────────────────────────
  const validateStep1 = () => {
    const result = registerOrgStep1Schema.safeParse(form);
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return false; }
    setErrors({});
    return true;
  };

  const validateStep2 = () => {
    const result = registerOrgStep2Schema.safeParse(form);
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return false; }
    setErrors({});
    return true;
  };

  const validateStep3 = () => {
    const result = registerOrgStep3Schema.safeParse(form);
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return false; }
    setErrors({});
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) { setErrors({}); setStep(2); }
    if (step === 2 && validateStep2()) { setErrors({}); setStep(3); }
  };

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!validateStep3()) return;

    ApiManager.executeMutation({
      mutationFn: () =>
        apiClient.post('/organizations', {
          username:       form.username,
          email:          form.email,
          password:       form.password,
          preferred_lang: form.preferred_lang,
          org_name:       form.org_name,
          org_type:       form.org_type,
          org_email:      form.org_email,
          org_address:    form.org_address || undefined,
          plan_id:        form.plan_id,
        }),
      onStart: () => setLoading(true),
      onSuccess: (_data, msg) => {
        toast({ title: 'Organization registered!', description: msg });
        setStep(4);
      },
      onError: ({ message, fields }) => {
        if (fields) {
          setErrors(fields);
          // Return to the step that has the error
          const step1Keys = ['username','email','password'];
          const step2Keys = ['org_name','org_type','org_email'];
          if (Object.keys(fields).some(k => step1Keys.includes(k))) setStep(1);
          else if (Object.keys(fields).some(k => step2Keys.includes(k))) setStep(2);
        } else {
          toast({ title: 'Registration failed', description: message, variant: 'destructive' });
        }
      },
      onFinal: () => setLoading(false),
    });
  };

  const Field = ({
    id, label, type = 'text', placeholder, value, onChange, error, optional,
  }: {
    id: string; label: string; type?: string; placeholder?: string;
    value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string; optional?: boolean;
  }) => (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground text-xs ml-1">(optional)</span>}
      </Label>
      <Input
        id={id} type={type} placeholder={placeholder}
        value={value} onChange={onChange}
        className={error ? 'border-destructive' : ''}
        autoComplete={type === 'password' ? 'new-password' : id}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-background to-muted/30 px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">DiagInfect</span>
        </div>

        {step < 4 && <StepBar current={step} />}

        {/* ── Step 1: Account ───────────────────────────────────────────────── */}
        {step === 1 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" /> Your Account
              </CardTitle>
              <CardDescription>
                You will become the <strong>Hospital Manager</strong> of your organization.
                Doctors and lab technicians join later via invitation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="username"  label="Username"         placeholder="dr.benali"
                value={form.username}  onChange={set('username')}  error={errors.username} />
              <Field id="email"     label="Email"            type="email" placeholder="you@hospital.dz"
                value={form.email}     onChange={set('email')}     error={errors.email} />
              <div className="grid grid-cols-2 gap-3">
                <Field id="password" label="Password" type="password" placeholder="Min. 8 chars"
                  value={form.password} onChange={set('password')} error={errors.password} />
                <Field id="confirm"  label="Confirm"  type="password" placeholder="Repeat password"
                  value={form.confirm}  onChange={set('confirm')}  error={errors.confirm} />
              </div>

              <div className="space-y-1">
                <Label>Language</Label>
                <Select
                  value={form.preferred_lang}
                  onValueChange={v => setForm(p => ({ ...p, preferred_lang: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full gap-2" onClick={nextStep}>
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Organization ──────────────────────────────────────────── */}
        {step === 2 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Your Organization
              </CardTitle>
              <CardDescription>
                Tell us about the hospital or clinic you manage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field id="org_name"  label="Organization Name" placeholder="Al-Razi General Hospital"
                value={form.org_name}  onChange={set('org_name')}  error={errors.org_name} />

              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.org_type}
                  onValueChange={v => setForm(p => ({ ...p, org_type: v }))}
                >
                  <SelectTrigger className={errors.org_type ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select organization type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.org_type && <p className="text-xs text-destructive">{errors.org_type}</p>}
              </div>

              <Field id="org_email"   label="Official Email" type="email"
                placeholder="admin@hospital.dz"
                value={form.org_email}   onChange={set('org_email')}   error={errors.org_email} />
              <Field id="org_address" label="Address" placeholder="123 Rue Didouche Mourad, Algiers"
                value={form.org_address} onChange={set('org_address')} optional />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-1 gap-2" onClick={nextStep}>
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Choose Plan ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Choose Your Plan
                </CardTitle>
                <CardDescription>
                  You can upgrade or switch plans at any time from your dashboard.
                </CardDescription>
              </CardHeader>
            </Card>

            {plans.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4">
                {plans.map(plan => {
                  const PlanIcon = PLAN_ICON[plan.name] ?? CreditCard;
                  const selected = form.plan_id === plan.plan_id;

                  return (
                    <button
                      key={plan.plan_id}
                      onClick={() => { setForm(p => ({ ...p, plan_id: plan.plan_id })); setErrors({}); }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all
                        ${selected
                          ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                          : 'border-border hover:border-primary/40 hover:shadow-sm bg-card'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon + radio */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center
                                        rounded-xl transition-colors
                                        ${selected ? 'bg-primary' : 'bg-muted'}`}>
                          <PlanIcon className={`h-5 w-5 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        </div>

                        {/* Plan details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold">{plan.name}</span>
                            {plan.is_trial && (
                              <Badge variant="secondary" className="text-xs">14-day trial</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>

                          {/* Price */}
                          <div className="flex items-end gap-1 mb-3">
                            {plan.price_monthly ? (
                              <>
                                <span className="text-2xl font-bold">${plan.price_monthly}</span>
                                <span className="text-muted-foreground text-sm mb-0.5">/month</span>
                              </>
                            ) : (
                              <span className="text-lg font-semibold text-green-600">Free</span>
                            )}
                          </div>

                          {/* Features */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {plan.features.map(f => (
                              <span
                                key={f.name}
                                className={`flex items-center gap-1 text-xs
                                  ${f.is_enabled ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                              >
                                <Check className={`h-3 w-3 ${f.is_enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                                {FEATURE_LABELS[f.name] ?? f.name}
                                {f.value !== null && `: ${f.value}`}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Selected indicator */}
                        <div className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center mt-1
                          ${selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
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
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={loading || !form.plan_id}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  : <>Complete Registration <ChevronRight className="h-4 w-4" /></>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ──────────────────────────────────────────────────── */}
        {step === 4 && (
          <Card className="shadow-lg text-center">
            <CardContent className="pt-10 pb-8 space-y-4">
              <div className="flex h-16 w-16 items-center justify-center
                              rounded-full bg-green-100 mx-auto">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">You're all set!</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Your organization and manager account are ready.
                Sign in to start inviting your doctors and lab technicians.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" onClick={() => navigate('/login')}>
                  Sign In Now
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step < 4 && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
