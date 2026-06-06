import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Users, Lightbulb, Activity } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

const VALUES = [
 { icon: Target,  title: 'Accuracy first',  desc: 'Every model is rigorously validated before deployment. Clinical safety is non-negotiable.' },
 { icon: Users,  title: 'Clinician-centered',  desc: 'Built with and for clinicians — our workflows mirror how hospitals actually operate.' },
 { icon: Lightbulb, title: 'Explainable AI',  desc: 'We don\'t just give predictions — we explain them, building trust between AI and clinicians.' },
 { icon: Activity,  title: 'Continuous learning', desc: 'Our models improve over time with anonymised feedback from real clinical outcomes.' },
];

const TEAM_ROLES = [
 { title: 'AI / ML engineering',  desc: 'Designing models trained on real-world infectious disease datasets for high-accuracy risk prediction.' },
 { title: 'Clinical informatics',  desc: 'Ensuring medical accuracy, regulatory alignment, and clinical usability across all platform features.' },
 { title: 'Full-stack engineering', desc: 'Building a secure, scalable platform with React, TypeScript, and Express.' },
 { title: 'UX & product design',  desc: 'Crafting intuitive interfaces for time-pressured clinicians working in high-stakes environments.' },
];

const STATS = [
 { val: '97%',  label: 'Model accuracy' },
 { val: '50+',  label: 'Partner hospitals' },
 { val: '200k+', label: 'Predictions run' },
 { val: '< 2s',  label: 'Avg. response time' },
];

export default function About() {
 return (
 <div className="min-h-screen bg-background">
 <PublicNavbar />

 {/* ── Page header ── */}
 <section className="border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">About DiagInfect</p>
 <h1 className="text-[42px] font-light text-foreground mb-6" style={{ letterSpacing: '-0.3px' }}>
 AI diagnostics built for <br className="hidden md:block" />
 the realities of clinical work.
 </h1>
 <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
 We believe AI, built responsibly, can help clinicians detect infectious diseases
 earlier — reducing delays, antibiotic misuse, and preventable outcomes.
 </p>
 </div>
 </section>

 {/* ── Stats ── */}
 <section className="bg-muted border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8">
 <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
 {STATS.map(({ val, label }) => (
 <div key={label} className="py-8 px-6 first:pl-0">
 <div className="text-[42px] font-light text-primary leading-none mb-2">{val}</div>
 <div className="text-sm text-muted-foreground tracking-[0.16px]">{label}</div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── Mission ── */}
 <section className="border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <div className="grid md:grid-cols-2 gap-16">
 <div>
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">Our mission</p>
 <h2 className="text-[32px] font-normal text-foreground mb-6">
 Close the diagnostic gap.
 </h2>
 <p className="text-muted-foreground leading-relaxed mb-4 tracking-[0.16px]">
 Infectious disease diagnosis is time-critical. Every hour of delay carries real
 clinical consequences — delayed treatment, inappropriate antibiotics, worse outcomes.
 </p>
 <p className="text-muted-foreground leading-relaxed tracking-[0.16px]">
 DiagInfect gives clinicians a powerful second opinion: one that synthesises
 symptoms, lab data, and patient history in seconds, with full transparency
 about how the conclusion was reached.
 </p>
 </div>
 <div className="border-l border-border pl-16">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">Technology</p>
 <h2 className="text-[32px] font-normal text-foreground mb-6">How it works.</h2>
 <div className="space-y-4">
 {[
 { step: '01', label: 'Input', desc: 'CRP, CBC, ESR, NFS, temperature, clinical indicators' },
 { step: '02', label: 'Analyse', desc: 'Random Forest, XGBoost, and Neural Network ensemble' },
 { step: '03', label: 'Output', desc: 'Infection risk score + ranked factor explanations' },
 ].map(({ step, label, desc }) => (
 <div key={step} className="flex gap-6 border-b border-border/60 pb-4 last:border-0">
 <span className="text-sm text-primary font-normal w-6 shrink-0 tracking-[0.16px]">{step}</span>
 <div>
 <div className="text-sm font-normal text-foreground mb-1 tracking-[0.16px]">{label}</div>
 <div className="text-sm text-muted-foreground tracking-[0.16px]">{desc}</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* ── Values ── */}
 <section className="bg-muted border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">Principles</p>
 <h2 className="text-[32px] font-normal text-foreground mb-10">What we stand for.</h2>
 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
 {VALUES.map(({ icon: Icon, title, desc }) => (
 <div key={title} className="border border-border bg-card rounded-xl p-6 shadow-sm">
 <div className="w-10 h-10 bg-primary/10 flex items-center justify-center mb-5">
 <Icon className="h-5 w-5 text-primary" />
 </div>
 <h3 className="text-base font-normal text-foreground mb-3">{title}</h3>
 <p className="text-sm text-muted-foreground leading-relaxed tracking-[0.16px]">{desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── Team ── */}
 <section className="border-b border-border">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16">
 <p className="text-sm text-muted-foreground tracking-[0.16px] mb-3">The team</p>
 <h2 className="text-[32px] font-normal text-foreground mb-10">How we are built.</h2>
 <div className="grid sm:grid-cols-2 gap-5">
 {TEAM_ROLES.map(({ title, desc }) => (
 <div key={title} className="border border-border bg-card rounded-xl p-6 shadow-sm">
 <h3 className="text-base font-normal text-foreground mb-3">{title}</h3>
 <p className="text-sm text-muted-foreground leading-relaxed tracking-[0.16px]">{desc}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ── CTA banner ── */}
 <section className="bg-primary">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
 <div>
 <h2 className="text-[32px] font-normal text-primary-foreground mb-3">
 Ready to see it in action?
 </h2>
 <p className="text-primary-foreground/80 text-lg">
 Start a 14-day free trial with full platform access.
 </p>
 </div>
 <Button asChild size="lg"
 className="bg-white text-primary hover:bg-[#f4f4f4] shrink-0">
 <Link to="/register-organization">
 Get started free <ArrowRight className="h-4 w-4" />
 </Link>
 </Button>
 </div>
 </section>

 {/* ── Footer ── */}
 <footer className="bg-[#161616]">
 <div className="mx-auto max-w-[1584px] px-4 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="w-7 h-7 bg-[#0f62fe] flex items-center justify-center">
 <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
 <rect x="8.5" y="1" width="3" height="18" fill="white" />
 <rect x="1" y="8.5" width="18" height="3" fill="white" />
 </svg>
 </div>
 <span className="text-white text-sm font-normal">DiagInfect</span>
 </div>
 <p className="text-xs text-[#8d8d8d] tracking-[0.32px]">
 © {new Date().getFullYear()} DiagInfect. All rights reserved.
 </p>
 <div className="flex gap-6">
 <Link to="/" className="text-sm text-[#c6c6c6] hover:text-white transition-colors tracking-[0.16px]">Home</Link>
 <Link to="/login" className="text-sm text-[#c6c6c6] hover:text-white transition-colors tracking-[0.16px]">Sign in</Link>
 </div>
 </div>
 </footer>
 </div>
 );
}
