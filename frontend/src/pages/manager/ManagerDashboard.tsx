import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Users, Brain, AlertTriangle, FlaskConical,
  TrendingUp, CreditCard, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { useTranslation } from 'react-i18next';

interface ReportData {
  staffCounts:  { doctors: string; lab_techs: string; managers: string; total: string };
  labStats:     { total_tests: string; pending: string; completed: string; critical_results: string };
  predStats:    { total_predictions: string; critical: string; high: string; moderate: string; low: string };
  usageStats:   { prediction_used: number; prediction_overage: number; prediction_limit: number | null } | null;
}

const RISK_BARS = [
  { key: 'critical', bar: 'bg-[#c0272d]', text: 'text-[#c0272d]' },
  { key: 'high',     bar: 'bg-[#e07020]', text: 'text-[#e07020]' },
  { key: 'moderate', bar: 'bg-[#faaf3a]', text: 'text-[#a2680a]' },
  { key: 'low',      bar: 'bg-[#00a89c]', text: 'text-[#007a71]' },
] as const;

export default function ManagerDashboard() {
  const { t }      = useTranslation('manager');
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [reports, setReports] = useState<ReportData | null>(null);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['manager', 'reports'],
      endpoint:  '/manager/reports',
      onStart:   startLoading,
      onSuccess: (d) => setReports((d as { reports: ReportData }).reports),
      onFinal:   stopLoading,
    });
  }, [startLoading, stopLoading]);

  const usagePct = reports?.usageStats?.prediction_limit
    ? Math.min((reports.usageStats.prediction_used / reports.usageStats.prediction_limit) * 100, 100)
    : null;

  const KPIS = [
    {
      label: t('dashboard.kpis.totalStaff.label'),
      value: reports?.staffCounts.total,
      icon: Users,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      sub: t('dashboard.kpis.totalStaff.sub', {
        doctors: reports?.staffCounts.doctors ?? '—',
        labTechs: reports?.staffCounts.lab_techs ?? '—'
      }),
      action: () => navigate('/manager/staff'),
    },
    {
      label: t('dashboard.kpis.aiPredictions.label'),
      value: reports?.predStats.total_predictions,
      icon: Brain,
      iconBg: 'bg-[#2e368f]/10',
      iconColor: 'text-[#2e368f]',
      sub: t('dashboard.kpis.aiPredictions.sub', { count: reports?.predStats.critical ?? '0' }),
      action: () => navigate('/manager/reports'),
    },
    {
      label: t('dashboard.kpis.labTests.label'),
      value: reports?.labStats.total_tests,
      icon: FlaskConical,
      iconBg: 'bg-[#00a89c]/10',
      iconColor: 'text-[#007a71]',
      sub: t('dashboard.kpis.labTests.sub', { count: reports?.labStats.pending ?? '0' }),
      action: () => navigate('/manager/reports'),
    },
    {
      label: t('dashboard.kpis.criticalResults.label'),
      value: reports?.labStats.critical_results,
      icon: AlertTriangle,
      iconBg: 'bg-[#c0272d]/10',
      iconColor: 'text-[#c0272d]',
      sub: t('dashboard.kpis.criticalResults.sub'),
      highlight: Number(reports?.labStats.critical_results) > 0,
      action: () => navigate('/manager/reports'),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.welcome', { name: user?.username })}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/manager/reports')}>
          <TrendingUp className="h-4 w-4" /> {t('dashboard.fullReports')}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map(({ label, value, icon: Icon, iconBg, iconColor, sub, highlight, action }) => (
          <Card
            key={label}
            className={`cursor-pointer hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-150 ${
              highlight ? 'border-[#c0272d]/25' : ''
            }`}
            onClick={action}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </div>
              {isLoading
                ? <Skeleton className="h-8 w-14 rounded-lg" />
                : <div className="text-3xl font-semibold text-foreground leading-none">{value ?? '—'}</div>
              }
              {!isLoading && sub && (
                <p className="text-xs text-muted-foreground mt-2">{sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom row: Subscription + Risk Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Subscription usage */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('dashboard.subscriptionUsage')}</CardTitle>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/manager/subscription')}>
                <CreditCard className="h-3.5 w-3.5" /> {t('dashboard.manage')} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isLoading ? (
              <div className="space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-2 w-full rounded-full" /></div>
            ) : reports?.usageStats ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('dashboard.aiPredictionsUsed')}</span>
                  <span className="font-medium">
                    {reports.usageStats.prediction_used}
                    {reports.usageStats.prediction_limit && (
                      <span className="text-muted-foreground"> / {reports.usageStats.prediction_limit}</span>
                    )}
                  </span>
                </div>
                {usagePct !== null && (
                  <Progress
                    value={usagePct}
                    className={usagePct > 85 ? '[&>div]:bg-[#c0272d]' : '[&>div]:bg-primary'}
                  />
                )}
                {usagePct !== null && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('dashboard.usedThisCycle', { pct: Math.round(usagePct) })}</span>
                    {usagePct > 85 && (
                      <span className="text-[#c0272d] font-medium">{t('dashboard.approachingLimit')}</span>
                    )}
                  </div>
                )}
                {reports.usageStats.prediction_overage > 0 && (
                  <Badge className="bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20 rounded-full text-xs">
                    {t('dashboard.overagePredictions', { count: reports.usageStats.prediction_overage })}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">{t('dashboard.noActiveSubscription')}</p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/manager/subscription')}>
                  {t('dashboard.choosePlan')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk distribution */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('dashboard.riskDistribution')}</CardTitle>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/manager/reports')}>
                {t('dashboard.viewReports')} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-5 w-full rounded-full" />)}
              </div>
            ) : reports?.predStats ? (
              RISK_BARS.map(({ key, bar, text }) => {
                const val   = Number(reports.predStats[key as keyof typeof reports.predStats]);
                const total = Number(reports.predStats.total_predictions) || 1;
                const pct   = Math.round((val / total) * 100);
                const label = t(`dashboard.riskLevels.${key}`);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`w-16 text-sm font-medium ${text}`}>{label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`${bar} h-2 rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                        role="progressbar" aria-valuenow={val} aria-valuemin={0} aria-valuemax={total}
                        aria-label={`${label}: ${val} (${pct}%)`}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-[48px] justify-end">
                      <span className="text-sm font-semibold text-foreground">{val}</span>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noPredictionData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
