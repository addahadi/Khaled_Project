import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/auth/forgot-password', { email }),
      onStart:   () => setLoading(true),
      onSuccess: () => setSent(true),
      onError:   ({ message }) => toast({ title: 'Request failed', description: message, variant: 'destructive' }),
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

        {sent ? (
          /* ── Success state ── */
          <div>
            <div className="w-12 h-12 rounded-full bg-[#00a89c]/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="h-6 w-6 text-[#00a89c]" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
              Check your inbox
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              If an account exists for{' '}
              <span className="font-medium text-foreground">{email}</span>,
              a password reset link will arrive within a few minutes.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        ) : (
          /* ── Request form ── */
          <div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">
              Reset password
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Enter the email address associated with your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-sm">Email address</Label>
                <Input
                  id="reset-email" type="email" placeholder="you@hospital.dz"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
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
