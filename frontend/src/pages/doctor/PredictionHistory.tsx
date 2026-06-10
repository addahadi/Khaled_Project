import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, Search, CheckCircle2, ChevronRight,
  TrendingUp, Calendar, User, Building2,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { getRiskConfig, RISK_CONFIG } from '@/lib/riskConfig';
import type { RiskLevel } from '@/lib/riskConfig';

interface Prediction {
  request_id:    string; patient_id: string; patient_name: string;
  model_version: string; status: string; created_at: string;
  risk_score:    number | null; risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  confidence:    number | null;
}
interface FeatureExplanation {
  feature_name: string; contribution: number;
  direction: 'POSITIVE' | 'NEGATIVE'; rank: number;
}
interface PredictionDetail extends Prediction {
  feature_explanations: FeatureExplanation[];
  raw_payload: Record<string, unknown>;
}

const FEATURE_LABELS: Record<string, string> = {
  wbc_count: 'White Blood Cell Count', rbc_count: 'Red Blood Cell Count',
  hemoglobin: 'Hemoglobin', hematocrit: 'Hematocrit', platelet_count: 'Platelet Count',
  crp_level: 'C-Reactive Protein (CRP)', esr: 'Erythrocyte Sedimentation Rate',
  procalcitonin: 'Procalcitonin', temperature: 'Body Temperature', heart_rate: 'Heart Rate',
  spo2: 'Blood Oxygen (SpO₂)', blood_pressure_systolic: 'Systolic Blood Pressure',
  blood_pressure_diastolic: 'Diastolic Blood Pressure', neutrophil_pct: 'Neutrophil %',
  lymphocyte_pct: 'Lymphocyte %', albumin: 'Albumin', creatinine: 'Creatinine',
  bun: 'Blood Urea Nitrogen', alt: 'ALT (Liver Enzyme)', ast: 'AST (Liver Enzyme)',
  bilirubin: 'Bilirubin', glucose: 'Blood Glucose', sodium: 'Sodium', potassium: 'Potassium',
  age: 'Patient Age', gender: 'Patient Gender', symptom_count: 'Number of Symptoms',
  fever_present: 'Fever Present', days_since_onset: 'Days Since Symptom Onset',
};

function featureLabel(raw: string): string {
  return FEATURE_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const RISK_SUMMARY_STYLES = {
  CRITICAL: { text: 'text-[#c0272d]', bg: 'bg-[#c0272d]/8', border: 'border-[#c0272d]/20' },
  HIGH:     { text: 'text-[#e07020]', bg: 'bg-[#e07020]/8', border: 'border-[#e07020]/20' },
  MODERATE: { text: 'text-[#a2680a]', bg: 'bg-[#faaf3a]/10', border: 'border-[#faaf3a]/25' },
  LOW:      { text: 'text-[#007a71]', bg: 'bg-[#00a89c]/8',  border: 'border-[#00a89c]/20' },
} as const;

export default function PredictionHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const { isLoading: detailLoading, startLoading: startDetail, stopLoading: stopDetail } = useDelayedLoading();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [search,       setSearch]      = useState('');
  const [riskFilter,   setRiskFilter]  = useState('ALL');
  const [dateFilter,   setDateFilter]  = useState('ALL');
  const [detail,       setDetail]      = useState<PredictionDetail | null>(null);
  const [sheetOpen,    setSheetOpen]   = useState(false);
  const [scope, setScope] = useState<'mine' | 'org'>(
    () => (localStorage.getItem('diaginfect_prediction_scope') as 'mine' | 'org' | null) ?? 'org'
  );

  const handleScopeChange = (val: 'mine' | 'org') => {
    setScope(val);
    localStorage.setItem('diaginfect_prediction_scope', val);
  };

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['doctor', 'predictions', scope],
      endpoint: `/doctor/predictions?scope=${scope}`,
      onStart:   startLoading,
      onSuccess: (d) => setPredictions((d as { predictions: Prediction[] }).predictions),
      onFinal:   stopLoading,
    });
  }, [scope, startLoading, stopLoading]);

  useEffect(() => {
    const targetId = (location.state as { openPrediction?: string })?.openPrediction;
    if (targetId && predictions.length > 0) {
      openDetail(targetId);
      window.history.replaceState({}, '');
    }
  }, [predictions, location.state]);

  const openDetail = (predictionId: string) => {
    setSheetOpen(true);
    ApiManager.execute({
      queryKey: ['doctor', 'prediction', predictionId],
      endpoint: `/doctor/predictions/${predictionId}`,
      onStart:   startDetail,
      onSuccess: (d) => setDetail((d as { prediction: PredictionDetail }).prediction),
      onFinal:   stopDetail,
    });
  };

  const filtered = predictions.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.patient_name.toLowerCase().includes(q);
    const matchRisk   = riskFilter === 'ALL' || p.risk_level === riskFilter;
    let matchDate = true;
    if (dateFilter !== 'ALL') {
      const diffDays = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
      if (dateFilter === 'TODAY')   matchDate = diffDays <= 1;
      if (dateFilter === '7DAYS')   matchDate = diffDays <= 7;
      if (dateFilter === '30DAYS')  matchDate = diffDays <= 30;
    }
    return matchSearch && matchRisk && matchDate;
  });

  const counts: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
  predictions.forEach(p => { if (p.risk_level) counts[p.risk_level]++; });

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Prediction History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{predictions.length} total predictions</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/doctor/predictions/new')}>
          <Brain className="h-4 w-4" /> New Prediction
        </Button>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-[var(--radius)] w-fit">
        {(['mine', 'org'] as const).map(s => (
          <button
            key={s}
            onClick={() => handleScopeChange(s)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              scope === s
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'mine' ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
            {s === 'mine' ? 'My Predictions' : 'All Predictions'}
          </button>
        ))}
      </div>

      {/* Summary cards — clickable risk filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(RISK_SUMMARY_STYLES) as RiskLevel[]).map(level => {
          const style = RISK_SUMMARY_STYLES[level];
          const cfg   = RISK_CONFIG[level];
          return (
            <button
              key={level}
              onClick={() => setRiskFilter(riskFilter === level ? 'ALL' : level)}
              className={`p-4 rounded-[var(--radius)] border text-left transition-all ${style.bg} ${style.border} ${
                riskFilter === level ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:shadow-sm'
              }`}
            >
              <p className={`text-3xl font-semibold ${style.text}`}>{counts[level]}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{cfg.label} Risk</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by patient…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[160px] bg-card">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Time</SelectItem>
            <SelectItem value="TODAY">Today</SelectItem>
            <SelectItem value="7DAYS">Last 7 Days</SelectItem>
            <SelectItem value="30DAYS">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prediction list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />)}
        </div>
      ) : filtered.length === 0 && predictions.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No predictions match your search.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { setSearch(''); setRiskFilter('ALL'); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No predictions yet.</p>
            <Button size="sm" className="mt-4 gap-2" onClick={() => navigate('/doctor/predictions/new')}>
              <Brain className="h-4 w-4" /> Run First Prediction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const cfg = getRiskConfig(p.risk_level);
            const RiskIcon = cfg?.icon;
            return (
              <Card
                key={p.request_id}
                className="cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-150"
                onClick={() => openDetail(p.request_id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Risk icon box */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    p.risk_level === 'CRITICAL' ? 'bg-[#c0272d]/10'
                    : p.risk_level === 'HIGH'   ? 'bg-[#e07020]/10'
                    : p.risk_level === 'MODERATE'? 'bg-[#faaf3a]/10'
                    : p.risk_level === 'LOW'     ? 'bg-[#00a89c]/10'
                    : 'bg-muted'
                  }`}>
                    {cfg && RiskIcon
                      ? <RiskIcon className={`h-5 w-5 ${cfg.color}`} />
                      : <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{p.patient_name}</span>
                      {cfg && RiskIcon && (
                        <Badge className={`text-xs gap-1 ${cfg.badgeClass}`}>
                          <RiskIcon className="h-3 w-3" /> {cfg.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {p.risk_score !== null && (
                        <span className="text-xs text-muted-foreground">
                          Score: <span className="font-medium text-foreground">{Math.round(p.risk_score * 100)}%</span>
                        </span>
                      )}
                      {p.confidence !== null && (
                        <span className="text-xs text-muted-foreground">
                          Confidence: <span className="font-medium text-foreground">{Math.round(p.confidence * 100)}%</span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* XAI Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" /> Prediction Detail + XAI
            </SheetTitle>
          </SheetHeader>

          {detailLoading || !detail ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
              <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* Summary */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  {[
                    { label: 'Patient', value: detail.patient_name },
                    { label: 'Model',   value: detail.model_version },
                    { label: 'Date',    value: formatDateTime(detail.created_at) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium">{value}</span>
                    </div>
                  ))}

                  {detail.risk_level && (() => {
                    const cfg = getRiskConfig(detail.risk_level);
                    if (!cfg) return null;
                    const RiskIcon = cfg.icon;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Risk Level</span>
                          <Badge className={`gap-1 ${cfg.badgeClass}`}>
                            <RiskIcon className="h-3 w-3" /> {cfg.label}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">Risk Score</span>
                            <span className="font-medium">
                              {detail.risk_score !== null ? `${Math.round(detail.risk_score * 100)}%` : '—'}
                            </span>
                          </div>
                          <Progress
                            value={(detail.risk_score ?? 0) * 100}
                            className={cfg.barClass}
                          />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Confidence</span>
                          <span className="font-medium">
                            {detail.confidence !== null ? `${Math.round(detail.confidence * 100)}%` : '—'}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* XAI feature explanations */}
              {detail.feature_explanations?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" /> Feature Explanations (XAI)
                  </h3>
                  <div className="space-y-2.5">
                    {detail.feature_explanations.slice(0, 10).map((fe, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold shrink-0 ${
                          fe.direction === 'POSITIVE'
                            ? 'bg-[#c0272d]/10 text-[#c0272d]'
                            : 'bg-[#00a89c]/10 text-[#00a89c]'
                        }`}>
                          {fe.direction === 'POSITIVE' ? '↑' : '↓'}
                        </div>
                        <span className="flex-1 text-xs text-foreground truncate">{featureLabel(fe.feature_name)}</span>
                        <div
                          className="w-20 bg-muted rounded-full h-2"
                          role="progressbar"
                          aria-valuenow={Math.abs(fe.contribution) * 100}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={`h-2 rounded-full ${
                              fe.direction === 'POSITIVE' ? 'bg-[#c0272d]/60' : 'bg-[#00a89c]/60'
                            }`}
                            style={{ width: `${Math.min(Math.abs(fe.contribution) * 400, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-9 text-right shrink-0">
                          {(fe.contribution * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    ↑ increases infection risk · ↓ decreases infection risk
                  </p>
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={() => { setSheetOpen(false); navigate('/doctor/predictions/new'); }}
              >
                <Brain className="h-4 w-4" /> Run New Prediction
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
