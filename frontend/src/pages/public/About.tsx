import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Users, Lightbulb, Activity } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

// ─── Data ─────────────────────────────────────────────────────────────────────

const VALUES = [
  {
    icon: Target,
    title: 'Accuracy first',
    desc: 'Every model is rigorously validated before deployment. Clinical safety is non-negotiable.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Users,
    title: 'Clinician-centered',
    desc: "Built with and for clinicians — our workflows mirror how hospitals actually operate.",
    color: 'text-[#00a89c]',
    bg: 'bg-[#00a89c]/10',
  },
  {
    icon: Lightbulb,
    title: 'Explainable AI',
    desc: "We don't just give predictions — we explain them, building trust between AI and clinicians.",
    color: 'text-[#2e368f]',
    bg: 'bg-[#2e368f]/10',
  },
  {
    icon: Activity,
    title: 'Continuous learning',
    desc: 'Our models improve over time with anonymised feedback from real clinical outcomes.',
    color: 'text-[#88c540]',
    bg: 'bg-[#88c540]/10',
  },
];

const HOW_IT_WORKS = [
  { step: '01', label: 'Input',   desc: 'CRP, CBC, ESR, NFS, temperature, clinical indicators', color: 'bg-primary/10 text-primary' },
  { step: '02', label: 'Analyse', desc: 'Random Forest, XGBoost, and Neural Network ensemble',  color: 'bg-[#2e368f]/10 text-[#2e368f]' },
  { step: '03', label: 'Output',  desc: 'Infection risk score + ranked factor explanations',      color: 'bg-[#00a89c]/10 text-[#00a89c]' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* ── Page header ── */}
      <section className="relative bg-[#0d1829] overflow-hidden pt-32 pb-20 border-b border-white/10">
        {/* Background orb */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-8">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
            About DiagInfect
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold text-white leading-tight tracking-tight mb-6 max-w-2xl">
            AI diagnostics built for the realities of clinical work.
          </h1>
          <p className="text-lg text-white/60 max-w-xl leading-relaxed">
            We believe AI, built responsibly, can help clinicians detect infectious diseases
            earlier — reducing delays, antibiotic misuse, and preventable outcomes.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* ── Mission + How it works ── */}
      <section className="py-24 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid md:grid-cols-2 gap-16">

            {/* Mission */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                Our mission
              </p>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-6">
                Close the diagnostic gap.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Infectious disease diagnosis is time-critical. Every hour of delay carries real
                clinical consequences — delayed treatment, inappropriate antibiotics, worse outcomes.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                DiagInfect gives clinicians a powerful second opinion: one that synthesises
                symptoms, lab data, and patient history in seconds, with full transparency
                about how the conclusion was reached.
              </p>
            </div>

            {/* How it works */}
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                Technology
              </p>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-8">
                How it works.
              </h2>
              <div className="space-y-5">
                {HOW_IT_WORKS.map(({ step, label, desc, color }) => (
                  <div key={step} className="flex gap-4 items-start pb-5 border-b border-border last:border-0 last:pb-0">
                    <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center text-xs font-bold shrink-0`}>
                      {step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-24 border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Principles
            </p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              What we stand for.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-[var(--radius)] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200"
              >
                <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-5`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none translate-x-1/2 -translate-y-1/2" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <h2 className="text-3xl font-semibold text-primary-foreground mb-3 tracking-tight">
              Ready to see it in action?
            </h2>
            <p className="text-primary-foreground/70 text-base leading-relaxed">
              Start a 14-day free trial with full platform access.
            </p>
          </div>
          <Button
            asChild size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-lg gap-2 shrink-0"
          >
            <Link to="/register-organization">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0d1829]">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm shadow-primary/40">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="8.5" y="1" width="3" height="18" fill="white" />
                <rect x="1" y="8.5" width="18" height="3" fill="white" />
              </svg>
            </div>
            <span className="text-white text-sm font-semibold tracking-tight">DiagInfect</span>
          </div>
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} DiagInfect. All rights reserved.
          </p>
          <div className="flex gap-5">
            <Link to="/"      className="text-sm text-white/50 hover:text-white transition-colors">Home</Link>
            <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
