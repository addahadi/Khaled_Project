import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, FlaskConical, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { timeAgo } from '@/lib/formatDate';

interface LabStats {
  pending_count: string;
  inprogress_count: string;
  completed_today: string;
  total_completed: string;
}

interface LabOrder {
  test_id: string;
  test_type: string;
  status: string;
  patient_name: string;
  ordered_by_name: string;
  ordered_at: string;
}

export default function LabDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading: statsLoading, startLoading: startStats, stopLoading: stopStats } = useDelayedLoading();
  const { isLoading: ordersLoading, startLoading: startOrders, stopLoading: stopOrders } = useDelayedLoading();

  const [stats, setStats] = useState<LabStats | null>(null);
  const [pendingOrders, setPendingOrders] = useState<LabOrder[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['lab', 'stats'],
      endpoint: '/lab/stats',
      onStart: startStats,
      onSuccess: (data: unknown) => setStats((data as { stats: LabStats }).stats),
      onFinal: stopStats,
    });

    ApiManager.execute({
      queryKey: ['lab', 'orders'],
      endpoint: '/lab/orders',
      onStart: startOrders,
      onSuccess: (data: unknown) => {
        const all = (data as { orders: LabOrder[] }).orders;
        setPendingOrders(all.filter(o => o.status === 'PENDING' || o.status === 'INPROGRESS').slice(0, 8));
      },
      onFinal: stopOrders,
    });
  }, [startStats, stopStats, startOrders, stopOrders]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING:    'bg-yellow-100 text-yellow-800 border-yellow-200',
      INPROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
      COMPLETED:  'bg-green-100 text-green-800 border-green-200',
    };
    return <Badge className={`${map[status] ?? ''} text-xs`}>{status}</Badge>;
  };

  const startOrder = (testId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/lab/orders/${testId}/start`),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart: () => setStartingId(testId),
      onSuccess: () => {
        setPendingOrders(prev =>
          prev.map(o => o.test_id === testId ? { ...o, status: 'INPROGRESS' } : o)
        );
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setStartingId(null),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.username}</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending Orders',   val: stats?.pending_count,    icon: Clock,         color: 'text-yellow-500' },
          { label: 'In Progress',       val: stats?.inprogress_count, icon: FlaskConical,   color: 'text-blue-500' },
          { label: 'Completed Today',   val: stats?.completed_today,  icon: CheckCircle2,  color: 'text-green-500' },
          { label: 'Total Completed',   val: stats?.total_completed,  icon: ClipboardList, color: 'text-primary' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              {statsLoading
                ? <Skeleton className="h-8 w-16" />
                : <div className="text-2xl font-bold">{val ?? '—'}</div>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending Orders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pending & In-Progress Orders</CardTitle>
          <Button size="sm" onClick={() => navigate('/lab/orders')}>View All</Button>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8 mb-2 text-green-500" />
              <p>All caught up — no pending orders!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Ordered By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waiting</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOrders.map((order) => (
                  <TableRow key={order.test_id}>
                    <TableCell className="font-medium">{order.patient_name}</TableCell>
                    <TableCell>{order.test_type}</TableCell>
                    <TableCell className="text-muted-foreground">{order.ordered_by_name}</TableCell>
                    <TableCell>{statusBadge(order.status)}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${
                        Date.now() - new Date(order.ordered_at).getTime() > 86_400_000
                          ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {timeAgo(order.ordered_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.status === 'PENDING' ? (
                        <Button size="sm" variant="outline" onClick={() => startOrder(order.test_id)} disabled={startingId === order.test_id}>
                          {startingId === order.test_id && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Start
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => navigate(`/lab/orders/${order.test_id}`)}>
                          Enter Results
                        </Button>
                      )}
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
