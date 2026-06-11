import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type AuthUser, type UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, ShieldCheck, Brain, FlaskConical } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { loginSchema, flattenZodErrors } from '@/api/schemas';

const DASHBOARD: Record<UserRole, string> = {
  DOCTOR:   '/doctor/dashboard',
  LAB_TECH: '/lab/dashboard',
  MANAGER:  '/manager/dashboard',
};

const FEATURES = [
  { icon: Brain,       text: 'AI-powered infection risk prediction' },
  { icon: FlaskConical,text: 'Integrated lab workflow management'   },
  { icon: ShieldCheck, text: 'WCAG-accessible clinical interface'   },
];

export default function Login() {
  const { setAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) { setErrors(flattenZodErrors(result.error)); return; }

    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/auth/login', { email, password }),
      onStart:   () => setLoading(true),
      onSuccess: (data) => {
        const res = data as { accessToken: string; user: AuthUser };
        setAuthenticated(res.user, res.accessToken);
        navigate(DASHBOARD[res.user.role] ?? '/login', { replace: true });
      },
      onError: ({ message, fields }) => {
        if (fields) setErrors(fields);
        else toast({ title: 'Login failed', description: message, variant: 'destructive' });
      },
      onFinal: () => setLoading(false),
    });
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left panel — brand surface ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#0d1829] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle gradient orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#2e368f]/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <BrandLogo size="md" />
          <span className="text-white text-lg font-semibold tracking-tight">DiagInfect</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <p className="text-primary/70 text-xs font-semibold tracking-widest uppercase mb-5">
            AI-powered clinical decision support
          </p>
          <h2 className="text-4xl font-semibold text-white leading-tight tracking-tight mb-4">
            Detect infectious<br />diseases earlier.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm mb-10">
            AI prediction models analyse routine biological markers — CRP, CBC, ESR —
            to surface infection risk before culture results arrive.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-white/70">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs relative z-10">
          © {new Date().getFullYear()} DiagInfect · Ibn Khaldoun University, Tiaret
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <BrandLogo size="md" />
          <span className="text-lg font-semibold tracking-tight">DiagInfect</span>
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Use your clinical account credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">Email address</Label>
              <Input
                id="email" type="email" placeholder="you@hospital.dz"
                value={email} onChange={e => setEmail(e.target.value)}
                className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                required autoComplete="email"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className={`pr-11 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  required autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-muted-foreground hover:text-foreground border-l border-border transition-colors rounded-r-[var(--radius)]"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border space-y-2.5">
            <p className="text-sm text-muted-foreground">
              New organization?{' '}
              <Link to="/register-organization" className="text-primary hover:underline font-medium">
                Register here
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Staff member? Check your email for an invitation link.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
