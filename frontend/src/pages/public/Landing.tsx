import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Brain, FlaskConical, Shield, Activity,
  Check, AlertTriangle, TrendingUp, CheckCircle2,
} from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    eyebrow: 'AI prediction',
    title: 'Early risk assessment',
    description:
      'Machine learning models (Random Forest, XGBoost, Neural Networks) trained on real infectious disease datasets deliver risk scores in under 2 seconds — before culture results are available.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: FlaskConical,
    eyebrow: 'Lab integration',
    title: 'Seamless lab workflow',
    description:
      'Bidirectional data flow between doctors and lab technicians. CRP, CBC, ESR, and NFS results link directly to patient records with anomaly alerts built in.',
    color: 'text-[#00a89c]',
    bg: 'bg-[#00a89c]/10',
  },
  {
    icon: Shield,
    eyebrow: 'Explainable AI',
    title: 'Decisions you can trust',
    description:
      'Every prediction comes with a ranked explanation of the contributing factors. Clinical trust requires transparency — not a black box.',
    color: 'text-[#2e368f]',
    bg: 'bg-[#2e368f]/10',
  },
  {
    icon: Activity,
    eyebrow: 'Role-based access',
    title: 'Built for the whole team',
    description:
      'Separate, optimised panels for doctors, lab technicians, and hospital managers. Each role sees exactly what it needs, nothing more.',
    color: 'text-[#88c540]',
    bg: 'bg-[#88c540]/10',
  },
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
    accentBg: 'bg-card',
    accentBorder: 'border-border',
  },
  {
    name: 'Clinic',
    price: '$299',
    period: '/month',
    description: 'For small and medium clinics.',
    features: ['500 AI predictions', 'Up to 15 doctors', 'Full lab integration', 'XAI explanations', 'Priority support'],
    cta: 'Get started',
    featured: true,
    accentBg: 'bg-primary/5',
    accentBorder: 'border-primary',
  },
  {
    name: 'Hospital',
    price: '$799',
    period: '/month',
    description: 'Enterprise-grade for hospital networks.',
    features: ['Unlimited predictions', 'Unlimited staff', 'Full lab integration', 'XAI explanations', 'Dedicated support', 'API access'],
    cta: 'Contact sales',
    featured: false,
    accentBg: 'bg-card',
    accentBorder: 'border-border',
  },
];

// ─── Hero mockup card ─────────────────────────────────────────────────────────

function PredictionMockup() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow behind card */}
      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-3xl scale-90 translate-y-4" />

      {/* Main card */}
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#c0272d]/10 flex items-center justify-center">
              <AlertTriangle className="h-3.5 w-3.5 text-[#c0272d]" />
            </div>
            <span className="text-sm font-semibold text-foreground">Prediction Result</span>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20">CRITICAL</span>
        </div>

        {/* Patient row */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">MB</div>
          <div>
            <p className="text-sm font-medium text-foreground">Moussa Benali</p>
            <p className="text-xs text-muted-foreground">62 yrs · Male</p>
          </div>
        </div>

        {/* Risk score */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Risk Score</span>
            <span className="text-sm font-semibold text-[#c0272d]">91%</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-[#c0272d] transition-all" style={{ width: '91%' }} />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Confidence: 88%</span>
            <span>Model v2.3.1</span>
          </div>
        </div>

        {/* XAI factors */}
        <div className="px-5 pb-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top factors</p>
          {[
            { label: 'CRP Level',      dir: '↑', pct: 88, color: 'bg-[#c0272d]/60' },
            { label: 'WBC Count',      dir: '↑', pct: 74, color: 'bg-[#c0272d]/40' },
            { label: 'Body Temp',      dir: '↑', pct: 61, color: 'bg-[#e07020]/50' },
            { label: 'Neutrophil %',   dir: '↑', pct: 48, color: 'bg-[#faaf3a]/60' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2">
              <span className={`text-[9px] font-bold w-4 text-center ${f.dir === '↑' ? 'text-[#c0272d]' : 'text-[#00a89c]'}`}>{f.dir}</span>
              <span className="text-xs text-foreground flex-1 truncate">{f.label}</span>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${f.color}`} style={{ width: `${f.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-muted/40 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">DiagInfect · AI diagnosis support</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00a89c] animate-pulse" />
            <span className="text-[10px] text-[#007a71] font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* Floating mini card — alert */}
      <div className="absolute -bottom-4 -left-6 bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 flex items-center gap-2.5 z-10">
        <div className="w-6 h-6 rounded-lg bg-[#00a89c]/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#00a89c]" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-foreground">Lab results linked</p>
          <p className="text-[9px] text-muted-foreground">CBC · CRP · ESR — ready</p>
        </div>
      </div>

      {/* Floating mini card — confidence */}
      <div className="absolute -top-4 -right-4 bg-card border border-border rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 z-10">
        <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
        <div>
          <p className="text-[10px] font-semibold text-foreground">Model v2.3.1</p>
          <p className="text-[9px] text-muted-foreground">88% confidence</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* ── Hero ── */}
      <section className="relative bg-[#0d1829] overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#2e368f]/20 rounded-full blur-[80px] pointer-events-none" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 pt-32 pb-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-medium mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                AI-powered clinical decision support
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[52px] font-semibold text-white leading-[1.12] tracking-tight mb-6">
                Detect infectious<br />diseases earlier.<br />
                <span className="text-primary">Act faster.</span>
              </h1>
              <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-lg">
                DiagInfect analyses routine biological markers with AI to deliver
                infection risk scores before culture results arrive — giving clinicians
                a critical head start.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/30">
                  <Link to="/register-organization">
                    Get started free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild size="lg" variant="outline"
                  className="border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white hover:border-white/30"
                >
                  <Link to="/about">Learn how it works</Link>
                </Button>
              </div>
            </div>

            {/* Right — mockup */}
            <div className="hidden lg:flex items-center justify-center py-8 pr-4">
              <PredictionMockup />
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── Features ── */}
      <section className="py-24 border-b border-border" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Platform capabilities
            </p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-4">
              Everything your clinical team needs
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Built around the real workflows of doctors, lab technicians, and hospital managers —
              not the other way around.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, eyebrow, title, description, color, bg }) => (
              <div
                key={title}
                className="group bg-card border border-border rounded-[var(--radius)] p-6 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-5`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  {eyebrow}
                </p>
                <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 border-b border-border bg-muted/30" id="pricing">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Subscription plans
            </p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-3">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground">Start free. Scale when you are ready.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
            {PLANS.map(({ name, price, period, description, features, cta, featured, accentBg, accentBorder }) => (
              <div
                key={name}
                className={`relative rounded-[var(--radius)] border-2 ${accentBorder} ${accentBg} p-8 flex flex-col shadow-sm ${
                  featured ? 'shadow-primary/10 shadow-lg' : ''
                }`}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-3 py-1 rounded-full shadow-sm">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-base font-semibold text-foreground mb-1">{name}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-semibold text-foreground tracking-tight">{price}</span>
                  <span className="text-sm text-muted-foreground">{period}</span>
                </div>

                <ul className="space-y-2.5 flex-1 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-[#00a89c] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={featured ? 'default' : 'outline'}
                  className="w-full gap-2"
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

      {/* ── CTA banner ── */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-20">
          <div className="max-w-2xl">
            <p className="text-sm text-primary-foreground/60 font-medium uppercase tracking-widest mb-4">
              Ready to get started?
            </p>
            <h2 className="text-3xl font-semibold text-primary-foreground mb-4 leading-tight tracking-tight">
              Transform your infectious disease<br />diagnostic workflow today.
            </h2>
            <p className="text-primary-foreground/70 mb-8 text-base leading-relaxed">
              Join hospitals already using DiagInfect to improve patient outcomes
              with AI-powered infection risk assessment.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-lg gap-2"
              >
                <Link to="/register-organization">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild size="lg" variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
              >
                <Link to="/about">Learn more</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0d1829] text-white/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12 pb-12 border-b border-white/10">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm shadow-primary/40">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <rect x="8.5" y="1" width="3" height="18" fill="white" />
                    <rect x="1" y="8.5" width="18" height="3" fill="white" />
                  </svg>
                </div>
                <span className="text-white text-base font-semibold tracking-tight">DiagInfect</span>
              </div>
              <p className="text-sm leading-relaxed">
                AI-powered infectious disease diagnostic support for hospitals and clinics.
              </p>
            </div>

            {/* Platform links */}
            <div>
              <p className="text-white text-sm font-semibold mb-4">Platform</p>
              <ul className="space-y-2.5">
                {['Features', 'Pricing', 'Security', 'Roadmap'].map(l => (
                  <li key={l}>
                    <Link to="/" className="text-sm text-white/50 hover:text-white transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <p className="text-white text-sm font-semibold mb-4">Company</p>
              <ul className="space-y-2.5">
                {[
                  { label: 'About',   to: '/about' },
                  { label: 'Contact', to: '/about' },
                  { label: 'Privacy', to: '/'      },
                  { label: 'Terms',   to: '/'      },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-white/50 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Access links */}
            <div>
              <p className="text-white text-sm font-semibold mb-4">Access</p>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">Sign in</Link>
                </li>
                <li>
                  <Link to="/register-organization" className="text-sm text-white/50 hover:text-white transition-colors">Register organization</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} DiagInfect — Ibn Khaldoun University of Tiaret. All rights reserved.
            </p>
            <p className="text-xs text-white/30">Built with React · TypeScript · shadcn/ui</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
