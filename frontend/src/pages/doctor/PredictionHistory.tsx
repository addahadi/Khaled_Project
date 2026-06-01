import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Brain, Search, AlertTriangle, CheckCircle2,
  TrendingUp, ChevronRight, Zap,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';

interface Prediction {
  request_id:   string;
  patient_id:   string;
  patient_name: string;
  model_version: string;
  status:       string;
  created_at:   string;
  risk_score:   number | null;
  risk_level:   'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  confidence:   number | null;
}
interface FeatureExplanation {
  feature_name: string;
  contribution: number;
  direction:    'POSITIVE' | 'NEGATIVE';
  rank:         number;
}
interface PredictionDetail extends Prediction {
  feature_explanations: FeatureExplanation[];
  raw_payload:          Record<string, unknown>;
}

const RISK_STYLE: Record<string, string> = {
  LOW:      'bg-green-100  text-green-800  border-green-200',
  MODERATE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH:     'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100    text-red-800    border-red-200',
};
const RISK_BAR: Record<string, string> = {
  LOW:      '[&>div]:bg-green-500',
  MODERATE: '[&>div]:bg-yellow-500',
  HIGH:     '[&>div]:bg-orange-500',
  CRITICAL: '[&>div]:bg-red-500',
};

export default function PredictionHistory() {
  const navigate = useNavigate();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const { isLoading: detailLoading, startLoading: startDetail, stopLoading: stopDetail } = useDelayedLoading();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [search,      setSearch]      = useState('');
  const [riskFilter,  setRiskFilter]  = useState('ALL');
  const [detail,      setDetail]      = useState<PredictionDetail | null>(null);
  const [sheetOpen,   setSheetOpen]   = useState(false);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['doctor', 'predictions'],
      endpoint:  '/doctor/predictions',
      onStart:   startLoading,
      onSuccess: (d) => setPredictions((d as { predictions: Prediction[] }).predictions),
      onFinal:   stopLoading,
    });
  }, []);

  const openDetail = (predictionId: string) => {
    setSheetOpen(true);
    ApiManager.execute({
      queryKey: ['doctor', 'prediction', predictionId],
      endpoint:  `/doctor/predictions/${predictionId}`,
      onStart:   startDetail,
      onSuccess: (d) => setDetail((d as { prediction: PredictionDetail }).prediction),
      onFinal:   stopDetail,
    });
  };

  const filtered = predictions.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.patient_name.toLowerCase().includes(q);
    const matchRisk   = riskFilter === 'ALL' || p.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  // Counts for summary
  const counts = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
  predictions.forEach(p => { if (p.risk_level) counts[p.risk_level]++; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prediction History</h1>
          <p className="text-muted-foreground text-sm">{predictions.length} total predictions</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/doctor/predictions/new')}>
          <Brain className="h-4 w-4" /> New Prediction
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { level: 'CRITICAL', color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950/10',    border: 'border-red-200' },
          { level: 'HIGH',     color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/10', border: 'border-orange-200' },
          { level: 'MODERATE', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/10', border: 'border-yellow-200' },
          { level: 'LOW',      color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/10',  border: 'border-green-200' },
        ] as const).map(({ level, color, bg, border }) => (
          <button
            key={level}
            onClick={() => setRiskFilter(riskFilter === level ? 'ALL' : level)}
            className={`rounded-xl border p-3 text-left transition-all ${bg} ${border}
              ${riskFilter === level ? 'ring-2 ring-primary' : 'hover:shadow-sm'}`}
          >
            <p className={`text-2xl font-bold ${color}`}>{counts[level]}</p>
            <p className="text-xs text-muted-foreground">{level.charAt(0) + level.slice(1).toLowerCase()} Risk</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by patient…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 && predictions.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Search className="mx-auto h-10 w-10 mb-3" />
            <p>No predictions match your search.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Brain className="mx-auto h-10 w-10 mb-3" />
            <p>No predictions yet.</p>
            <Button size="sm" className="mt-3 gap-2"
              onClick={() => navigate('/doctor/predictions/new')}>
              <Brain className="h-4 w-4" /> Run First Prediction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.request_id}
              className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              onClick={() => openDetail(p.request_id)}
            >
              <CardContent className="py-4 flex items-center gap-4">
                {/* Risk icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  p.risk_level === 'CRITICAL' ? 'bg-red-100'
                  : p.risk_level === 'HIGH'   ? 'bg-orange-100'
                  : p.risk_level === 'MODERATE'? 'bg-yellow-100' : 'bg-green-100'
                }`}>
                  {p.risk_level === 'LOW'
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <AlertTriangle className={`h-5 w-5 ${
                        p.risk_level === 'CRITICAL' ? 'text-red-600'
                        : p.risk_level === 'HIGH' ? 'text-orange-600' : 'text-yellow-600'
                      }`} />
                  }
                </div>

                {/* Patient + risk */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{p.patient_name}</span>
                    {p.risk_level && (
                      <Badge className={`text-xs ${RISK_STYLE[p.risk_level] ?? ''}`}>
                        {p.risk_level}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {p.risk_score !== null && (
                      <span className="text-sm text-muted-foreground">
                        Score: <strong>{Math.round(p.risk_score * 100)}%</strong>
                      </span>
                    )}
                    {p.confidence !== null && (
                      <span className="text-sm text-muted-foreground">
                        Confidence: <strong>{Math.round(p.confidence * 100)}%</strong>
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── XAI Detail Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> Prediction Detail + XAI
            </SheetTitle>
          </SheetHeader>

          {detailLoading || !detail ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Risk score */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Patient</span>
                  <span className="font-semibold">{detail.patient_name}</span>
                </div>
                {detail.risk_level && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Risk Level</span>
                      <Badge className={`${RISK_STYLE[detail.risk_level] ?? ''}`}>
                        {detail.risk_level}
                      </Badge>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Risk Score</span>
                        <span className="font-semibold">
                          {detail.risk_score !== null ? `${Math.round(detail.risk_score * 100)}%` : '—'}
                        </span>
                      </div>
                      <Progress
                        value={(detail.risk_score ?? 0) * 100}
                        className={RISK_BAR[detail.risk_level] ?? ''}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confidence</span>
                      <span>{detail.confidence !== null ? `${Math.round(detail.confidence * 100)}%` : '—'}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Model</span>
                  <span>{detail.model_version}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span>{new Date(detail.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Feature Explanations (XAI) */}
              {detail.feature_explanations?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Feature Explanations (XAI)
                  </h3>
                  <div className="space-y-2">
                    {detail.feature_explanations.slice(0, 10).map((fe, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                          fe.direction === 'POSITIVE'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {fe.direction === 'POSITIVE' ? '↑' : '↓'}
                        </div>
                        <span className="flex-1 text-sm truncate">{fe.feature_name}</span>
                        <div className="w-24 bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              fe.direction === 'POSITIVE' ? 'bg-red-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${Math.min(Math.abs(fe.contribution) * 400, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
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
