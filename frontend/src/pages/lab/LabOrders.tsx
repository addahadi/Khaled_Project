import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FlaskConical, Loader2, UserCheck, User } from 'lucide-react';
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
  page:  number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:    'bg-[#fdf1da] text-[#a2680a] border-yellow-200',
  INPROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED:  'bg-[#defbe6] text-[#24a148] border-green-200',
  CANCELLED:  'bg-muted text-muted-foreground',
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'INPROGRESS', 'COMPLETED'];

export default function LabOrders() {
  const navigate       = useNavigate();
  const { toast }      = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [orders, setOrders]         = useState<LabOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('ALL');
  const [page, setPage]             = useState(1);
  const [actionId, setActionId]     = useState<string | null>(null);  // tracks which row is mid-action

  // Build query string and re-fetch whenever filter/search/page changes
  const loadOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== 'ALL') params.set('status', filter);
    if (search.trim())    params.set('search', search.trim());
    params.set('page',  String(page));
    params.set('limit', '20');

    ApiManager.execute({
      queryKey: ['lab', 'orders', filter, search, String(page)],
      endpoint: `/lab/orders?${params.toString()}`,
      onStart:   startLoading,
      onSuccess: (data: unknown) => {
        const d = data as { orders: LabOrder[]; pagination: Pagination };
        setOrders(d.orders);
        setPagination(d.pagination);
      },
      onFinal: stopLoading,
    });
  }, [filter, search, page, startLoading, stopLoading]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Reset to page 1 whenever search or filter changes
  useEffect(() => { setPage(1); }, [search, filter]);

  // ── Claim (start) ─────────────────────────────────────────────────────────
  const handleClaim = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/lab/orders/${testId}/start`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart: () => setActionId(testId),
      onSuccess: (_data, msg) => {
        toast({ title: 'Order claimed', description: msg });
        loadOrders();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setActionId(null),
    });
  };

  // ── Release ───────────────────────────────────────────────────────────────
  const handleRelease = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/lab/orders/${testId}/release`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart: () => setActionId(testId),
      onSuccess: (_data, msg) => {
        toast({ title: 'Order released', description: msg });
        loadOrders();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setActionId(null),
    });
  };

  const isOverdue = (date: string) =>
    Date.now() - new Date(date).getTime() > 86_400_000;

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-light">Lab Orders</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base">
              All Orders
              {pagination && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({pagination.total})
                </span>
              )}
            </CardTitle>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patient or test…"
                  className="pl-8"
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                />
              </div>

              {/* Status filter */}
              <div className="flex gap-1">
                {STATUS_FILTERS.map(s => (
                  <Button
                    key={s}
                    variant={filter === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(s)}
                  >
                    {s === 'ALL' ? 'All'
                      : s === 'INPROGRESS' ? 'In Progress'
                      : s.charAt(0) + s.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>

          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search || filter !== 'ALL' ? (
                <>
                  <Search className="mx-auto h-8 w-8 mb-2" />
                  <p>No orders match your filter.</p>
                  <Button
                    size="sm" variant="outline" className="mt-4"
                    onClick={() => { setSearch(''); setFilter('ALL'); }}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <FlaskConical className="mx-auto h-8 w-8 mb-2" />
                  <p>No lab orders found.</p>
                </>
              )}
            </div>

          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test Type</TableHead>
                    <TableHead>Ordered By</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ordered At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {orders.map(o => (
                    <TableRow
                      key={o.test_id}
                      className={o.is_mine ? 'bg-primary/5' : ''}
                    >
                      <TableCell className="font-medium">{o.patient_name}</TableCell>
                      <TableCell>{o.test_type}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {o.ordered_by_name ?? '—'}
                      </TableCell>

                      {/* Assignment column */}
                      <TableCell>
                        {o.assigned_tech_name ? (
                          <span className={`flex items-center gap-1 text-sm ${
                            o.is_mine ? 'text-primary font-medium' : 'text-muted-foreground'
                          }`}>
                            {o.is_mine
                              ? <UserCheck className="h-3.5 w-3.5 shrink-0" />
                              : <User      className="h-3.5 w-3.5 shrink-0" />
                            }
                            {o.is_mine ? 'You' : o.assigned_tech_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge className={`text-xs border ${STATUS_STYLES[o.status] ?? ''}`}>
                          {o.status === 'INPROGRESS' ? 'In Progress' : o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        <span>{formatDate(o.ordered_at)}</span>
                        {(o.status === 'PENDING' || o.status === 'INPROGRESS') && (
                          <span className={`block text-xs mt-0.5 ${
                            isOverdue(o.ordered_at) ? 'text-destructive font-medium' : 'text-muted-foreground'
                          }`}>
                            {timeAgo(o.ordered_at)}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {/* PENDING + unassigned → Claim */}
                          {o.status === 'PENDING' && !o.assigned_to && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionId === o.test_id}
                              onClick={() => handleClaim(o.test_id)}
                            >
                              {actionId === o.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              Claim
                            </Button>
                          )}

                          {/* INPROGRESS + mine → Enter Results + Release */}
                          {o.status === 'INPROGRESS' && o.is_mine && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => navigate(`/lab/orders/${o.test_id}`)}
                              >
                                Enter Results
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-muted-foreground"
                                disabled={actionId === o.test_id}
                                onClick={() => handleRelease(o.test_id)}
                              >
                                {actionId === o.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Release
                              </Button>
                            </>
                          )}

                          {/* INPROGRESS + claimed by someone else → read-only view */}
                          {o.status === 'INPROGRESS' && !o.is_mine && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/lab/orders/${o.test_id}`)}
                            >
                              View
                            </Button>
                          )}

                          {/* COMPLETED → View */}
                          {o.status === 'COMPLETED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/lab/orders/${o.test_id}`)}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-2">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
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
