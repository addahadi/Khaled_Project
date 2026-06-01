import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type AuthUser, type UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Activity } from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { loginSchema, flattenZodErrors } from '@/api/schemas';

const DASHBOARD: Record<UserRole, string> = {
  DOCTOR:   '/doctor/dashboard',
  LAB_TECH: '/lab/dashboard',
  MANAGER:  '/manager/dashboard',
};

export default function Login() {
  const { setAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Zod validation before API call
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(flattenZodErrors(result.error));
      return;
    }

    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/auth/login', { email, password }),
      onStart: () => setLoading(true),
      onSuccess: (data) => {
        const res = data as { accessToken: string; user: AuthUser };
        setAuthenticated(res.user, res.accessToken);
        navigate(DASHBOARD[res.user.role] ?? '/login', { replace: true });
      },
      onError: ({ message, fields }) => {
        if (fields) {
          setErrors(fields);
        } else {
          toast({
            title:       'Login failed',
            description: message,
            variant:     'destructive',
          });
        }
      },
      onFinal: () => setLoading(false),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gradient-to-br from-background to-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">DiagInfect</span>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your clinical account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" placeholder="you@hospital.dz"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                  required autoComplete="email"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className={errors.password ? 'border-destructive' : ''}
                  required autoComplete="current-password"
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                New to DiagInfect?{' '}
                <Link to="/register-organization"
                  className="text-primary hover:underline font-medium">
                  Register your organization
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">
                Staff member?{' '}
                <span className="text-muted-foreground">
                  Check your email for an invitation link.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
