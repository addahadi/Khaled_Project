import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search, FlaskConical, Loader2,
  UserCheck, User, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate, timeAgo } from '@/lib/formatDate';
import { useTranslation, Trans } from 'react-i18next';

interface LabOrder {
  test_id:            string;
  test_type:          string;
  status:             'PENDING' | 'INPROGRESS' | 'COMPLETED' | 'CANCELLED';
  patient_name:       string;
  patient_age:        number;
  ordered_by_name:    string;
  notes:              string;
  ordered_at:         string;
  assigned_to:        string | null;
  assigned_at:        string | null;
  assigned_tech_name: string | null;
  is_mine:            boolean;
}

interface Pagination {
  page: number; limit: number; total: number; pages: number;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:    'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30',
  INPROGRESS: 'bg-primary/10 text-primary border border-primary/20',
  COMPLETED:  'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25',
  CANCELLED:  'bg-muted text-muted-foreground border border-border',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', INPROGRESS: 'In Progress',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'INPROGRESS', 'COMPLETED'];

export default function LabOrders() {
  const { t } = useTranslation('lab');
  const { t: c } = useTranslation('common');
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [orders,      setOrders]      = useState<LabOrder[]>([]);
  const [pagination,  setPagination]  = useState<Pagination | null>(null);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('ALL');
  const [sort,        setSort]        = useState('recent');
  const [page,        setPage]        = useState(1);
  const [actionId,    setActionId]    = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== 'ALL') params.set('status', filter);
    if (search.trim())    params.set('search', search.trim());
    if (sort !== 'recent') params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '20');

    ApiManager.execute({
      queryKey: ['lab', 'orders', filter, search, sort, String(page)],
      endpoint: `/lab/orders?${params.toString()}`,
      onStart:   startLoading,
      onSuccess: (d) => {
        const data = d as { orders: LabOrder[]; pagination: Pagination };
        setOrders(data.orders);
        setPagination(data.pagination);
      },
      onFinal: stopLoading,
    });
  }, [filter, search, sort, page, startLoading, stopLoading]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { setPage(1); }, [search, filter, sort]);

  const handleClaim = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch(`/lab/orders/${testId}/start`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart:   () => setActionId(testId),
      onSuccess: (_d, msg) => { toast({ title: t('orders.orderClaimed'), description: msg }); loadOrders(); },
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setActionId(null),
    });
  };

  const handleRelease = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch(`/lab/orders/${testId}/release`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart:   () => setActionId(testId),
      onSuccess: (_d, msg) => { toast({ title: t('orders.orderReleased'), description: msg }); loadOrders(); },
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setActionId(null),
    });
  };

  const isOverdue = (date: string) => Date.now() - new Date(date).getTime() > 86_400_000;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('orders.title')}</h1>
          {pagination && (
            <p className="text-sm text-muted-foreground mt-0.5"><Trans i18nKey="orders.totalOrders" t={t} count={pagination.total}>{{count: pagination.total}} total orders</Trans></p>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t('orders.searchPlaceholder')}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('orders.sortPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{t('orders.sortRecent')}</SelectItem>
            <SelectItem value="older">{t('orders.sortOlder')}</SelectItem>
            <SelectItem value="A-Z">{t('orders.sortAZ')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 p-1 bg-muted rounded-[var(--radius)]">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === s
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'ALL' ? c('filters.all') : t(`orders.statusFilters.${s}`) ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <Card>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="px-5 py-4 space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                {search || filter !== 'ALL'
                  ? <Search className="h-5 w-5 text-muted-foreground" />
                  : <FlaskConical className="h-5 w-5 text-muted-foreground" />
                }
              </div>
              <p className="text-sm font-medium text-foreground">
                {search || filter !== 'ALL' ? t('orders.noMatch') : t('orders.noOrders')}
              </p>
              {(search || filter !== 'ALL') && (
                <Button size="sm" variant="outline" className="mt-4"
                  onClick={() => { setSearch(''); setFilter('ALL'); }}>
                  {t('orders.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Table head */}
              <div className="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 px-5 py-2.5 border-b border-border bg-muted/30">
                {[t('orders.table.patient'), t('orders.table.testType'), t('orders.table.orderedBy'), t('orders.table.assignedTo'), t('orders.table.status'), t('orders.table.orderedAt'), ''].map(h => (
                  <span key={h} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
                ))}
              </div>

              {/* Table rows */}
              {orders.map((o, i) => (
                <div
                  key={o.test_id}
                  className={`grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 items-center px-5 py-3 transition-colors ${
                    o.is_mine ? 'bg-primary/[0.03]' : ''
                  } ${i < orders.length - 1 ? 'border-b border-border' : ''} hover:bg-muted/30`}
                >
                  <span className="text-sm font-medium text-foreground truncate">{o.patient_name}</span>
                  <span className="text-sm text-foreground truncate">{o.test_type}</span>
                  <span className="text-xs text-muted-foreground truncate">{o.ordered_by_name ?? '—'}</span>

                  {/* Assignment */}
                  <span className={`flex items-center gap-1.5 text-xs truncate ${
                    o.assigned_tech_name
                      ? o.is_mine ? 'text-primary font-medium' : 'text-muted-foreground'
                      : 'text-muted-foreground/60 italic'
                  }`}>
                    {o.assigned_tech_name ? (
                      o.is_mine
                        ? <><UserCheck className="h-3.5 w-3.5 shrink-0" /> {t('orders.you')}</>
                        : <><User className="h-3.5 w-3.5 shrink-0" /> {o.assigned_tech_name}</>
                    ) : t('orders.unassigned')}
                  </span>

                  {/* Status */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_BADGE[o.status] ?? ''}`}>
                    {t(`orders.status.${o.status}`) ?? o.status}
                  </span>

                  {/* Date + overdue */}
                  <div>
                    <span className="text-xs text-muted-foreground">{formatDate(o.ordered_at)}</span>
                    {(o.status === 'PENDING' || o.status === 'INPROGRESS') && (
                      <span className={`flex items-center gap-0.5 text-[10px] mt-0.5 font-medium ${
                        isOverdue(o.ordered_at) ? 'text-[#c0272d]' : 'text-muted-foreground'
                      }`}>
                        {isOverdue(o.ordered_at) && <AlertTriangle className="h-2.5 w-2.5" />}
                        {timeAgo(o.ordered_at)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 justify-end flex-wrap">
                    {o.status === 'PENDING' && !o.assigned_to && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        disabled={actionId === o.test_id}
                        onClick={() => handleClaim(o.test_id)}
                      >
                        {actionId === o.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {t('orders.actions.claim')}
                      </Button>
                    )}
                    {o.status === 'INPROGRESS' && o.is_mine && (
                      <>
                        <Button size="sm" className="h-7 text-xs"
                          onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                          {t('orders.actions.enterResults')}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground"
                          disabled={actionId === o.test_id}
                          onClick={() => handleRelease(o.test_id)}
                        >
                          {actionId === o.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {t('orders.actions.release')}
                        </Button>
                      </>
                    )}
                    {o.status === 'INPROGRESS' && !o.is_mine && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                        {t('orders.actions.view')}
                      </Button>
                    )}
                    {o.status === 'COMPLETED' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                        {t('orders.actions.view')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <Trans i18nKey="orders.pagination" t={t} values={{page: pagination.page, pages: pagination.pages, total: pagination.total}}>Page {{page: pagination.page}} of {{pages: pagination.pages}} · {{total: pagination.total}} orders</Trans>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> {c('pagination.previous')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      {c('pagination.next')} <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
