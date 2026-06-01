import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, Loader2, CheckCircle2 } from 'lucide-react';
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

  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [activated, setActivated] = useState<ActivationResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleActivate = () => {
    const result = activateAccountSchema.safeParse({ username, password, confirm });
    if (!result.success) { setFieldErrors(flattenZodErrors(result.error)); return; }
    setFieldErrors({});

    ApiManager.executeMutation({
      mutationFn: () =>
        apiClient.patch(`/invitations/activate/${token}`, { username, password }),
      onStart: () => setLoading(true),
      onSuccess: (data, msg) => {
        const res = data as ActivationResult;
        setActivated(res);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4">
      <div className="w-full max-w-md">

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">DiagInfect</span>
        </div>

        {/* ── Activated state ────────────────────────────────────────────── */}
        {activated ? (
          <Card className="shadow-lg text-center">
            <CardContent className="pt-10 pb-8 space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Account Activated!</h2>
              <p className="text-muted-foreground text-sm">
                Welcome to DiagInfect, <strong>{username}</strong>. Your account is ready.
              </p>
              <Button
                className="w-full"
                onClick={() => navigate(ROLE_DASHBOARD[activated.role] ?? '/login')}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* ── Activation form ────────────────────────────────────────────── */
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle>Set Up Your Account</CardTitle>
              <CardDescription>
                You've been invited to join DiagInfect. Choose a username and password to activate your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Username</Label>
                <Input
                  placeholder="dr.benali"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className={fieldErrors.username ? 'border-destructive' : ''}
                />
                {fieldErrors.username && (
                  <p className="text-xs text-destructive">{fieldErrors.username}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={fieldErrors.password ? 'border-destructive' : ''}
                />
                {fieldErrors.password && (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={fieldErrors.confirm ? 'border-destructive' : ''}
                />
                {fieldErrors.confirm && (
                  <p className="text-xs text-destructive">{fieldErrors.confirm}</p>
                )}
              </div>

              <Button className="w-full" onClick={handleActivate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate Account
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
