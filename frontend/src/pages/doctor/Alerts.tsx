import { useAlerts } from '@/contexts/AlertsContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatDate';
import { Bell, CheckCircle2, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { useState } from 'react';

export default function Alerts() {
  const { alerts, markRead, markAllRead, isLoading, unreadCount } = useAlerts();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'CRITICAL'>('ALL');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'UNREAD') return !a.is_read;
    if (filter === 'CRITICAL') return a.type === 'CRITICAL';
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'HIGH': return <TrendingUp className="h-5 w-5 text-orange-600" />;
      default: return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            You have {unreadCount} unread alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button 
          variant={filter === 'ALL' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setFilter('ALL')}
        >
          All
        </Button>
        <Button 
          variant={filter === 'UNREAD' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setFilter('UNREAD')}
        >
          Unread
        </Button>
        <Button 
          variant={filter === 'CRITICAL' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setFilter('CRITICAL')}
        >
          Critical
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500/50 mb-3" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No alerts found for this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <Card key={alert.alert_id} className={`transition-all ${alert.is_read ? 'opacity-70 bg-muted/20' : 'border-l-4 border-l-primary shadow-sm'}`}>
              <CardContent className="p-4 flex gap-4">
                <div className="shrink-0 mt-1">
                  {getIcon(alert.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between">
                    <p className={`font-medium ${!alert.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {alert.message}
                    </p>
                    {!alert.is_read && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 shrink-0 ml-4">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(alert.created_at)}
                  </p>
                </div>
                {!alert.is_read && (
                  <div className="shrink-0 flex items-center">
                    <Button variant="ghost" size="sm" onClick={() => markRead(alert.alert_id)}>
                      Mark read
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
