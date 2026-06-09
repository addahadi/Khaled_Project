import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !token) return;
    if (password !== confirmPassword) {
      toast({ title: 'Validation error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/auth/reset-password', { token, password }),
      onStart: () => setLoading(true),
      onSuccess: () => setSuccess(true),
      onError: ({ message }) => {
        toast({ title: 'Reset failed', description: message, variant: 'destructive' });
      },
      onFinal: () => setLoading(false),
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-12">
          <BrandLogo size="sm" />
          <span className="text-base font-normal">DiagInfect</span>
        </div>

        {success ? (
          <div>
            <div className="w-10 h-10 bg-[#defbe6] flex items-center justify-center mb-6">
              <CheckCircle2 className="h-5 w-5 text-[#24a148]" />
            </div>
            <h1 className="text-[28px] font-light text-foreground mb-2">Password reset</h1>
            <p className="text-sm text-muted-foreground leading-relaxed tracking-[0.16px] mb-8">
              Your password has been successfully reset. You can now use your new password to sign in.
            </p>
            <Link to="/login"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline tracking-[0.16px]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        ) : (
          <div>
            <h1 className="text-[28px] font-light text-foreground mb-1">Set new password</h1>
            <p className="text-sm text-muted-foreground tracking-[0.16px] mb-8">
              Please enter your new password below. Must be at least 8 characters.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="new-password"
                       className="block text-xs text-muted-foreground tracking-[0.32px] mb-1.5">
                  New password
                </Label>
                <Input
                  id="new-password" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                />
              </div>
              <div>
                <Label htmlFor="confirm-password"
                       className="block text-xs text-muted-foreground tracking-[0.32px] mb-1.5">
                  Confirm new password
                </Label>
                <Input
                  id="confirm-password" type="password" placeholder="••••••••"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset password
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
