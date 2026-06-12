import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList, Clock, CheckCircle2, FlaskConical,
  Loader2, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { timeAgo } from '@/lib/formatDate';
import { useTranslation } from 'react-i18next';

interface LabStats {
  pending_count:    string;
  inprogress_count: string;
  completed_today:  string;
  total_completed:  string;
}

interface LabOrder {
  test_id:         string;
  test_type:       string;
  status:          string;
  patient_name:    string;
  ordered_by_name: string;
  ordered_at:      string;
}

// Visual-only — badge colours are not translated
const STATUS_BADGE: Record<string, string> = {
  PENDING:    'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30',
  INPROGRESS: 'bg-primary/10 text-primary border border-primary/20',
  COMPLETED:  'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25',
};

export default function LabDashboard() {
  const { t }      = useTranslation('lab');
  const { t: c }   = useTranslation('common');
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { toast }  = useToast();
  const { isLoading: statsLoading,  startLoading: startStats,  stopLoading: stopStats  } = useDelayedLoading();
  const { isLoading: ordersLoading, startLoading: startOrders, stopLoading: stopOrders } = useDelayedLoading();

  const [stats,         setStats]         = useState<LabStats | null>(null);
  const [pendingOrders, setPendingOrders] = useState<LabOrder[]>([]);
  const [startingId,    setStartingId]    = useState<string | null>(null);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['lab', 'stats'],
      endpoint: '/lab/stats',
      onStart:   startStats,
      onSuccess: (d) => setStats((d as { stats: LabStats }).stats),
      onFinal:   stopStats,
    });
    ApiManager.execute({
      queryKey: ['lab', 'orders'],
      endpoint: '/lab/orders',
      onStart:   startOrders,
      onSuccess: (d) => {
        const all = (d as { orders: LabOrder[] }).orders;
        setPendingOrders(all.filter(o => o.status === 'PENDING' || o.status === 'INPROGRESS').slice(0, 8));
      },
      onFinal: stopOrders,
    });
  }, [startStats, stopStats, startOrders, stopOrders]);

  const startOrder = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch(`/lab/orders/${testId}/start`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart:   () => setStartingId(testId),
      onSuccess: () => setPendingOrders(prev => prev.map(o => o.test_id === testId ? { ...o, status: 'INPROGRESS' } : o)),
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setStartingId(null),
    });
  };

  const STAT_CARDS = [
    { label: t('dashboard.kpis.pendingOrders'),  value: stats?.pending_count,    icon: Clock,        iconBg: 'bg-[#faaf3a]/15', iconColor: 'text-[#a2680a]',  highlight: Number(stats?.pending_count) > 0 },
    { label: t('dashboard.kpis.inProgress'),     value: stats?.inprogress_count, icon: FlaskConical, iconBg: 'bg-primary/10',   iconColor: 'text-primary',     highlight: false },
    { label: t('dashboard.kpis.completedToday'), value: stats?.completed_today,  icon: CheckCircle2, iconBg: 'bg-[#00a89c]/10', iconColor: 'text-[#007a71]',   highlight: false },
    { label: t('dashboard.kpis.totalCompleted'), value: stats?.total_completed,  icon: ClipboardList,iconBg: 'bg-[#2e368f]/10', iconColor: 'text-[#2e368f]',   highlight: false },
  ];

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.welcome', { name: user?.username })}</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, iconBg, iconColor, highlight }) => (
          <Card key={label} className={highlight ? 'border-[#faaf3a]/30' : ''}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </div>
              {statsLoading
                ? <Skeleton className="h-8 w-14 rounded-lg" />
                : <div className="text-3xl font-semibold text-foreground leading-none">{value ?? '—'}</div>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending orders */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('dashboard.pendingOrdersTitle')}</CardTitle>
            <Button size="sm" variant="ghost"
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/lab/orders')}
            >
              {t('dashboard.viewAll')} <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {ordersLoading ? (
            <div className="px-5 pb-5 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="px-5 pb-8 pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-[#007a71]" />
              </div>
              <p className="text-sm font-medium text-foreground">{t('dashboard.allCaughtUp')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('dashboard.noPendingOrders')}</p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto] gap-3 px-5 py-2 border-b border-border bg-muted/30">
                {[
                  t('dashboard.table.patient'),
                  t('dashboard.table.testType'),
                  t('dashboard.table.orderedBy'),
                  t('dashboard.table.status'),
                  t('dashboard.table.waiting'),
                  '',
                ].map((h, i) => (
                  <span key={i} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
                ))}
              </div>
              {pendingOrders.map((order, i) => {
                const isOverdue = Date.now() - new Date(order.ordered_at).getTime() > 86_400_000;
                return (
                  <div
                    key={order.test_id}
                    className={`grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 ${
                      i < pendingOrders.length - 1 ? 'border-b border-border' : ''
                    } hover:bg-muted/30 transition-colors`}
                  >
                    {/* Patient name: medical data — stays as-is from API */}
                    <span className="text-sm font-medium text-foreground truncate">{order.patient_name}</span>
                    {/* Test type: medical data — stays as-is from API */}
                    <span className="text-sm text-foreground truncate">{order.test_type}</span>
                    {/* Ordered by: user data — stays as-is from API */}
                    <span className="text-xs text-muted-foreground truncate">{order.ordered_by_name}</span>
                    {/* Status: UI chrome — translated */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_BADGE[order.status] ?? ''}`}>
                      {t(`orders.status.${order.status}`, { defaultValue: order.status })}
                    </span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-[#c0272d]' : 'text-muted-foreground'}`}>
                      {isOverdue && <AlertTriangle className="h-3 w-3" />}
                      {timeAgo(order.ordered_at)}
                    </span>
                    <div className="flex justify-end">
                      {order.status === 'PENDING' ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => startOrder(order.test_id)}
                          disabled={startingId === order.test_id}
                        >
                          {startingId === order.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {t('dashboard.actions.start')}
                        </Button>
                      ) : (
                        <Button size="sm" className="h-7 text-xs"
                          onClick={() => navigate(`/lab/orders/${order.test_id}`)}>
                          {t('dashboard.actions.enterResults')}
                        </Button>
                      )}
                    </div>
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
