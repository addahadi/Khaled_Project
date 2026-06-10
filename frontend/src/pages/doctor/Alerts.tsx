import { useAlerts } from '@/contexts/AlertsContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatDate';
import { Bell, CheckCircle2, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { useState } from 'react';

export default function Alerts() {
  const { alerts, markRead, markAllRead, isLoading, unreadCount } = useAlerts();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'CRITICAL'>('ALL');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'UNREAD')   return !a.is_read;
    if (filter === 'CRITICAL') return a.type === 'CRITICAL';
    return true;
  });

  const getIconMeta = (type: string) => {
    switch (type) {
      case 'CRITICAL': return { icon: AlertTriangle, bg: 'bg-[#c0272d]/10', color: 'text-[#c0272d]' };
      case 'HIGH':     return { icon: TrendingUp,    bg: 'bg-[#e07020]/10', color: 'text-[#e07020]' };
      default:         return { icon: Info,          bg: 'bg-primary/10',   color: 'text-primary'   };
    }
  };

  const FILTERS: { value: 'ALL' | 'UNREAD' | 'CRITICAL'; label: string }[] = [
    { value: 'ALL',      label: 'All' },
    { value: 'UNREAD',   label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { value: 'CRITICAL', label: 'Critical' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" /> Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />)}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-[#00a89c]" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No alerts found for this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredAlerts.map(alert => {
            const { icon: Icon, bg, color } = getIconMeta(alert.type);
            return (
              <Card
                key={alert.alert_id}
                className={`transition-all ${
                  alert.is_read
                    ? 'opacity-60'
                    : 'border-l-[3px] border-l-primary'
                }`}
              >
                <CardContent className="p-4 flex gap-4">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm ${alert.is_read ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                        {alert.message}
                      </p>
                      {!alert.is_read && (
                        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(alert.created_at)}
                    </p>
                  </div>

                  {/* Mark read */}
                  {!alert.is_read && (
                    <div className="shrink-0 flex items-center">
                      <button
                        className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => markRead(alert.alert_id)}
                      >
                        Mark read
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
