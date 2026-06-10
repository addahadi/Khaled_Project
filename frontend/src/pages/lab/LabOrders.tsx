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
      onSuccess: (_d, msg) => { toast({ title: 'Order claimed', description: msg }); loadOrders(); },
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setActionId(null),
    });
  };

  const handleRelease = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch(`/lab/orders/${testId}/release`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart:   () => setActionId(testId),
      onSuccess: (_d, msg) => { toast({ title: 'Order released', description: msg }); loadOrders(); },
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
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Lab Orders</h1>
          {pagination && (
            <p className="text-sm text-muted-foreground mt-0.5">{pagination.total} total orders</p>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search patient or test…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently Added</SelectItem>
            <SelectItem value="older">Older First</SelectItem>
            <SelectItem value="A-Z">Name (A-Z)</SelectItem>
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
              {s === 'ALL' ? 'All' : s === 'INPROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
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
                {search || filter !== 'ALL' ? 'No orders match your filter.' : 'No lab orders found.'}
              </p>
              {(search || filter !== 'ALL') && (
                <Button size="sm" variant="outline" className="mt-4"
                  onClick={() => { setSearch(''); setFilter('ALL'); }}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Table head */}
              <div className="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 px-5 py-2.5 border-b border-border bg-muted/30">
                {['Patient', 'Test Type', 'Ordered By', 'Assigned To', 'Status', 'Ordered At', ''].map(h => (
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
                        ? <><UserCheck className="h-3.5 w-3.5 shrink-0" /> You</>
                        : <><User className="h-3.5 w-3.5 shrink-0" /> {o.assigned_tech_name}</>
                    ) : 'Unassigned'}
                  </span>

                  {/* Status */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_BADGE[o.status] ?? ''}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
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
                        Claim
                      </Button>
                    )}
                    {o.status === 'INPROGRESS' && o.is_mine && (
                      <>
                        <Button size="sm" className="h-7 text-xs"
                          onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                          Enter Results
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-muted-foreground"
                          disabled={actionId === o.test_id}
                          onClick={() => handleRelease(o.test_id)}
                        >
                          {actionId === o.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Release
                        </Button>
                      </>
                    )}
                    {o.status === 'INPROGRESS' && !o.is_mine && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                        View
                      </Button>
                    )}
                    {o.status === 'COMPLETED' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} · {pagination.total} orders
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 gap-1"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Previous
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
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
