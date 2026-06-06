import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type AuthUser, type UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { loginSchema, flattenZodErrors } from '@/api/schemas';

const DASHBOARD: Record<UserRole, string> = {
 DOCTOR:  '/doctor/dashboard',
 LAB_TECH: '/lab/dashboard',
 MANAGER:  '/manager/dashboard',
};

export default function Login() {
 const { setAuthenticated } = useAuth();
 const navigate  = useNavigate();
 const { toast } = useToast();

 const [email,  setEmail]  = useState('');
 const [password, setPassword] = useState('');
 const [loading,  setLoading]  = useState(false);
 const [showPwd,  setShowPwd]  = useState(false);
 const [errors,  setErrors]  = useState<Record<string, string>>({});

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 setErrors({});
 const result = loginSchema.safeParse({ email, password });
 if (!result.success) { setErrors(flattenZodErrors(result.error)); return; }

 ApiManager.executeMutation({
 mutationFn: () => apiClient.post('/auth/login', { email, password }),
 onStart: () => setLoading(true),
 onSuccess: (data) => {
 const res = data as { accessToken: string; user: AuthUser };
 setAuthenticated(res.user, res.accessToken);
 navigate(DASHBOARD[res.user.role] ?? '/login', { replace: true });
 },
 onError: ({ message, fields }) => {
 if (fields) { setErrors(fields); }
 else { toast({ title: 'Login failed', description: message, variant: 'destructive' }); }
 },
 onFinal: () => setLoading(false),
 });
 };

 return (
 /* IBM Carbon: white canvas, centered form, no gradient */
 <div className="min-h-screen bg-background flex">
 {/* Left panel — charcoal brand surface */}
 <div className="hidden lg:flex lg:w-1/2 bg-[#161616] flex-col justify-between p-12">
 <div className="flex items-center gap-3">
 <BrandLogo size="md" />
 <span className="text-white text-lg font-normal">DiagInfect</span>
 </div>
 <div>
 <p className="text-[#8d8d8d] text-xs tracking-[0.32px] uppercase mb-6">
 AI-powered clinical decision support
 </p>
 <h2 className="text-[42px] font-light text-white leading-[1.17]"
 style={{ letterSpacing: '-0.3px' }}>
 Detect infectious diseases earlier.
 </h2>
 <p className="text-[#c6c6c6] text-base mt-4 leading-relaxed tracking-[0.16px]">
 AI prediction models analyse routine biological markers — CRP, CBC, ESR — 
 to surface infection risk before culture results arrive.
 </p>
 </div>
 <p className="text-[#525252] text-xs tracking-[0.32px]">
 © {new Date().getFullYear()} DiagInfect · Ibn Khaldoun University, Tiaret
 </p>
 </div>

 {/* Right panel — form */}
 <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
 {/* Mobile logo */}
 <div className="lg:hidden flex items-center gap-3 mb-10">
 <BrandLogo size="md" />
 <span className="text-lg font-normal">DiagInfect</span>
 </div>

 <div className="w-full max-w-sm">
 <h1 className="text-[28px] font-light text-foreground mb-1">Sign in</h1>
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-8">
 Use your clinical account credentials.
 </p>

 <form onSubmit={handleSubmit} className="space-y-0">
 {/* Email field */}
 <div className="mb-5">
 <Label htmlFor="email"
 className="block text-xs text-muted-foreground tracking-[0.32px] mb-1.5">
 Email address
 </Label>
 <Input
 id="email" type="email" placeholder="you@hospital.dz"
 value={email} onChange={e => setEmail(e.target.value)}
 className={errors.email ? 'border-destructive ring-destructive' : ''}
 required autoComplete="email"
 />
 {errors.email && (
 <p className="text-xs text-destructive mt-1.5 tracking-[0.16px]">
 {errors.email}
 </p>
 )}
 </div>

 {/* Password field */}
 <div className="mb-6">
 <div className="flex items-center justify-between mb-1.5">
 <Label htmlFor="password"
 className="text-xs text-muted-foreground tracking-[0.32px]">
 Password
 </Label>
 <Link to="/forgot-password"
 className="text-xs text-primary hover:underline tracking-[0.16px]">
 Forgot password?
 </Link>
 </div>
 <div className="relative">
 <Input
 id="password" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
 value={password} onChange={e => setPassword(e.target.value)}
 className={`pr-12 ${errors.password ? 'border-destructive ring-destructive' : ''}`}
 required autoComplete="current-password"
 />
 <button
 type="button"
 onClick={() => setShowPwd(p => !p)}
 className="absolute right-0 top-0 h-full w-12 flex items-center justify-center text-muted-foreground hover:text-foreground border-l border-border transition-colors"
 aria-label={showPwd ? 'Hide password' : 'Show password'}
 >
 {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 {errors.password && (
 <p className="text-xs text-destructive mt-1.5 tracking-[0.16px]">
 {errors.password}
 </p>
 )}
 </div>

 <Button type="submit" className="w-full" disabled={loading}>
 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
 Sign in
 </Button>
 </form>

 <div className="mt-6 pt-6 border-t border-border space-y-3">
 <p className="text-sm text-muted-foreground tracking-[0.16px]">
 New organization?{' '}
 <Link to="/register-organization" className="text-primary hover:underline">
 Register here
 </Link>
 </p>
 <p className="text-xs text-muted-foreground tracking-[0.16px]">
 Staff member? Check your email for an invitation link.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
