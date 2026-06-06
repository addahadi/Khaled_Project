import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function ForgotPassword() {
 const [email, setEmail]  = useState('');
 const [loading, setLoading] = useState(false);
 const [sent, setSent]  = useState(false);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!email) return;
 setLoading(true);
 setTimeout(() => { setLoading(false); setSent(true); }, 1200);
 };

 return (
 <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
 <div className="w-full max-w-sm">
 <div className="flex items-center gap-3 mb-12">
 <BrandLogo size="sm" />
 <span className="text-base font-normal">DiagInfect</span>
 </div>

 {sent ? (
 <div>
 <div className="w-10 h-10 bg-[#defbe6] flex items-center justify-center mb-6">
 <CheckCircle2 className="h-5 w-5 text-[#24a148]" />
 </div>
 <h1 className="text-[28px] font-light text-foreground mb-2">Check your inbox</h1>
 <p className="text-sm text-muted-foreground leading-relaxed tracking-[0.16px] mb-8">
 If an account exists for <strong className="font-normal text-foreground">{email}</strong>,
 a password reset link will arrive within a few minutes.
 </p>
 <Link to="/login"
 className="inline-flex items-center gap-2 text-sm text-primary hover:underline tracking-[0.16px]">
 <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
 </Link>
 </div>
 ) : (
 <div>
 <h1 className="text-[28px] font-light text-foreground mb-1">Reset password</h1>
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-8">
 Enter the email address associated with your account.
 </p>

 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <Label htmlFor="reset-email"
 className="block text-xs text-muted-foreground tracking-[0.32px] mb-1.5">
 Email address
 </Label>
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
 <Link to="/login"
 className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors tracking-[0.16px]">
 <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
 </Link>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
