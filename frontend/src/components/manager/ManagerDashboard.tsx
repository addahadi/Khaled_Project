import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
 Users, FlaskConical, Brain, AlertTriangle,
 TrendingUp, CreditCard, Building2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';

interface ReportData {
 staffCounts: {
 doctors: string; lab_techs: string; managers: string; total: string;
 };
 labStats: {
 total_tests: string; pending: string; completed: string; critical_results: string;
 };
 predStats: {
 total_predictions: string; critical: string; high: string; moderate: string; low: string;
 };
 usageStats: {
 prediction_used: number; prediction_overage: number; prediction_limit: number | null;
 } | null;
}

export default function ManagerDashboard() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const { isLoading, startLoading, stopLoading } = useDelayedLoading();
 const [reports, setReports] = useState<ReportData | null>(null);

 useEffect(() => {
 const loadReports = () => {
 ApiManager.execute({
 queryKey: ['manager', 'reports'],
 endpoint: '/manager/reports',
 onStart: startLoading,
 onSuccess: (data: unknown) => setReports((data as { reports: ReportData }).reports),
 onFinal: stopLoading,
 });
 };
 loadReports();
 }, [startLoading, stopLoading]);

 const usagePct = reports?.usageStats?.prediction_limit
 ? Math.min(
 (reports.usageStats.prediction_used / reports.usageStats.prediction_limit) * 100,
 100
 )
 : null;

 const Stat = ({
 label, value, icon: Icon, color, sub,
 }: {
 label: string; value?: string | number | null; icon: React.ElementType;
 color: string; sub?: string;
 }) => (
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
 <Icon className={`h-4 w-4 ${color}`} />
 </CardHeader>
 <CardContent>
 {isLoading
 ? <Skeleton className="h-8 w-16" />
 : <>
 <div className="text-[28px] font-light">{value ?? '—'}</div>
 {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
 </>
 }
 </CardContent>
 </Card>
 );

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[28px] font-light">Hospital Dashboard</h1>
 <p className="text-muted-foreground">Welcome back, {user?.username}</p>
 </div>
 <Button variant="outline" onClick={() => navigate('/manager/reports')}>
 <TrendingUp className="mr-2 h-4 w-4" /> Full Reports
 </Button>
 </div>

 {/* Staff stats */}
 <div>
 <h2 className="text-sm font-normal text-muted-foreground uppercase tracking-wide mb-3">Staff</h2>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Stat label="Total Staff"  value={reports?.staffCounts.total}  icon={Users}  color="text-primary"  sub="Active members" />
 <Stat label="Doctors"  value={reports?.staffCounts.doctors}  icon={Building2}  color="text-primary"  sub="Active doctors" />
 <Stat label="Lab Technicians" value={reports?.staffCounts.lab_techs} icon={FlaskConical} color="text-primary" sub="Lab staff" />
 <Stat label="Managers"  value={reports?.staffCounts.managers}  icon={Users}  color="text-violet-500"  sub="Management" />
 </div>
 </div>

 {/* Lab & Prediction stats */}
 <div>
 <h2 className="text-sm font-normal text-muted-foreground uppercase tracking-wide mb-3">Activity (Last 30 Days)</h2>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Stat label="Total Lab Tests"  value={reports?.labStats.total_tests}  icon={FlaskConical}  color="text-primary"  />
 <Stat label="Pending Tests"  value={reports?.labStats.pending}  icon={AlertTriangle}  color="text-[#a2680a]" />
 <Stat label="Critical Results"  value={reports?.labStats.critical_results}  icon={AlertTriangle}  color="text-destructive" />
 <Stat label="AI Predictions"  value={reports?.predStats.total_predictions} icon={Brain}  color="text-primary" />
 </div>
 </div>

 {/* Subscription usage */}
 <div className="grid gap-4 lg:grid-cols-2">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-base">Subscription Usage</CardTitle>
 <Button size="sm" variant="outline" onClick={() => navigate('/manager/subscription')}>
 <CreditCard className="mr-2 h-4 w-4" /> Manage
 </Button>
 </CardHeader>
 <CardContent className="space-y-3">
 {isLoading ? (
 <Skeleton className="h-16 w-full" />
 ) : reports?.usageStats ? (
 <>
 <div className="flex justify-between text-sm">
 <span>AI Predictions Used</span>
 <span className="font-medium">
 {reports.usageStats.prediction_used}
 {reports.usageStats.prediction_limit && ` / ${reports.usageStats.prediction_limit}`}
 </span>
 </div>
 {usagePct !== null && (
 <Progress
 value={usagePct}
 className={usagePct > 85 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}
 />
 )}
 {reports.usageStats.prediction_overage > 0 && (
 <Badge variant="destructive" className="text-xs">
 {reports.usageStats.prediction_overage} overage predictions this cycle
 </Badge>
 )}
 </>
 ) : (
 <div className="text-sm text-muted-foreground">No active subscription found.</div>
 )}
 </CardContent>
 </Card>

 {/* Risk distribution */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Risk Level Distribution</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {isLoading ? (
 <Skeleton className="h-20 w-full" />
 ) : reports?.predStats ? (
 [
 { label: 'Critical', val: reports.predStats.critical, color: 'bg-red-500' },
 { label: 'High',  val: reports.predStats.high,  color: 'bg-orange-500' },
 { label: 'Moderate', val: reports.predStats.moderate, color: 'bg-yellow-500' },
 { label: 'Low',  val: reports.predStats.low,  color: 'bg-green-500' },
 ].map(({ label, val, color }) => {
 const total = Number(reports.predStats.total_predictions) || 1;
 const pct = Math.round((Number(val) / total) * 100);
 return (
 <div key={label} className="flex items-center gap-3">
 <span className="w-16 text-sm">{label}</span>
 <div className="flex-1 bg-muted rounded-full h-2" role="presentation">
 <div
 className={`${color} h-2 rounded-full`}
 style={{ width: `${pct}%` }}
 role="progressbar"
 aria-valuenow={Number(val)}
 aria-valuemin={0}
 aria-valuemax={total}
 aria-label={`${label} risk: ${val} of ${total} predictions (${pct}%)`}
 />
 </div>
 <span className="text-sm font-medium w-8 text-right">{val}</span>
 </div>
 );
 })
 ) : (
 <div className="text-sm text-muted-foreground">No prediction data available.</div>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 );
}
