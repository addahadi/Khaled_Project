import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Brain, FlaskConical, Activity,
  Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, Zap,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import UpgradePrompt from '@/components/auth/UpgradePrompt';

interface Patient {
  patient_id: string; name: string; age: number; gender: string;
}
interface PredictionResult {
  request_id:  string;
  risk_level:  'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_score:  number;
  confidence:  number;
  model_version: string;
}
interface OverageWarning {
  message:             string;
  predictions_overage: number;
}

const RISK_CONFIG: Record<string, { color: string; bar: string; icon: React.ElementType }> = {
  LOW:      { color: 'text-green-600',  bar: '[&>div]:bg-green-500',  icon: CheckCircle2 },
  MODERATE: { color: 'text-yellow-600', bar: '[&>div]:bg-yellow-500', icon: AlertTriangle },
  HIGH:     { color: 'text-orange-600', bar: '[&>div]:bg-orange-500', icon: AlertTriangle },
  CRITICAL: { color: 'text-red-600',    bar: '[&>div]:bg-red-500',    icon: AlertTriangle },
};

const MODEL_VERSIONS = ['v2.3.1', 'v2.2.0', 'v2.1.5'];

export default function NewPrediction() {
  const [searchParams]   = useSearchParams();
  const navigate          = useNavigate();
  const { toast }         = useToast();
  const { isLoading: patientsLoading, startLoading, stopLoading } = useDelayedLoading();

  const [patients,      setPatients]      = useState<Patient[]>([]);
  const [selectedId,    setSelectedId]    = useState(searchParams.get('patient_id') ?? '');
  const [modelVersion,  setModelVersion]  = useState('v2.3.1');
  const [submitting,    setSubmitting]    = useState(false);
  const [result,        setResult]        = useState<PredictionResult | null>(null);
  const [overageWarn,   setOverageWarn]   = useState<OverageWarning | null>(null);
  const [showUpgrade,   setShowUpgrade]   = useState(false);

  // Load patients list
  useEffect(() => {
    ApiManager.execute({
      queryKey: ['doctor', 'patients'],
      endpoint:  '/doctor/patients',
      onStart:   startLoading,
      onSuccess: (d) => setPatients((d as { patients: Patient[] }).patients),
      onFinal:   stopLoading,
    });
  }, []);

  const selectedPatient = patients.find(p => p.patient_id === selectedId);

  const handleSubmit = () => {
    if (!selectedId) {
      toast({ title: 'Select a patient first', variant: 'destructive' });
      return;
    }

    ApiManager.executeMutation({
      mutationFn: () =>
        apiClient.post('/doctor/predictions', {
          patient_id:    selectedId,
          model_version: modelVersion,
        }),
      onStart: () => { setSubmitting(true); setResult(null); setOverageWarn(null); },
      onSuccess: (data) => {
        const res = data as {
          predictionRequest: PredictionResult;
          overage_warning?:  OverageWarning;
        };
        setResult(res.predictionRequest);
        // Image 1: show overage badge if isOverage was true on backend
        if (res.overage_warning) setOverageWarn(res.overage_warning);
      },
      onError: ({ message }) => {
        // Image 1: 402 trial limit → show upgrade prompt
        if (message.toLowerCase().includes('trial') || message.toLowerCase().includes('limit')) {
          setShowUpgrade(true);
        } else {
          toast({ title: 'Prediction failed', description: message, variant: 'destructive' });
        }
      },
      onFinal: () => setSubmitting(false),
    });
  };

  const riskCfg = result ? RISK_CONFIG[result.risk_level] : null;
  const RiskIcon = riskCfg?.icon ?? Brain;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon"
          onClick={() => navigate(selectedPatient ? `/doctor/patients/${selectedId}` : '/doctor/predictions')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New AI Prediction</h1>
          <p className="text-muted-foreground text-sm">
            Image 2 — runs Random Forest / XGBoost / NN on clinical + lab data
          </p>
        </div>
      </div>

      {/* Config card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" /> Prediction Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Patient selector */}
          <div className="space-y-1.5">
            <Label>Patient</Label>
            {patientsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : patients.length === 0 ? (
              <div className="rounded-md border p-4 text-center text-sm text-muted-foreground bg-muted/20">
                No patients registered yet. <br/>
                <Button variant="link" className="p-0 h-auto font-medium" onClick={() => navigate('/doctor/patients')}>
                  Register a patient first
                </Button>
              </div>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient…" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.patient_id} value={p.patient_id}>
                      {p.name} — {p.age} yrs, {p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Model version */}
          <div className="space-y-1.5">
            <Label>Model Version</Label>
            <Select value={modelVersion} onValueChange={setModelVersion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_VERSIONS.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The backend fetches the latest clinical data and lab results for the selected patient automatically.
            </p>
          </div>

          {/* What the AI will use */}
          {selectedPatient && (
            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Data used for prediction
              </p>
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span>Latest clinical record (vitals + symptoms)</span>
              </div>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-teal-500" />
                <span>All completed lab test results</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-indigo-500" />
                <span>Model: {modelVersion}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full gap-2" size="lg"
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running AI Pipeline…</>
            ) : (
              <><Brain className="h-4 w-4" /> Run Prediction</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Result card (Image 2 → show risk score preview) ─────────────────── */}
      {result && riskCfg && (
        <Card className={`border-2 ${
          result.risk_level === 'CRITICAL' ? 'border-red-300 bg-red-50 dark:bg-red-950/10'
          : result.risk_level === 'HIGH'   ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/10'
          : result.risk_level === 'MODERATE'? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/10'
          : 'border-green-300 bg-green-50 dark:bg-green-950/10'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <RiskIcon className={`h-5 w-5 ${riskCfg.color}`} />
                Prediction Result
              </CardTitle>
              {/* Image 1: overage badge */}
              {overageWarn && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1 text-xs">
                  <Zap className="h-3 w-3" />
                  Overage #{overageWarn.predictions_overage}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Risk level + score */}
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                <span className={`text-3xl font-extrabold ${riskCfg.color}`}>
                  {result.risk_level}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="font-semibold">{Math.round(result.risk_score * 100)}%</span>
                </div>
                <Progress value={result.risk_score * 100} className={riskCfg.bar} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Confidence: {Math.round(result.confidence * 100)}%</span>
                  <span>Model: {result.model_version}</span>
                </div>
              </div>
            </div>

            {/* Image 1: overage notice message */}
            {overageWarn && (
              <div className="rounded-lg bg-orange-100 dark:bg-orange-950/20 p-3 text-sm text-orange-800 dark:text-orange-300 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{overageWarn.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline" className="gap-2 flex-1"
                onClick={() => navigate(`/doctor/predictions/${result.request_id}`)}
              >
                <TrendingUp className="h-4 w-4" /> View Full Report + XAI
              </Button>
              <Button
                className="gap-2 flex-1"
                onClick={() => {
                  setResult(null);
                  setOverageWarn(null);
                }}
              >
                <Brain className="h-4 w-4" /> New Prediction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image 1: trial upgrade prompt */}
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        limitType="prediction"
      />
    </div>
  );
}
