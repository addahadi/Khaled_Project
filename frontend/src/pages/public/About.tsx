import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Target, Users, Lightbulb, ArrowRight } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

const TEAM_ROLES = [
  { title: 'AI / ML Engineering',     desc: 'Designing models trained on real-world infectious disease datasets for high-accuracy risk prediction.' },
  { title: 'Clinical Informatics',    desc: 'Ensuring medical accuracy, regulatory alignment, and clinical usability across all platform features.' },
  { title: 'Full-Stack Engineering',  desc: 'Building a secure, scalable platform with React, TypeScript, and Express on a Supabase backbone.' },
  { title: 'UX & Product Design',     desc: 'Crafting intuitive interfaces for time-pressured clinicians working in high-stakes environments.' },
];

const VALUES = [
  { icon: Target,    title: 'Accuracy First',      desc: 'Every model is rigorously validated before deployment. Clinical safety is non-negotiable.' },
  { icon: Users,     title: 'Clinician-Centered',  desc: 'Built with and for clinicians — our workflows mirror how hospitals actually operate.' },
  { icon: Lightbulb, title: 'Explainable AI',      desc: 'We don\'t just give predictions — we explain them, building trust between AI and clinicians.' },
  { icon: Activity,  title: 'Continuous Learning', desc: 'Our models improve over time with anonymised feedback from real clinical outcomes.' },
];

export default function About() {
  return (
    <div className="min-h-screen">
      <PublicNavbar />

      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Activity className="h-9 w-9 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
            About DiagInfect
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We believe that artificial intelligence, when built responsibly and deployed
            thoughtfully, can help clinicians detect infectious diseases earlier — and save lives.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Infectious disease diagnosis is time-critical. Every hour of delay in
                identifying a pathogen carries real clinical consequences. DiagInfect
                was built to give clinicians a powerful second opinion — one that
                synthesises symptoms, lab data, and patient history in seconds.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We are a team of engineers and clinical informaticists who believe AI
                should augment clinical judgment, not replace it. Transparency,
                explainability, and trust are the foundations of everything we build.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { val: '97%',   label: 'Model Accuracy' },
                { val: '50+',   label: 'Partner Hospitals' },
                { val: '200k+', label: 'Predictions Run' },
                { val: '< 2s',  label: 'Avg. Response Time' },
              ].map(({ val, label }) => (
                <Card key={label} className="text-center">
                  <CardContent className="pt-6 pb-4">
                    <div className="text-3xl font-extrabold text-primary">{val}</div>
                    <div className="text-sm text-muted-foreground mt-1">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-10">What We Stand For</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-10">How We're Built</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {TEAM_ROLES.map(({ title, desc }) => (
              <Card key={title} className="border hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to see it in action?</h2>
          <p className="text-primary-foreground/80 mb-6">
            Start a 14-day free trial and experience AI-powered diagnostics in your hospital.
          </p>
          <Button size="lg" variant="secondary" asChild className="gap-2">
            <Link to="/register-organization">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">DiagInfect</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} DiagInfect. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/"      className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
