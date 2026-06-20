import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Brain, FlaskConical, Shield, Activity,
  Check, AlertTriangle, TrendingUp, CheckCircle2, Eye,
} from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { formatDZD } from '@/lib/formatPrice';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
// ─── Data ─────────────────────────────────────────────────────────────────────

function PredictionMockup() {
  const { t } = useTranslation('landing');
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
            <span className="text-sm font-semibold text-foreground">{t('mockup.predictionResult')}</span>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20">{t('mockup.critical')}</span>
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
            <span className="text-xs text-muted-foreground">{t('mockup.riskScore')}</span>
            <span className="text-sm font-semibold text-[#c0272d]">91%</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-[#c0272d] transition-all" style={{ width: '91%' }} />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('mockup.confidence')}: 88%</span>
            <span>{t('mockup.modelVersion')}</span>
          </div>
        </div>

        {/* XAI factors */}
        <div className="px-5 pb-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('mockup.topFactors')}</p>
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
          <span className="text-[10px] text-muted-foreground">{t('mockup.aiSupport')}</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00a89c] animate-pulse" />
            <span className="text-[10px] text-[#007a71] font-medium">{t('mockup.live')}</span>
          </div>
        </div>
      </div>

      {/* Floating mini card — alert */}
      <div className="absolute -bottom-4 -left-6 bg-card border border-border rounded-xl shadow-lg px-3 py-2.5 flex items-center gap-2.5 z-10">
        <div className="w-6 h-6 rounded-lg bg-[#00a89c]/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#00a89c]" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-foreground">{t('mockup.labLinked')}</p>
          <p className="text-[9px] text-muted-foreground">{t('mockup.labReady')}</p>
        </div>
      </div>

      {/* Floating mini card — confidence */}
      <div className="absolute -top-4 -right-4 bg-card border border-border rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 z-10">
        <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
        <div>
          <p className="text-[10px] font-semibold text-foreground">{t('mockup.modelVersion')}</p>
          <p className="text-[9px] text-muted-foreground">88% {t('mockup.confidence').toLowerCase()}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { t, i18n } = useTranslation('landing');
  const { t: c } = useTranslation('common');
  const lang = i18n.language;

  const FEATURES = [
    {
      icon: Brain,
      eyebrow: t('features.items.ai.eyebrow'),
      title: t('features.items.ai.title'),
      description: t('features.items.ai.description'),
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: FlaskConical,
      eyebrow: t('features.items.lab.eyebrow'),
      title: t('features.items.lab.title'),
      description: t('features.items.lab.description'),
      color: 'text-[#00a89c]',
      bg: 'bg-[#00a89c]/10',
    },
    {
      icon: Shield,
      eyebrow: t('features.items.xai.eyebrow'),
      title: t('features.items.xai.title'),
      description: t('features.items.xai.description'),
      color: 'text-[#2e368f]',
      bg: 'bg-[#2e368f]/10',
    },
    {
      icon: Activity,
      eyebrow: t('features.items.rbac.eyebrow'),
      title: t('features.items.rbac.title'),
      description: t('features.items.rbac.description'),
      color: 'text-[#88c540]',
      bg: 'bg-[#88c540]/10',
    },
  ];

  const PLANS = [
    {
      name: t('pricing.plans.trial.name'),
      price: c('pricing.free', 'Free'),
      period: t('pricing.plans.trial.period'),
      description: t('pricing.plans.trial.description'),
      features: [t('pricing.features.predictions50'), t('pricing.features.users5'), t('pricing.features.xai'), t('pricing.features.emailSupport')],
      cta: t('pricing.plans.trial.cta'),
      featured: false,
      accentBg: 'bg-card',
      accentBorder: 'border-border',
    },
    {
      name: t('pricing.plans.clinic.name'),
      price: formatDZD(50000, lang),
      period: t('pricing.plans.clinic.period'),
      description: t('pricing.plans.clinic.description'),
      features: [t('pricing.features.predictions500'), t('pricing.features.users20'), t('pricing.features.fullLab'), t('pricing.features.xai'), t('pricing.features.prioritySupport')],
      cta: t('pricing.plans.clinic.cta'),
      featured: true,
      accentBg: 'bg-primary/5',
      accentBorder: 'border-primary',
    },
    {
      name: t('pricing.plans.hospital.name'),
      price: formatDZD(8000000, lang),
      period: t('pricing.plans.hospital.period'),
      description: t('pricing.plans.hospital.description'),
      features: [t('pricing.features.unlimitedPredictions'), t('pricing.features.unlimitedStaff'), t('pricing.features.fullLab'), t('pricing.features.xai'), t('pricing.features.dedicatedSupport'), t('pricing.features.apiAccess')],
      cta: t('pricing.plans.hospital.cta'),
      featured: false,
      accentBg: 'bg-card',
      accentBorder: 'border-border',
    },
  ];
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* ── Hero ── */}
      <section className="relative bg-[#0d1829] overflow-hidden">
        {/* Colour orbs for atmospheric depth */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#2e368f]/15 rounded-full blur-[100px] pointer-events-none z-0" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 pt-32 pb-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-medium mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {t('hero.tagline')}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[52px] font-semibold text-white leading-[1.12] tracking-tight mb-6 whitespace-pre-line">
                {t('hero.title')}<br />
                <span className="text-primary">{t('hero.titleHighlight')}</span>
              </h1>
              <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-lg">
                {t('hero.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/30">
                  <Link to="/register-organization">
                    {c('nav.getStartedFree')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild size="lg" variant="outline"
                  className="border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white hover:border-white/30"
                >
                  <Link to="/about">{t('hero.learnHow')}</Link>
                </Button>
              </div>
            </motion.div>

            {/* Right — mockup */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="hidden lg:flex items-center justify-center py-8 pr-4"
            >
              <PredictionMockup />
            </motion.div>
          </div>
        </div>

      </section>

      {/* ── Features ── */}
      <section className="py-24 border-b border-border" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mb-14 max-w-2xl"
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              {t('features.eyebrow')}
            </p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-4">
              {t('features.title')}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {t('features.description')}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, eyebrow, title, description, color, bg }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision 2032 ── */}
      <section className="relative py-24 overflow-hidden" id="vision">
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1829] via-[#141e30] to-[#1a1a2e]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#2e368f]/40 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#2e368f]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-center"
          >
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">{t('vision.eyebrow')}</span>
            </div>

            {/* Year highlight */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mb-6"
            >
              <span className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight bg-gradient-to-r from-primary via-[#5db1e3] to-[#2bd4c0] bg-clip-text text-transparent">
                {t('vision.year')}
              </span>
            </motion.div>

            {/* Decorative line */}
            <div className="flex items-center justify-center gap-3 mb-10">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/50" />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/50" />
            </div>

            {/* Vision statement */}
            <motion.blockquote
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="relative max-w-3xl mx-auto"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-6xl text-primary/15 font-serif pointer-events-none select-none">&ldquo;</div>
              <p className="text-lg md:text-xl lg:text-2xl text-white/80 leading-relaxed font-light italic">
                {t('vision.statement')}
              </p>
            </motion.blockquote>

            {/* Bottom accent dots */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex items-center justify-center gap-2 mt-10"
            >
              <div className="w-1 h-1 rounded-full bg-primary/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <div className="w-1 h-1 rounded-full bg-primary/40" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 border-b border-border bg-muted/30" id="pricing">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mb-14 max-w-2xl"
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              {t('pricing.eyebrow')}
            </p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-3">
              {t('pricing.title')}
            </h2>
            <p className="text-muted-foreground">{t('pricing.description')}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl">
            {PLANS.map(({ name, price, period, description, features, cta, featured, accentBg, accentBorder }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative rounded-[var(--radius)] border-2 ${accentBorder} ${accentBg} p-8 flex flex-col shadow-sm ${
                  featured ? 'shadow-primary/10 shadow-lg' : ''
                }`}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-3 py-1 rounded-full shadow-sm">
                      {t('pricing.mostPopular')}
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <p className="text-sm text-primary-foreground/60 font-medium uppercase tracking-widest mb-4">
              {t('cta.eyebrow')}
            </p>
            <h2 className="text-3xl font-semibold text-primary-foreground mb-4 leading-tight tracking-tight whitespace-pre-line">
              {t('cta.title')}
            </h2>
            <p className="text-primary-foreground/70 mb-8 text-base leading-relaxed">
              {t('cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-lg gap-2"
              >
                <Link to="/register-organization">
                  {t('cta.startTrial')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild size="lg" variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
              >
                <Link to="/about">{c('actions.learnMore')}</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0d1829] text-white/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12 pb-12 border-b border-white/10">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <BrandLogo size="sm" />
                <span className="text-white text-base font-semibold tracking-tight">{c('brand')}</span>
              </div>
              <p className="text-sm leading-relaxed">
                {c('footer.brandDescription')}
              </p>
            </div>

            {/* Platform links */}
            <div>
              <p className="text-white text-sm font-semibold mb-4">{c('footer.platform')}</p>
              <ul className="space-y-2.5">
                {[c('footer.home'), c('footer.pricing'), c('footer.security'), c('footer.roadmap')].map(l => (
                  <li key={l}>
                    <Link to="/" className="text-sm text-white/50 hover:text-white transition-colors">{l}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <p className="text-white text-sm font-semibold mb-4">{c('footer.company')}</p>
              <ul className="space-y-2.5">
                {[
                  { label: c('footer.about'),   to: '/about' },
                  { label: c('footer.contact'), to: '/about' },
                  { label: c('footer.privacy'), to: '/'      },
                  { label: c('footer.terms'),   to: '/'      },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm text-white/50 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Access links */}
            <div>
              <p className="text-white text-sm font-semibold mb-4">{c('footer.access')}</p>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">{c('nav.signIn')}</Link>
                </li>
                <li>
                  <Link to="/register-organization" className="text-sm text-white/50 hover:text-white transition-colors">{c('footer.registerOrganization')}</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-white/30">
              {c('misc.copyright', { year: new Date().getFullYear() })}
            </p>
            <p className="text-xs text-white/30">{c('misc.builtWith')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
