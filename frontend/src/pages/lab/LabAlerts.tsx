import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell, BellOff, FlaskConical, CheckCheck,
  AlertTriangle, CheckCircle2, Activity, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { timeAgo } from '@/lib/formatDate';

interface LabAlert {
  alert_id:     string;
  patient_id:   string | null;
  patient_name: string | null;
  alert_type:   string;
  message:      string;
  is_read:      boolean;
  read_at:      string | null;
  created_at:   string;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string; badgeBg: string; icon: React.ElementType }> = {
  NEW_LAB_ORDER:   { label: 'New Order',  bg: 'bg-primary/10',   color: 'text-primary',   badgeBg: 'bg-primary/10 text-primary border border-primary/20',           icon: FlaskConical   },
  RESULT_READY:    { label: 'Ready',      bg: 'bg-[#00a89c]/10', color: 'text-[#007a71]', badgeBg: 'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25',     icon: CheckCircle2   },
  ABNORMAL_RESULT: { label: 'Abnormal',   bg: 'bg-[#faaf3a]/15', color: 'text-[#a2680a]', badgeBg: 'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30',     icon: Activity       },
  CRITICAL_RESULT: { label: 'Critical',   bg: 'bg-[#c0272d]/10', color: 'text-[#c0272d]', badgeBg: 'bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20',     icon: AlertTriangle  },
};

const FALLBACK_CONFIG = { label: 'Info', bg: 'bg-muted', color: 'text-muted-foreground', badgeBg: 'bg-muted text-muted-foreground border border-border', icon: Info };

export default function LabAlerts() {
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [alerts,     setAlerts]     = useState<LabAlert[]>([]);
  const [markingId,  setMarkingId]  = useState<string | null>(null);
  const [filter,     setFilter]     = useState<'ALL' | 'UNREAD'>('ALL');

  const loadAlerts = useCallback(() => {
    ApiManager.execute({
      queryKey: ['lab', 'alerts'],
      endpoint:  '/lab/alerts',
      onStart:   startLoading,
      onSuccess: (d) => setAlerts((d as { alerts: LabAlert[] }).alerts),
      onFinal:   stopLoading,
    });
  }, [startLoading, stopLoading]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleMarkRead = (alertId: string) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch(`/lab/alerts/${alertId}/read`),
      invalidateKeys: [['lab', 'alerts']],
      onStart:   () => setMarkingId(alertId),
      onSuccess: () => setAlerts(prev => prev.map(a => a.alert_id === alertId ? { ...a, is_read: true } : a)),
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setMarkingId(null),
    });
  };

  const handleMarkAllRead = () => {
    alerts.filter(a => !a.is_read).forEach(a => handleMarkRead(a.alert_id));
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const displayed   = filter === 'UNREAD' ? alerts.filter(a => !a.is_read) : alerts;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" /> Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['ALL', 'UNREAD'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === f
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
            }`}
          >
            {f === 'ALL' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardContent className="px-0 py-0">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : displayed.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <BellOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet.'}
              </p>
            </div>
          ) : (
            <div>
              {displayed.map((alert, i) => {
                const cfg = TYPE_CONFIG[alert.alert_type] ?? FALLBACK_CONFIG;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.alert_id}
                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                      alert.is_read ? 'opacity-55' : ''
                    } ${i < displayed.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    {/* Icon box */}
                    <div className={`w-9 h-9 rounded-lg ${alert.is_read ? 'bg-muted' : cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${alert.is_read ? 'text-muted-foreground' : cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badgeBg}`}>
                          {cfg.label}
                        </span>
                        {alert.patient_name && (
                          <span className="text-sm font-medium text-foreground truncate">{alert.patient_name}</span>
                        )}
                        {!alert.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-snug">{alert.message}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo(alert.created_at)}</p>
                    </div>

                    {/* Mark read */}
                    {!alert.is_read && (
                      <button
                        className="shrink-0 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mt-0.5 disabled:opacity-50"
                        disabled={markingId === alert.alert_id}
                        onClick={() => handleMarkRead(alert.alert_id)}
                        aria-label={`Mark alert from ${alert.patient_name ?? 'system'} as read`}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
