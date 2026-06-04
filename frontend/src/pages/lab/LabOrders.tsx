import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FlaskConical, Loader2, ListX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate, timeAgo } from '@/lib/formatDate';

interface LabOrder {
  test_id: string;
  test_type: string;
  status: 'PENDING' | 'INPROGRESS' | 'COMPLETED' | 'CANCELLED';
  patient_name: string;
  patient_age: number;
  ordered_by_name: string;
  notes: string;
  ordered_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  INPROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED:  'bg-green-100 text-green-800 border-green-200',
  CANCELLED:  'bg-muted text-muted-foreground',
};

export default function LabOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    ApiManager.execute({
      queryKey: ['lab', 'orders'],
      endpoint: '/lab/orders',
      onStart: startLoading,
      onSuccess: (data: unknown) => setOrders((data as { orders: LabOrder[] }).orders),
      onFinal: stopLoading,
    });
  }, [startLoading, stopLoading]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = orders.filter(o => {
    const matchesSearch =
      o.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      o.test_type.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || o.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleStart = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/lab/orders/${testId}/start`),
      invalidateKeys: [['lab', 'orders']],
      onStart: () => setStartingId(testId),
      onSuccess: () =>
        setOrders(prev =>
          prev.map(o => o.test_id === testId ? { ...o, status: 'INPROGRESS' } : o)
        ),
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setStartingId(null),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lab Orders</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base">All Orders</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patient or test..."
                  className="pl-8"
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {['ALL', 'PENDING', 'INPROGRESS', 'COMPLETED'].map(s => (
                  <Button
                    key={s}
                    variant={filter === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(s)}
                  >
                    {s === 'ALL' ? 'All' : s === 'INPROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
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
          ) : filtered.length === 0 && orders.length > 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="mx-auto h-8 w-8 mb-2" />
              <p>No orders match your filter.</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => { setSearch(''); setFilter('ALL'); }}>
                Clear Filters
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="mx-auto h-8 w-8 mb-2" />
              <p>No lab orders found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.test_id}>
                    <TableCell className="font-medium">{o.patient_name}</TableCell>
                    <TableCell>{o.test_type}</TableCell>
                    <TableCell className="text-muted-foreground">{o.ordered_by_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_STYLES[o.status] ?? ''}`}>{o.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <span>{formatDate(o.ordered_at)}</span>
                      {(o.status === 'PENDING' || o.status === 'INPROGRESS') && (
                        <span className={`block text-xs mt-0.5 ${
                          // Highlight if waiting more than 24h
                          Date.now() - new Date(o.ordered_at).getTime() > 86_400_000
                            ? 'text-destructive font-medium' : 'text-muted-foreground'
                        }`}>
                          {timeAgo(o.ordered_at)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {o.status === 'PENDING' && (
                          <Button size="sm" variant="outline" onClick={() => handleStart(o.test_id)} disabled={startingId === o.test_id}>
                            {startingId === o.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Start
                          </Button>
                        )}
                        {o.status === 'INPROGRESS' && (
                          <Button size="sm" onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                            Enter Results
                          </Button>
                        )}
                        {o.status === 'COMPLETED' && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/lab/orders/${o.test_id}`)}>
                            View
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
