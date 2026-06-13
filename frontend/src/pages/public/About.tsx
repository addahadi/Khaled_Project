import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Users, Lightbulb, Activity } from 'lucide-react';
import PublicNavbar from '../../components/public/PublicNavbar';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// ─── Icon / style maps (visual-only, not translated) ──────────────────────────

const VALUE_ICONS = {
  accuracy: { icon: Target,    color: 'text-primary',     bg: 'bg-primary/10'     },
  clinician: { icon: Users,    color: 'text-[#00a89c]',   bg: 'bg-[#00a89c]/10'  },
  xai:       { icon: Lightbulb,color: 'text-[#2e368f]',   bg: 'bg-[#2e368f]/10'  },
  learning:  { icon: Activity, color: 'text-[#88c540]',   bg: 'bg-[#88c540]/10'  },
} as const;

const STEP_COLORS = [
  'bg-primary/10 text-primary',
  'bg-[#2e368f]/10 text-[#2e368f]',
  'bg-[#00a89c]/10 text-[#00a89c]',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function About() {
  const { t }  = useTranslation('landing');
  const { t: c } = useTranslation('common');

  const valueKeys = ['accuracy', 'clinician', 'xai', 'learning'] as const;
  const stepKeys  = ['input', 'analyse', 'output'] as const;

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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
              {t('about.eyebrow')}
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold text-white leading-tight tracking-tight mb-6 max-w-2xl">
              {t('about.heroTitle')}
            </h1>
            <p className="text-lg text-white/60 max-w-xl leading-relaxed">
              {t('about.heroDescription')}
            </p>
          </motion.div>
        </div>

      </section>

      {/* ── Mission + How it works ── */}
      <section className="py-24 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid md:grid-cols-2 gap-16">

            {/* Mission */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                {t('about.missionEyebrow')}
              </p>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-6">
                {t('about.missionTitle')}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t('about.missionP1')}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t('about.missionP2')}
              </p>
            </motion.div>

            {/* How it works */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
                {t('about.techEyebrow')}
              </p>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-8">
                {t('about.techTitle')}
              </h2>
              <div className="space-y-5">
                {stepKeys.map((key, i) => (
                  <motion.div 
                    key={key} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.15 }}
                    className="flex gap-4 items-start pb-5 border-b border-border last:border-0 last:pb-0"
                  >
                    <div className={`w-9 h-9 rounded-lg ${STEP_COLORS[i]} flex items-center justify-center text-xs font-bold shrink-0`}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      {/* UI label translated; description contains medical/algorithm terms kept in English */}
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {t(`about.steps.${key}.label`)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`about.steps.${key}.description`)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-24 border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mb-14 max-w-2xl"
          >
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              {t('about.valuesEyebrow')}
            </p>
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              {t('about.valuesTitle')}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {valueKeys.map((key, i) => {
              const { icon: Icon, color, bg } = VALUE_ICONS[key];
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card border border-border rounded-[var(--radius)] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200"
                >
                  <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-5`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    {t(`about.values.${key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`about.values.${key}.description`)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none translate-x-1/2 -translate-y-1/2" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto max-w-7xl px-4 sm:px-8 py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
        >
          <div>
            <h2 className="text-3xl font-semibold text-primary-foreground mb-3 tracking-tight">
              {t('about.ctaTitle')}
            </h2>
            <p className="text-primary-foreground/70 text-base leading-relaxed">
              {t('about.ctaDescription')}
            </p>
          </div>
          <Button
            asChild size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-lg gap-2 shrink-0"
          >
            <Link to="/register-organization">
              {c('nav.getStartedFree')} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
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
            {c('misc.copyrightShort', { year: new Date().getFullYear() })}
          </p>
          <div className="flex gap-5">
            <Link to="/"      className="text-sm text-white/50 hover:text-white transition-colors">{c('footer.home')}</Link>
            <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">{c('nav.signIn')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
