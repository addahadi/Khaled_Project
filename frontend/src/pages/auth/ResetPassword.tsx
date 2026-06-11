import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, CheckCircle2, LockKeyhole } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token          = searchParams.get('token');
  const navigate       = useNavigate();
  const { toast }      = useToast();

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [success,         setSuccess]         = useState(false);
  const [matchError,      setMatchError]      = useState('');

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError('');
    if (!password || !token) return;
    if (password !== confirmPassword) {
      setMatchError('Passwords do not match.');
      return;
    }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/auth/reset-password', { token, password }),
      onStart:   () => setLoading(true),
      onSuccess: () => setSuccess(true),
      onError:   ({ message }) => toast({ title: 'Reset failed', description: message, variant: 'destructive' }),
      onFinal:   () => setLoading(false),
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <BrandLogo size="sm" />
          <span className="text-base font-semibold tracking-tight">DiagInfect</span>
        </div>

        {success ? (
          /* ── Success state ── */
          <div>
            <div className="w-12 h-12 rounded-full bg-[#00a89c]/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="h-6 w-6 text-[#00a89c]" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
              Password reset
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Go to Sign In
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">
              Set new password
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Please enter your new password below. Must be at least 8 characters.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm">New password</Label>
                <Input
                  id="new-password" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm">Confirm new password</Label>
                <Input
                  id="confirm-password" type="password" placeholder="••••••••"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className={matchError ? 'border-destructive focus-visible:ring-destructive' : ''}
                  required minLength={8}
                />
                {matchError && <p className="text-xs text-destructive">{matchError}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset password
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
