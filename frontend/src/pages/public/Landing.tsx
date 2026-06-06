import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, FlaskConical, Shield, Activity } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

const FEATURES = [
 {
 icon: Brain,
 eyebrow: 'AI prediction',
 title: 'Early risk assessment',
 description:
 'Machine learning models (Random Forest, XGBoost, Neural Networks) trained on real infectious disease datasets deliver risk scores in under 2 seconds — before culture results are available.',
 },
 {
 icon: FlaskConical,
 eyebrow: 'Lab integration',
 title: 'Seamless lab workflow',
 description:
 'Bidirectional data flow between doctors and lab technicians. CRP, CBC, ESR, and NFS results link directly to patient records with anomaly alerts built in.',
 },
 {
 icon: Shield,
 eyebrow: 'Explainable AI',
 title: 'Decisions you can trust',
 description:
 'Every prediction comes with a ranked explanation of the contributing factors. Clinical trust requires transparency — not a black box.',
 },
 {
 icon: Activity,
 eyebrow: 'Role-based access',
 title: 'Built for the whole team',
 description:
 'Separate, optimised panels for doctors, lab technicians, and hospital managers. Each role sees exactly what it needs, nothing more.',
 },
];

const STATS = [
 { value: '97%',  label: 'Model accuracy' },
 { value: '< 2s',  label: 'Prediction time' },
 { value: '50+',  label: 'Partner hospitals' },
 { value: '200k+',  label: 'Predictions run' },
];

const PLANS = [
 {
 name: 'Trial',
 price: 'Free',
 period: '14 days',
 description: 'Full platform access with no commitment.',
 features: ['50 AI predictions', 'Up to 3 doctors', 'Lab integration', 'Email support'],
 cta: 'Start free trial',
 featured: false,
 },
 {
 name: 'Clinic',
 price: '$299',
 period: '/month',
 description: 'For small and medium clinics.',
 features: ['500 AI predictions', 'Up to 15 doctors', 'Full lab integration', 'XAI explanations', 'Priority support'],
 cta: 'Get started',
 featured: true,
 },
 {
 name: 'Hospital',
 price: '$799',
 period: '/month',
 description: 'Enterprise-grade for hospital networks.',
 features: ['Unlimited predictions', 'Unlimited staff', 'Full lab integration', 'XAI explanations', 'Dedicated support', 'API access'],
 cta: 'Contact sales',
 featured: false,
 },
];

export default function Landing() {
 return (
 <div className="min-h-screen bg-background font-['IBM_Plex_Sans',Helvetica,Arial,sans-serif]">
 <PublicNavbar />

 {/* ── Hero ── */}
 <section className="border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8">
 <div className="py-20 md:py-28 max-w-3xl">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-4">
 AI-powered clinical decision support
 </p>
 <h1 className="text-[42px] md:text-[60px] font-light leading-[1.17] text-foreground mb-6"
 style={{ letterSpacing: '-0.4px' }}>
 Detect infectious diseases <br className="hidden md:block" />
 earlier. Act faster.
 </h1>
 <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl">
 DiagInfect analyses routine biological markers with AI to deliver
 infection risk scores before culture results arrive — giving clinicians
 a critical head start.
 </p>
 <div className="flex flex-col sm:flex-row gap-0">
 <Button asChild size="lg" className="sm:mr-0">
 <Link to="/register-organization">
 Get started free <ArrowRight className="h-4 w-4" />
 </Link>
 </Button>
 <Button asChild size="lg" variant="ghost" className="sm:ml-0">
 <Link to="/about">Learn how it works</Link>
 </Button>
 </div>
 </div>
 </div>
 </section>

 {/* ── Stats row ── */}
 <section className="bg-muted border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8">
 <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
 {STATS.map(({ value, label }) => (
 <div key={label} className="py-8 px-6 first:pl-0">
 <div className="text-[42px] font-light text-primary leading-none mb-2">
 {value}
 </div>
 <div className="text-sm text-muted-foreground tracking-[0.16px]">
 {label}
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── Feature grid ── */}
 <section className="border-b border-border" id="features">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <div className="mb-12">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">
 Platform capabilities
 </p>
 <h2 className="text-[32px] font-normal text-foreground">
 Everything your clinical team needs
 </h2>
 </div>

 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
 {FEATURES.map(({ icon: Icon, eyebrow, title, description }) => (
 <div
 key={title}
 className="border-r border-b border-border p-6 bg-background hover:bg-muted transition-colors"
 >
 <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-5">
 <Icon className="h-5 w-5 text-primary" />
 </div>
 <p className="text-xs text-muted-foreground tracking-[0.32px] mb-2 uppercase">
 {eyebrow}
 </p>
 <h3 className="text-base font-normal text-foreground mb-3">{title}</h3>
 <p className="text-sm text-muted-foreground leading-relaxed tracking-[0.16px]">
 {description}
 </p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── Pricing ── */}
 <section className="border-b border-border" id="pricing">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <div className="mb-12">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">
 Subscription plans
 </p>
 <h2 className="text-[32px] font-normal text-foreground mb-2">
 Simple, transparent pricing
 </h2>
 <p className="text-muted-foreground">Start free. Scale when you are ready.</p>
 </div>

 <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
 {PLANS.map(({ name, price, period, description, features, cta, featured }) => (
 <div
 key={name}
 className={[
 "border-r border-b border-border p-8 flex flex-col",
 featured ? "bg-[#edf4ff]" : "bg-background",
 ].join(" ")}
 >
 {featured && (
 <span className="text-[11px] text-primary tracking-[0.32px] uppercase mb-4 font-normal">
 Most popular
 </span>
 )}
 <div className="mb-6">
 <div className="text-base font-normal text-foreground mb-1">{name}</div>
 <div className="text-sm text-muted-foreground tracking-[0.16px]">{description}</div>
 </div>
 <div className="mb-6">
 <span className="text-[42px] font-light text-foreground">{price}</span>
 <span className="text-sm text-muted-foreground ml-1">{period}</span>
 </div>
 <ul className="space-y-2 flex-1 mb-8">
 {features.map(f => (
 <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground tracking-[0.16px]">
 <span className="w-4 h-4 shrink-0 mt-0.5 text-primary text-xs flex items-center justify-center">✓</span>
 {f}
 </li>
 ))}
 </ul>
 <Button
 asChild
 variant={featured ? "default" : "outline"}
 className="w-full justify-between"
 >
 <Link to="/register-organization">
 {cta} <ArrowRight className="h-4 w-4" />
 </Link>
 </Button>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── CTA banner — full-width IBM Blue ── */}
 <section className="bg-primary">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <div className="max-w-2xl">
 <p className="text-sm text-primary-foreground/70 tracking-[0.16px] mb-4">
 Ready to get started?
 </p>
 <h2 className="text-[32px] font-normal text-primary-foreground mb-4 leading-snug">
 Transform your infectious disease diagnostic workflow today.
 </h2>
 <p className="text-primary-foreground/80 mb-8 text-lg">
 Join 50+ hospitals already using DiagInfect to improve patient outcomes.
 </p>
 <div className="flex flex-col sm:flex-row gap-0">
 <Button asChild size="lg"
 className="bg-white text-primary hover:bg-[#f4f4f4] active:bg-[#e0e0e0]">
 <Link to="/register-organization">
 Start free trial <ArrowRight className="h-4 w-4" />
 </Link>
 </Button>
 <Button asChild size="lg" variant="ghost"
 className="text-white hover:bg-white/10 border-0">
 <Link to="/about">Learn more</Link>
 </Button>
 </div>
 </div>
 </div>
 </section>

 {/* ── Footer — inverted charcoal ── */}
 <footer className="bg-[#161616] text-[#c6c6c6]">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12 pb-12 border-b border-[#393939]">
 <div className="md:col-span-1">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-8 h-8 bg-[#0f62fe] flex items-center justify-center">
 <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
 <rect x="8.5" y="1" width="3" height="18" fill="white" />
 <rect x="1" y="8.5" width="18" height="3" fill="white" />
 </svg>
 </div>
 <span className="text-white text-base font-normal">DiagInfect</span>
 </div>
 <p className="text-sm text-[#c6c6c6] leading-relaxed tracking-[0.16px]">
 AI-powered infectious disease diagnostic support for hospitals and clinics.
 </p>
 </div>
 <div>
 <p className="text-white text-sm font-normal mb-4 tracking-[0.16px]">Platform</p>
 <ul className="space-y-2">
 {['Features', 'Pricing', 'Security', 'Roadmap'].map(l => (
 <li key={l}><Link to="/" className="text-sm text-[#c6c6c6] hover:text-white transition-colors tracking-[0.16px]">{l}</Link></li>
 ))}
 </ul>
 </div>
 <div>
 <p className="text-white text-sm font-normal mb-4 tracking-[0.16px]">Company</p>
 <ul className="space-y-2">
 {['About', 'Contact', 'Privacy', 'Terms'].map(l => (
 <li key={l}><Link to="/about" className="text-sm text-[#c6c6c6] hover:text-white transition-colors tracking-[0.16px]">{l}</Link></li>
 ))}
 </ul>
 </div>
 <div>
 <p className="text-white text-sm font-normal mb-4 tracking-[0.16px]">Access</p>
 <ul className="space-y-2">
 <li><Link to="/login" className="text-sm text-[#c6c6c6] hover:text-white transition-colors tracking-[0.16px]">Sign in</Link></li>
 <li><Link to="/register-organization" className="text-sm text-[#c6c6c6] hover:text-white transition-colors tracking-[0.16px]">Register organization</Link></li>
 </ul>
 </div>
 </div>
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <p className="text-xs text-[#8d8d8d] tracking-[0.32px]">
 © {new Date().getFullYear()} DiagInfect — Ibn Khaldoun University of Tiaret. All rights reserved.
 </p>
 <p className="text-xs text-[#8d8d8d] tracking-[0.32px]">Built with Carbon Design System principles</p>
 </div>
 </div>
 </footer>
 </div>
 );
}
