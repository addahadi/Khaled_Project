import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Brain, FlaskConical, Bell,
  AlertTriangle, ChevronRight, CheckCircle2, Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ApiManager  from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import { getRiskConfig } from '@/lib/riskConfig';

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
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const location     = useLocation();
  const alertsRef    = useRef<HTMLDivElement>(null);
  const { isLoading: pLoading, startLoading: startP, stopLoading: stopP } = useDelayedLoading();
  const { isLoading: prLoading, startLoading: startPr, stopLoading: stopPr } = useDelayedLoading();
  const { isLoading: aLoading, startLoading: startA, stopLoading: stopA } = useDelayedLoading();

  const [patients,    setPatients]    = useState<Patient[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [alerts,      setAlerts]      = useState<Alert[]>([]);

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
      // DoctorLayout already fetches alerts for the bell badge — reuse cached
      // data for 30s to avoid a duplicate HTTP request on mount.
      staleTime: 30_000,
      onStart: startA,
      onSuccess: (d) => setAlerts((d as { alerts: Alert[] }).alerts),
      onFinal: stopA,
    });
  }, [startP, stopP, startPr, stopPr, startA, stopA]);

  // Scroll to alerts section when navigated via bell icon
  useEffect(() => {
    if ((location.state as { scrollTo?: string })?.scrollTo === 'alerts' && alertsRef.current) {
      alertsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Clear the state so re-renders don't re-scroll
      window.history.replaceState({}, '');
    }
  }, [location.state, aLoading]);

  const unreadAlerts    = alerts.filter(a => !a.is_read);
  const criticalPatients = patients.filter(p => p.risk_status === 'CRITICAL');
  const recentPredictions = predictions.slice(0, 5);
  const recentPatients    = patients.slice(0, 6);

  const markRead = (alertId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/doctor/alerts/${alertId}/read`),
      invalidateKeys: [['doctor', 'alerts']],
      onSuccess: () => {
        setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, is_read: true } : a));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, Dr. {user?.username}</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Patients',     val: patients.length,       icon: Users,      color: 'text-primary',     loading: pLoading  },
          { label: 'Critical Risk',      val: criticalPatients.length, icon: AlertTriangle, color: 'text-red-500', loading: pLoading  },
          { label: 'AI Predictions Run', val: predictions.length,    icon: Brain,      color: 'text-indigo-500',  loading: prLoading },
          { label: 'Unread Alerts',      val: unreadAlerts.length,   icon: Bell,       color: 'text-yellow-500',  loading: aLoading  },
        ].map(({ label, val, icon: Icon, color, loading }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {loading
                ? <Skeleton className="h-8 w-12" />
                : <div className="text-2xl font-bold">{val}</div>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent patients */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Patients</h2>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => navigate('/doctor/patients')}>
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          {pLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : recentPatients.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
              No patients yet. <button className="text-primary underline ml-1"
                onClick={() => navigate('/doctor/patients')}>Register one</button>
            </CardContent></Card>
          ) : recentPatients.map(p => (
            <Card key={p.patient_id}
              className="cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
              onClick={() => navigate(`/doctor/patients/${p.patient_id}`)}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.age} yrs</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.risk_status ? (() => {
                    const cfg = getRiskConfig(p.risk_status);
                    if (!cfg) return <Badge variant="secondary" className="text-xs">—</Badge>;
                    const RiskIcon = cfg.icon;
                    return (
                      <Badge className={`text-xs gap-1 ${cfg.badgeClass}`}>
                        <RiskIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    );
                  })() : (
                    <Badge variant="secondary" className="text-xs">No data</Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Recent predictions */}
          {recentPredictions.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-2">
                <h2 className="font-semibold">Recent Predictions</h2>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => navigate('/doctor/predictions')}>
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {recentPredictions.map(pr => (
                <Card key={pr.request_id}
                  className="cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
                  onClick={() => navigate('/doctor/predictions', { state: { openPrediction: pr.request_id } })}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{pr.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(pr.created_at)}
                        {pr.risk_score !== null && ` · Score: ${Math.round(pr.risk_score * 100)}%`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pr.risk_level && (() => {
                        const cfg = getRiskConfig(pr.risk_level);
                        if (!cfg) return null;
                        const RiskIcon = cfg.icon;
                        return (
                          <Badge className={`text-xs gap-1 ${cfg.badgeClass}`}>
                            <RiskIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        {/* Alerts panel */}
        <div className="space-y-3" ref={alertsRef}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              Alerts
              {unreadAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">{unreadAlerts.length}</Badge>
              )}
            </h2>
          </div>

          {aLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : alerts.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground">No alerts</p>
            </CardContent></Card>
          ) : alerts.slice(0, 8).map(a => (
            <Card key={a.alert_id}
              className={`transition-all ${a.is_read ? 'opacity-60' : 'border-primary/20'}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {a.alert_type === 'CRITICAL_RESULT' && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      )}
                      {a.alert_type === 'OVERAGE_STARTED' && (
                        <Zap className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate">
                        {a.patient_name ?? 'System'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                  {!a.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs h-7 px-2"
                      aria-label={`Mark alert from ${a.patient_name ?? 'System'} as read`}
                      onClick={() => markRead(a.alert_id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            className="w-full gap-2" size="sm"
            onClick={() => navigate('/doctor/predictions/new')}
          >
            <Brain className="h-4 w-4" /> Run New Prediction
          </Button>
        </div>
      </div>
    </div>
  );
}
