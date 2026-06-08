import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, FlaskConical, CheckCheck } from 'lucide-react';
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

const TYPE_STYLES: Record<string, string> = {
  NEW_LAB_ORDER:  'bg-blue-50 text-blue-700 border-blue-200',
  RESULT_READY:   'bg-green-50 text-green-700 border-green-200',
  ABNORMAL_RESULT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CRITICAL_RESULT: 'bg-red-50 text-red-700 border-red-200',
};

const TYPE_LABELS: Record<string, string> = {
  NEW_LAB_ORDER:   'New Order',
  RESULT_READY:    'Ready',
  ABNORMAL_RESULT: 'Abnormal',
  CRITICAL_RESULT: 'Critical',
};

export default function LabAlerts() {
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [alerts, setAlerts]       = useState<LabAlert[]>([]);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadAlerts = useCallback(() => {
    ApiManager.execute({
      queryKey: ['lab', 'alerts'],
      endpoint: '/lab/alerts',
      onStart:   startLoading,
      onSuccess: (data: unknown) => {
        setAlerts((data as { alerts: LabAlert[] }).alerts);
      },
      onFinal: stopLoading,
    });
  }, [startLoading, stopLoading]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleMarkRead = (alertId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/lab/alerts/${alertId}/read`),
      invalidateKeys: [['lab', 'alerts']],
      onStart:   () => setMarkingId(alertId),
      onSuccess: () => {
        setAlerts(prev =>
          prev.map(a => a.alert_id === alertId ? { ...a, is_read: true } : a)
        );
      },
      onError: ({ message }) =>
        toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setMarkingId(null),
    });
  };

  const handleMarkAllRead = () => {
    const unread = alerts.filter(a => !a.is_read);
    unread.forEach(a => handleMarkRead(a.alert_id));
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-light">Alerts</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {alerts.map(alert => (
                <div
                  key={alert.alert_id}
                  className={`flex items-start gap-3 py-4 transition-colors ${
                    alert.is_read ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-full ${
                    alert.is_read ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    <FlaskConical className={`h-4 w-4 ${
                      alert.is_read ? 'text-muted-foreground' : 'text-primary'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs border ${
                        TYPE_STYLES[alert.alert_type] ?? 'bg-muted text-muted-foreground'
                      }`}>
                        {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                      </Badge>
                      {alert.patient_name && (
                        <span className="text-sm font-medium truncate">{alert.patient_name}</span>
                      )}
                      {!alert.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-snug">
                      {alert.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(alert.created_at)}
                    </p>
                  </div>

                  {!alert.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs h-7"
                      disabled={markingId === alert.alert_id}
                      onClick={() => handleMarkRead(alert.alert_id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
