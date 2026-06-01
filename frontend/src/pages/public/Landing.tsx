import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Brain, FlaskConical, Shield, CheckCircle2,
  Zap, Building2, ChevronRight, ArrowRight,
} from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Diagnosis',
    description: 'Machine learning models trained on thousands of infectious disease cases provide real-time risk assessments with explainable AI insights.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50 dark:bg-indigo-950/20',
  },
  {
    icon: FlaskConical,
    title: 'Lab Integration',
    description: 'Seamless bidirectional workflow between doctors and lab technicians. Orders, results, and alerts all in one platform.',
    color: 'text-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-950/20',
  },
  {
    icon: Shield,
    title: 'Role-Based Security',
    description: 'Doctors, lab techs, and managers each see exactly what they need. HIPAA-compliant access controls protect patient data.',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
  },
  {
    icon: Activity,
    title: 'Real-Time Alerts',
    description: 'Critical lab results and high-risk predictions trigger instant notifications to the right clinicians without delay.',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
  },
];

const PLANS = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'Evaluate the full platform with no commitment.',
    icon: Zap,
    color: 'text-yellow-500',
    features: ['50 AI predictions', 'Up to 3 doctors', 'Lab integration', 'Basic support'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Clinic',
    price: '$299',
    period: '/month',
    description: 'Perfect for small to medium clinics.',
    icon: Shield,
    color: 'text-blue-500',
    popular: true,
    features: ['500 AI predictions', 'Up to 15 doctors', 'Full lab integration', 'XAI explanations', 'Priority support'],
    cta: 'Get Started',
  },
  {
    name: 'Hospital',
    price: '$799',
    period: '/month',
    description: 'Enterprise-grade for large hospital networks.',
    icon: Building2,
    color: 'text-violet-500',
    features: ['Unlimited predictions', 'Unlimited staff', 'Full lab integration', 'XAI explanations', 'Dedicated support', 'API access'],
    cta: 'Contact Sales',
  },
];

const STATS = [
  { value: '97%', label: 'Diagnostic Accuracy' },
  { value: '< 2s', label: 'Prediction Response Time' },
  { value: '50+', label: 'Supported Hospitals' },
  { value: '200k+', label: 'Predictions Run' },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-indigo-50/30 dark:to-indigo-950/10 pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-4 text-xs px-3 py-1" variant="secondary">
              AI-Powered Clinical Decision Support
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
              Diagnose Infectious Diseases{' '}
              <span className="text-primary">Faster & Smarter</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              DiagInfect combines AI prediction, real-time lab integration, and
              explainable clinical insights to support your doctors where it matters most.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild className="gap-2">
                <Link to="/register">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-bold text-primary">{value}</div>
                <div className="text-sm text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Everything your clinical team needs</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A unified platform connecting doctors, lab technicians, and administrators
              with the power of AI at every step.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, description, color, bg }) => (
              <Card key={title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6 flex gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20" id="pricing">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free. Scale when you're ready.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map(({ name, price, period, description, icon: Icon, color, popular, features, cta }) => (
              <Card
                key={name}
                className={`relative ${popular ? 'border-primary ring-1 ring-primary/40 shadow-lg scale-[1.02]' : ''}`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="text-xs shadow-sm">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="pt-8 pb-6 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${popular ? 'bg-primary' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${popular ? 'text-primary-foreground' : color}`} />
                    </div>
                    <div>
                      <div className="font-bold text-base">{name}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                  </div>
                  <div className="mb-5">
                    <span className="text-4xl font-extrabold">{price}</span>
                    <span className="text-muted-foreground text-sm ml-1">{period}</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-6">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={popular ? 'default' : 'outline'}
                    className="w-full gap-2"
                  >
                    <Link to="/register">
                      {cta} <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your clinical workflow?</h2>
          <p className="text-primary-foreground/80 mb-8">
            Join 50+ hospitals already using DiagInfect to improve patient outcomes.
          </p>
          <Button size="lg" variant="secondary" asChild className="gap-2">
            <Link to="/register">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">DiagInfect</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} DiagInfect. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/login"  className="hover:text-foreground transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
