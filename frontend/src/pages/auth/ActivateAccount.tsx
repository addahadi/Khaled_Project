import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '../../api/ApiManager';
import apiClient from '../../api/apiClient';
import type { UserRole } from '../../contexts/AuthContext';
import { activateAccountSchema, flattenZodErrors } from '../../api/schemas';

interface ActivationResult {
  activated: boolean;
  email:     string;
  role:      UserRole;
}

const ROLE_DASHBOARD: Record<string, string> = {
  DOCTOR:   '/doctor/dashboard',
  LAB_TECH: '/lab/dashboard',
  MANAGER:  '/manager/dashboard',
};

export default function ActivateAccount() {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const { toast }  = useToast();

  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [activated,   setActivated]   = useState<ActivationResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleActivate = () => {
    const result = activateAccountSchema.safeParse({ username, password, confirm });
    if (!result.success) { setFieldErrors(flattenZodErrors(result.error)); return; }
    setFieldErrors({});

    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/invitations/activate/${token}`, { username, password }),
      onStart:   () => setLoading(true),
      onSuccess: (data, msg) => {
        setActivated(data as ActivationResult);
        toast({ title: 'Account activated!', description: msg });
      },
      onError: ({ message, fields }) => {
        if (fields) setFieldErrors(fields);
        else toast({ title: 'Activation failed', description: message, variant: 'destructive' });
      },
      onFinal: () => setLoading(false),
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[380px]">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <BrandLogo size="md" />
          <span className="text-lg font-semibold tracking-tight">DiagInfect</span>
        </div>

        {activated ? (
          /* ── Activated state ── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-[#00a89c]" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
              Account Activated!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Welcome to DiagInfect,{' '}
              <span className="font-medium text-foreground">{username}</span>.
              Your account is ready to use.
            </p>
            <Button
              className="w-full"
              onClick={() => navigate(ROLE_DASHBOARD[activated.role] ?? '/login')}
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
          /* ── Activation form ── */
          <div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">
              Set Up Your Account
            </h1>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              You've been invited to join DiagInfect. Choose a username and password to activate your account.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Username</Label>
                <Input
                  placeholder="dr.benali"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className={fieldErrors.username ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {fieldErrors.username && <p className="text-xs text-destructive">{fieldErrors.username}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Password</Label>
                <Input
                  type="password" placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={fieldErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Confirm Password</Label>
                <Input
                  type="password" placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={fieldErrors.confirm ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {fieldErrors.confirm && <p className="text-xs text-destructive">{fieldErrors.confirm}</p>}
              </div>

              <Button className="w-full" onClick={handleActivate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Account
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
