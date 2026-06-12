import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Brain, Bell,
  AlertTriangle, ChevronRight, CheckCircle2, Zap, Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import { getRiskConfig } from '@/lib/riskConfig';
import { useTranslation, Trans } from 'react-i18next';

interface Patient {
  patient_id: string; name: string; age: number;
  risk_status: string | null; risk_score: number | null; created_at: string;
}
interface Prediction {
  request_id: string; patient_name: string;
  risk_level: string | null; risk_score: number | null;
  confidence: number | null; created_at: string;
}
interface Alert {
  alert_id: string; patient_name: string | null;
  alert_type: string; message: string;
  is_read: boolean; created_at: string;
}

export default function DoctorDashboard() {
  const { t } = useTranslation('doctor');
  const { t: c } = useTranslation('common');
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const alertsRef = useRef<HTMLDivElement>(null);
  const { isLoading: pLoading, startLoading: startP, stopLoading: stopP } = useDelayedLoading();
  const { isLoading: prLoading, startLoading: startPr, stopLoading: stopPr } = useDelayedLoading();
  const { isLoading: aLoading, startLoading: startA, stopLoading: stopA } = useDelayedLoading();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['doctor', 'patients'],
      endpoint: '/doctor/patients',
      onStart: startP,
      onSuccess: (d) => setPatients((d as { patients: Patient[] }).patients),
      onFinal: stopP,
    });
    ApiManager.execute({
      queryKey: ['doctor', 'predictions'],
      endpoint: '/doctor/predictions',
      onStart: startPr,
      onSuccess: (d) => setPredictions((d as { predictions: Prediction[] }).predictions),
      onFinal: stopPr,
    });
    ApiManager.execute({
      queryKey: ['doctor', 'alerts'],
      endpoint: '/doctor/alerts',
      staleTime: 30_000,
      onStart: startA,
      onSuccess: (d) => setAlerts((d as { alerts: Alert[] }).alerts),
      onFinal: stopA,
    });
  }, [startP, stopP, startPr, stopPr, startA, stopA]);

  useEffect(() => {
    if ((location.state as { scrollTo?: string })?.scrollTo === 'alerts' && alertsRef.current) {
      alertsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState({}, '');
    }
  }, [location.state, aLoading]);

  const unreadAlerts = alerts.filter(a => !a.is_read);
  const criticalPatients = patients.filter(p => p.risk_status === 'CRITICAL');
  const recentPredictions = predictions.slice(0, 5);
  const recentPatients = patients.slice(0, 5);

  const markRead = (alertId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/doctor/alerts/${alertId}/read`),
      invalidateKeys: [['doctor', 'alerts']],
      onSuccess: () => {
        setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, is_read: true } : a));
      },
    });
  };

  const STAT_CARDS = [
    {
      label: t('dashboard.totalPatients'),
      val: patients.length,
      icon: Users,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      loading: pLoading,
    },
    {
      label: t('dashboard.criticalRisk'),
      val: criticalPatients.length,
      icon: AlertTriangle,
      iconBg: 'bg-[#c0272d]/10',
      iconColor: 'text-[#c0272d]',
      loading: pLoading,
      highlight: criticalPatients.length > 0,
    },
    {
      label: t('dashboard.predictionsRun'),
      val: predictions.length,
      icon: Brain,
      iconBg: 'bg-[#2e368f]/10',
      iconColor: 'text-[#2e368f]',
      loading: prLoading,
    },
    {
      label: t('dashboard.unreadAlerts'),
      val: unreadAlerts.length,
      icon: Bell,
      iconBg: 'bg-[#faaf3a]/15',
      iconColor: 'text-[#a2680a]',
      loading: aLoading,
      highlight: unreadAlerts.length > 0,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <Trans i18nKey="dashboard.welcome" t={t} values={{ name: user?.username }}>
              Welcome back, Dr. {{name: user?.username}}
            </Trans>
          </p>
        </div>
        <Button onClick={() => navigate('/doctor/predictions/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('dashboard.newPrediction')}
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, val, icon: Icon, iconBg, iconColor, loading, highlight }) => (
          <Card
            key={label}
            className={highlight ? 'border-destructive/20' : ''}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </div>
              {loading
                ? <Skeleton className="h-8 w-14 rounded-lg" />
                : <div className="text-3xl font-semibold text-foreground leading-none">{val}</div>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left: Patients + Predictions */}
        <div className="lg:col-span-2 space-y-6">

          {/* Recent Patients */}
          <Card>
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('dashboard.recentPatients')}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/doctor/patients')}
                >
                  {t('dashboard.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {pLoading ? (
                <div className="px-5 pb-5 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : recentPatients.length === 0 ? (
                <div className="px-5 pb-5 py-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">{t('dashboard.noPatientsYet')}</p>
                  <button
                    className="text-sm text-primary font-medium mt-1 hover:underline"
                    onClick={() => navigate('/doctor/patients')}
                  >
                    {t('dashboard.registerFirstPatient')}
                  </button>
                </div>
              ) : (
                <div>
                  {recentPatients.map((p, i) => (
                    <div
                      key={p.patient_id}
                      className={`flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${i < recentPatients.length - 1 ? 'border-b border-border' : ''}`}
                      onClick={() => navigate(`/doctor/patients/${p.patient_id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.age} {t('dashboard.yrs')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.risk_status ? (() => {
                          const cfg = getRiskConfig(p.risk_status);
                          if (!cfg) return <Badge variant="secondary">—</Badge>;
                          const RiskIcon = cfg.icon;
                          return (
                            <Badge className={`gap-1 ${cfg.badgeClass}`}>
                              <RiskIcon className="h-3 w-3" />
                              {t(`patients.riskLevels.${cfg.label.toUpperCase()}`) ?? cfg.label}
                            </Badge>
                          );
                        })() : (
                          <Badge variant="secondary">{t('dashboard.noData')}</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Predictions */}
          {(prLoading || recentPredictions.length > 0) && (
            <Card>
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t('dashboard.recentPredictions')}</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => navigate('/doctor/predictions')}
                  >
                    {t('dashboard.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {prLoading ? (
                  <div className="px-5 pb-5 space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : (
                  <div>
                    {recentPredictions.map((pr, i) => (
                      <div
                        key={pr.request_id}
                        className={`flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${i < recentPredictions.length - 1 ? 'border-b border-border' : ''}`}
                        onClick={() => navigate('/doctor/predictions', { state: { openPrediction: pr.request_id } })}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#2e368f]/10 flex items-center justify-center shrink-0">
                            <Brain className="h-4 w-4 text-[#2e368f]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{pr.patient_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(pr.created_at)}
                              {pr.risk_score !== null && (
                                <span className="ml-1.5">· {t('dashboard.score')}: {Math.round(pr.risk_score * 100)}%</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {pr.risk_level && (() => {
                            const cfg = getRiskConfig(pr.risk_level);
                            if (!cfg) return null;
                            const RiskIcon = cfg.icon;
                            return (
                              <Badge className={`gap-1 ${cfg.badgeClass}`}>
                                <RiskIcon className="h-3 w-3" />
                                {t(`patients.riskLevels.${cfg.label.toUpperCase()}`) ?? cfg.label}
                              </Badge>
                            );
                          })()}
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Alerts panel */}
        <div ref={alertsRef}>
          <Card className="h-full">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {t('dashboard.alertsTitle')}
                  {unreadAlerts.length > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                      {unreadAlerts.length}
                    </span>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/doctor/alerts')}
                >
                  {t('dashboard.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-4">
              {aLoading ? (
                <div className="px-5 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : alerts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="h-5 w-5 text-[#00a89c]" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.allClear')}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {alerts.slice(0, 5).map((a, i) => (
                    <div
                      key={a.alert_id}
                      className={`px-5 py-3 transition-all ${a.is_read ? 'opacity-50' : ''} ${i < Math.min(alerts.length, 5) - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                            a.alert_type === 'CRITICAL_RESULT'
                              ? 'bg-[#c0272d]/10'
                              : a.alert_type === 'OVERAGE_STARTED'
                              ? 'bg-[#faaf3a]/15'
                              : 'bg-primary/10'
                          }`}>
                            {a.alert_type === 'CRITICAL_RESULT' && (
                              <AlertTriangle className="h-3.5 w-3.5 text-[#c0272d]" />
                            )}
                            {a.alert_type === 'OVERAGE_STARTED' && (
                              <Zap className="h-3.5 w-3.5 text-[#a2680a]" />
                            )}
                            {a.alert_type !== 'CRITICAL_RESULT' && a.alert_type !== 'OVERAGE_STARTED' && (
                              <Bell className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {a.patient_name ?? 'System'}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {a.message}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {formatDate(a.created_at)}
                            </p>
                          </div>
                        </div>
                        {!a.is_read && (
                          <button
                            className="shrink-0 text-[10px] font-medium text-primary hover:underline mt-0.5"
                            aria-label={`Mark alert from ${a.patient_name ?? 'System'} as read`}
                            onClick={() => markRead(a.alert_id)}
                          >
                            {c('actions.markRead')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
