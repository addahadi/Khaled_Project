import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Brain, FlaskConical, AlertTriangle,
  Stethoscope, RefreshCw, Download,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';

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

const RISK_COLORS = {
  critical: '#c0272d',
  high:     '#e07020',
  moderate: '#faaf3a',
  low:      '#00a89c',
};

export default function Reports() {
  const { t } = useTranslation('manager');
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [reports, setReports]   = useState<ReportData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = () => {
    ApiManager.execute({
      queryKey: ['manager', 'reports'],
      endpoint:  '/manager/reports',
      onStart:   startLoading,
      onSuccess: (d) => {
        setReports((d as { reports: ReportData }).reports);
        setLastUpdated(new Date());
      },
      onFinal: stopLoading,
    });
  };

  useEffect(() => { load(); }, []);

  // Build chart data — labels come from translations, colors/values are data
  const riskPieData = reports ? [
    { name: t('reports.chartLabels.critical'), value: Number(reports.predStats.critical), color: RISK_COLORS.critical },
    { name: t('reports.chartLabels.high'),     value: Number(reports.predStats.high),     color: RISK_COLORS.high     },
    { name: t('reports.chartLabels.moderate'), value: Number(reports.predStats.moderate), color: RISK_COLORS.moderate },
    { name: t('reports.chartLabels.low'),      value: Number(reports.predStats.low),      color: RISK_COLORS.low      },
  ].filter(d => d.value > 0) : [];

  const labBarData = reports ? [
    { label: t('reports.chartLabels.total'),     value: Number(reports.labStats.total_tests),     fill: '#0d72b9' },
    { label: t('reports.chartLabels.completed'), value: Number(reports.labStats.completed),        fill: '#00a89c' },
    { label: t('reports.chartLabels.pending'),   value: Number(reports.labStats.pending),          fill: '#faaf3a' },
    { label: t('reports.chartLabels.critical'),  value: Number(reports.labStats.critical_results), fill: '#c0272d' },
  ] : [];

  const staffBarData = reports ? [
    { label: t('reports.chartLabels.doctors'),  value: Number(reports.staffCounts.doctors),  fill: '#0d72b9' },
    { label: t('reports.chartLabels.labTechs'), value: Number(reports.staffCounts.lab_techs), fill: '#00a89c' },
    { label: t('reports.chartLabels.managers'), value: Number(reports.staffCounts.managers), fill: '#2e368f' },
  ] : [];

  const exportCSV = () => {
    if (!reports) return;
    const rows = [
      ['Category', 'Metric', 'Value'],
      ['Staff', 'Total', reports.staffCounts.total],
      ['Staff', 'Doctors', reports.staffCounts.doctors],
      ['Staff', 'Lab Techs', reports.staffCounts.lab_techs],
      ['Predictions', 'Total', reports.predStats.total_predictions],
      ['Predictions', 'Critical', reports.predStats.critical],
      ['Predictions', 'High', reports.predStats.high],
      ['Predictions', 'Moderate', reports.predStats.moderate],
      ['Predictions', 'Low', reports.predStats.low],
      ['Lab Tests', 'Total', reports.labStats.total_tests],
      ['Lab Tests', 'Completed', reports.labStats.completed],
      ['Lab Tests', 'Pending', reports.labStats.pending],
      ['Lab Tests', 'Critical Results', reports.labStats.critical_results],
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `diaginfect_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const KPIS = [
    { labelKey: 'reports.totalStaff',      value: reports?.staffCounts.total,           icon: Users,        bg: 'bg-primary/10',   color: 'text-primary'    },
    { labelKey: 'reports.aiPredictions',   value: reports?.predStats.total_predictions, icon: Brain,        bg: 'bg-[#2e368f]/10', color: 'text-[#2e368f]'  },
    { labelKey: 'reports.labTests',        value: reports?.labStats.total_tests,        icon: FlaskConical, bg: 'bg-[#00a89c]/10', color: 'text-[#007a71]'  },
    { labelKey: 'reports.criticalResults', value: reports?.labStats.critical_results,   icon: AlertTriangle,bg: 'bg-[#c0272d]/10', color: 'text-[#c0272d]',
      highlight: Number(reports?.labStats.critical_results) > 0 },
  ];

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {t('reports.analyticsTitle')}
          </h1>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('reports.lastUpdated', { time: lastUpdated.toLocaleTimeString() })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('reports.refresh')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} disabled={!reports}>
            <Download className="h-3.5 w-3.5" />
            {t('reports.exportCsv')}
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map(({ labelKey, value, icon: Icon, bg, color, highlight }) => (
          <Card key={labelKey} className={highlight ? 'border-[#c0272d]/25' : ''}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(labelKey)}
                </span>
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              {isLoading
                ? <Skeleton className="h-8 w-16 rounded-lg" />
                : <div className="text-3xl font-semibold text-foreground">{value ?? '—'}</div>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1: Risk distribution pie + Staff bar */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Risk distribution pie */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              {t('reports.riskDistribution')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
            ) : riskPieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                {t('reports.noPredictionData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={riskPieData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value"
                  >
                    {riskPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [val, t('reports.tooltipLabels.predictions')]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{ fontSize: '11px', color: '#64748b' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Staff breakdown bar */}
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              {t('reports.staffBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isLoading ? (
              <div className="h-48 flex items-end gap-4 px-4">
                {[80, 55, 30].map((h, i) => <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />)}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={staffBarData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => [val, t('reports.tooltipLabels.members')]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {staffBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Lab tests bar */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            {t('reports.labTestOverview')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isLoading ? (
            <div className="h-48 flex items-end gap-4 px-4">
              {[90, 70, 40, 20].map((h, i) => <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />)}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={labBarData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [val, t('reports.tooltipLabels.tests')]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {labBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
