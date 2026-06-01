import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Brain, FlaskConical, AlertTriangle, Users } from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';

interface ReportData {
  staffCounts: { doctors: string; lab_techs: string; managers: string; total: string };
  labStats: { total_tests: string; pending: string; completed: string; critical_results: string };
  predStats: { total_predictions: string; critical: string; high: string; moderate: string; low: string };
  usageStats: { prediction_used: number; prediction_overage: number; prediction_limit: number | null } | null;
}

function StatCard({ title, value, icon: Icon, color }: {
  title: string; value?: string | number | null; icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value ?? '—'}</div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [reports, setReports] = useState<ReportData | null>(null);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['manager', 'reports'],
      endpoint: '/manager/reports',
      onStart: startLoading,
      onSuccess: (data: unknown) => setReports((data as { reports: ReportData }).reports),
      onFinal: stopLoading,
    });
  }, []);

  const riskLevels = reports
    ? [
        { label: 'Critical', val: Number(reports.predStats.critical), color: '#ef4444' },
        { label: 'High',     val: Number(reports.predStats.high),     color: '#f97316' },
        { label: 'Moderate', val: Number(reports.predStats.moderate), color: '#eab308' },
        { label: 'Low',      val: Number(reports.predStats.low),      color: '#22c55e' },
      ]
    : [];

  const total = riskLevels.reduce((s, r) => s + r.val, 0) || 1;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Reports & Analytics</h1>
      <p className="text-muted-foreground -mt-4">Last 30 days of activity</p>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          {/* Staff */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Staff</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Active Staff" value={reports?.staffCounts.total}    icon={Users}       color="text-primary" />
              <StatCard title="Doctors"             value={reports?.staffCounts.doctors}  icon={Users}       color="text-blue-500" />
              <StatCard title="Lab Technicians"     value={reports?.staffCounts.lab_techs} icon={FlaskConical} color="text-teal-500" />
              <StatCard title="Managers"            value={reports?.staffCounts.managers} icon={Users}       color="text-violet-500" />
            </div>
          </section>

          {/* Lab activity */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lab Activity</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Tests"       value={reports?.labStats.total_tests}       icon={FlaskConical}  color="text-primary" />
              <StatCard title="Pending Tests"     value={reports?.labStats.pending}           icon={AlertTriangle} color="text-yellow-500" />
              <StatCard title="Completed Tests"   value={reports?.labStats.completed}         icon={FlaskConical}  color="text-green-500" />
              <StatCard title="Critical Results"  value={reports?.labStats.critical_results}  icon={AlertTriangle} color="text-destructive" />
            </div>
          </section>

          {/* Predictions */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">AI Predictions</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard title="Total Predictions" value={reports?.predStats.total_predictions} icon={Brain} color="text-indigo-500" />
                <StatCard title="Critical"           value={reports?.predStats.critical}          icon={AlertTriangle} color="text-destructive" />
                <StatCard title="High Risk"          value={reports?.predStats.high}              icon={AlertTriangle} color="text-orange-500" />
                <StatCard title="Low Risk"           value={reports?.predStats.low}               icon={Brain}         color="text-green-500" />
              </div>

              {/* Visual risk breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {riskLevels.map(({ label, val, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: color }} />
                          {label}
                        </span>
                        <span className="font-medium">
                          {val} <span className="text-muted-foreground">({Math.round((val / total) * 100)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${(val / total) * 100}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Usage */}
          {reports?.usageStats && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Subscription Usage (Current Cycle)</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Predictions Used</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reports.usageStats.prediction_used}</div>
                    {reports.usageStats.prediction_limit && (
                      <p className="text-xs text-muted-foreground mt-1">of {reports.usageStats.prediction_limit} allowed</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overage</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${reports.usageStats.prediction_overage > 0 ? 'text-destructive' : ''}`}>
                      {reports.usageStats.prediction_overage}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">predictions over limit</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Remaining</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {reports.usageStats.prediction_limit
                        ? Math.max(0, reports.usageStats.prediction_limit - reports.usageStats.prediction_used)
                        : '∞'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">predictions remaining</p>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
