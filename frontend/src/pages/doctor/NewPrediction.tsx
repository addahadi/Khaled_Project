import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Brain, FlaskConical, Activity,
  Loader2, AlertTriangle, CheckCircle2,
  TrendingUp, Zap, Info, Clock, Database, XCircle, Search
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient  from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import UpgradePrompt from '@/components/auth/UpgradePrompt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { timeAgo } from '@/lib/formatDate';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  patient_id:           string;
  name:                 string;
  age:                  number;
  gender:               string;
  clinical_data_status: 'FRESH' | 'STALE' | 'NO_DATA';
}
interface ClinicalRecord {
  data_id:     string;
  recorded_at: string | null;
  created_at:  string;
  is_stale:    boolean;
  vitals:      Record<string, number | undefined>;
  symptoms:    string[];
}
interface PredictionResult {
  request_id:   string;
  risk_level:   'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_score:   number;
  confidence:   number;
  model_version: string;
}
interface DataWarning {
  type:    'NO_CLINICAL_DATA' | 'STALE_CLINICAL_DATA' | 'NO_LAB_RESULTS' | 'NO_RECENT_LAB_RESULTS';
  message: string;
}
interface OverageWarning {
  message:             string;
  predictions_overage: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<string, { color: string; bar: string; icon: React.ElementType }> = {
  LOW:      { color: 'text-[#24a148]',  bar: '[&>div]:bg-green-500',  icon: CheckCircle2  },
  MODERATE: { color: 'text-[#a2680a]',  bar: '[&>div]:bg-yellow-500', icon: AlertTriangle },
  HIGH:     { color: 'text-[#ff832b]',  bar: '[&>div]:bg-orange-500', icon: AlertTriangle },
  CRITICAL: { color: 'text-[#da1e28]',  bar: '[&>div]:bg-red-500',    icon: AlertTriangle },
};

const MODEL_VERSIONS = [
  { value: 'v2.3.1', label: 'Latest (v2.3.1)',  description: 'Recommended — best accuracy' },
  { value: 'v2.2.0', label: 'Stable (v2.2.0)',  description: 'Previous release' },
  { value: 'v2.1.5', label: 'Legacy (v2.1.5)',  description: 'For comparison only' },
];

const WARNING_META: Record<DataWarning['type'], { icon: React.ElementType; color: string; label: string }> = {
  NO_CLINICAL_DATA:      { icon: XCircle,       color: 'text-red-600',    label: 'No Clinical Data'    },
  STALE_CLINICAL_DATA:   { icon: Clock,         color: 'text-yellow-600', label: 'Stale Vitals'        },
  NO_LAB_RESULTS:        { icon: FlaskConical,  color: 'text-red-600',    label: 'No Lab Results'      },
  NO_RECENT_LAB_RESULTS: { icon: FlaskConical,  color: 'text-yellow-600', label: 'No Recent Labs'      },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewPrediction() {
  const [searchParams]  = useSearchParams();
  const location        = useLocation();
  const navigate        = useNavigate();
  const { toast }       = useToast();
  const { isLoading: patientsLoading, startLoading, stopLoading } = useDelayedLoading();

  const preselectedId = (location.state as { patientId?: string })?.patientId
    ?? searchParams.get('patient_id') ?? '';

  const [patients,       setPatients]       = useState<Patient[]>([]);
  const [selectedId,     setSelectedId]     = useState(preselectedId);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [modelVersion,   setModelVersion]   = useState('v2.3.1');
  const [submitting,     setSubmitting]     = useState(false);
  const [result,         setResult]         = useState<PredictionResult | null>(null);
  const [dataWarnings,   setDataWarnings]   = useState<DataWarning[]>([]);
  const [overageWarn,    setOverageWarn]    = useState<OverageWarning | null>(null);
  const [showUpgrade,    setShowUpgrade]    = useState(false);

  // Latest clinical record preview for the selected patient
  const [latestClinical, setLatestClinical] = useState<ClinicalRecord | null | 'loading'>('loading');

  // ── Load patients ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const endpoint = `/doctor/patients${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''}`;
    ApiManager.execute({
      queryKey: ['doctor', 'patients', debouncedSearch],
      endpoint,
      onStart:   startLoading,
      onSuccess: (d) => setPatients((d as { patients: Patient[] }).patients),
      onFinal:   stopLoading,
    });
  }, [debouncedSearch]);

  // ── Fetch latest clinical record when patient changes ─────────────────
  const fetchLatestClinical = useCallback((patientId: string) => {
    if (!patientId) { setLatestClinical(null); return; }
    setLatestClinical('loading');
    ApiManager.execute({
      queryKey: ['doctor', 'patient', patientId],
      endpoint: `/doctor/patients/${patientId}`,
      staleTime: 30_000,
      onSuccess: (d) => {
        const all = (d as { patient: { clinicalData: ClinicalRecord[] } }).patient.clinicalData;
        setLatestClinical(all.length > 0 ? all[0] : null);
      },
      onError: () => setLatestClinical(null),
    });
  }, []);

  useEffect(() => { fetchLatestClinical(selectedId); }, [selectedId, fetchLatestClinical]);

  const selectedPatient = patients.find(p => p.patient_id === selectedId);

  // ── Derive pre-run warnings from patient list data ────────────────────
  const preRunWarnings: DataWarning[] = [];
  if (selectedPatient) {
    if (selectedPatient.clinical_data_status === 'NO_DATA') {
      preRunWarnings.push({ type: 'NO_CLINICAL_DATA', message: 'No clinical data recorded for this patient. Prediction accuracy will be significantly reduced.' });
    } else if (selectedPatient.clinical_data_status === 'STALE') {
      const observedAt = latestClinical && latestClinical !== 'loading'
        ? (latestClinical.recorded_at ?? latestClinical.created_at)
        : null;
      preRunWarnings.push({
        type: 'STALE_CLINICAL_DATA',
        message: `Clinical vitals are${observedAt ? ` ${timeAgo(observedAt)} old` : ' stale'} (threshold: 72h). Consider recording fresh vitals first.`,
      });
    }
  }

  // ── Run prediction ─────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!selectedId) {
      toast({ title: 'Select a patient first', variant: 'destructive' });
      return;
    }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/doctor/predictions', { patient_id: selectedId, model_version: modelVersion }),
      invalidateKeys: [['doctor', 'predictions'], ['doctor', 'patients']],
      onStart: () => { setSubmitting(true); setResult(null); setDataWarnings([]); setOverageWarn(null); },
      onSuccess: (data) => {
        const res = data as {
          predictionRequest:   PredictionResult;
          clinical_data_stale: boolean;
          data_warnings?:      DataWarning[];
          overage_warning?:    OverageWarning;
        };
        setResult(res.predictionRequest);
        setDataWarnings(res.data_warnings ?? []);
        if (res.overage_warning) setOverageWarn(res.overage_warning);
        // Refresh patient list so clinical_data_status reflects current state
        ApiManager.execute({ queryKey: ['doctor', 'patients'], endpoint: '/doctor/patients', onSuccess: (d) => setPatients((d as { patients: Patient[] }).patients) });
      },
      onError: ({ message }) => {
        if (message.toLowerCase().includes('trial') || message.toLowerCase().includes('limit')) {
          setShowUpgrade(true);
        } else {
          toast({ title: 'Prediction failed', description: message, variant: 'destructive' });
        }
      },
      onFinal: () => setSubmitting(false),
    });
  };

  const riskCfg  = result ? RISK_CONFIG[result.risk_level] : null;
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
          <h1 className="text-[28px] font-light">New AI Prediction</h1>
          <p className="text-muted-foreground text-sm">
            Runs an ensemble AI model on the patient's latest clinical record and recent lab results.
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
          <div className="space-y-1.5 relative">
            <Label>Patient</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search patient by name..."
                value={selectedId ? (selectedPatient?.name || '') : searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedId('');
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              />
              {selectedId && (
                <XCircle 
                  className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" 
                  onClick={() => {
                    setSelectedId('');
                    setSearchTerm('');
                    setLatestClinical('loading');
                  }}
                />
              )}
            </div>
            
            {isDropdownOpen && !selectedId && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-auto">
                {patientsLoading ? (
                  <div className="p-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : patients.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-muted/20">
                    No patients found.{' '}
                    <Button variant="link" className="p-0 h-auto font-medium" onClick={() => navigate('/doctor/patients')}>
                      Register new patient
                    </Button>
                  </div>
                ) : (
                  patients.map(p => (
                    <div
                      key={p.patient_id}
                      className="p-2 px-3 hover:bg-muted cursor-pointer flex flex-col border-b last:border-b-0"
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent blur
                        setSelectedId(p.patient_id);
                        setSearchTerm('');
                        setIsDropdownOpen(false);
                      }}
                    >
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-muted-foreground text-xs mt-0.5">
                        {p.age} yrs, {p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}
                        {p.clinical_data_status === 'STALE' && <span className="ml-2 text-yellow-600">· stale vitals</span>}
                        {p.clinical_data_status === 'NO_DATA' && <span className="ml-2 text-red-500">· no clinical data</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Pre-run data quality warnings ───────────────────────────── */}
          {preRunWarnings.length > 0 && (
            <div className="space-y-2">
              {preRunWarnings.map(w => {
                const meta = WARNING_META[w.type];
                const Icon = meta.icon;
                return (
                  <div key={w.type}
                    className={`flex gap-2 p-3 rounded-md border text-sm ${
                      w.type.startsWith('NO_') && !w.type.includes('RECENT')
                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:text-red-300'
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300'
                    }`}>
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.color}`} />
                    <span>{w.message}</span>
                    {(w.type === 'NO_CLINICAL_DATA' || w.type === 'STALE_CLINICAL_DATA') && (
                      <Button size="sm" variant="ghost" className="ml-auto shrink-0 h-6 text-xs px-2 hover:bg-yellow-100"
                        onClick={() => navigate(`/doctor/patients/${selectedId}`)}>
                        Add vitals
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Clinical data preview ────────────────────────────────────── */}
          {selectedPatient && latestClinical !== 'loading' && latestClinical && (
            <div className="bg-muted/30 rounded-md p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Snapshot that will be used
              </p>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {latestClinical.vitals.temperature && (
                    <span className="flex items-center gap-1">
                      <Thermometer className="h-3 w-3 text-muted-foreground" aria-hidden />
                      {latestClinical.vitals.temperature}°C
                    </span>
                  )}
                  {latestClinical.vitals.heart_rate && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3 text-muted-foreground" aria-hidden />
                      {latestClinical.vitals.heart_rate} bpm
                    </span>
                  )}
                  {latestClinical.symptoms.length > 0 && (
                    <span className="text-muted-foreground">
                      {latestClinical.symptoms.length} symptom{latestClinical.symptoms.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className={`text-xs ${latestClinical.is_stale ? 'text-yellow-600' : 'text-muted-foreground'} flex items-center gap-1`}>
                  {latestClinical.is_stale && <Clock className="h-3 w-3" />}
                  {timeAgo(latestClinical.recorded_at ?? latestClinical.created_at)}
                </span>
              </div>
            </div>
          )}

          {/* Model version */}
          <div className="space-y-1.5">
            <Label>Model Version</Label>
            <Select value={modelVersion} onValueChange={setModelVersion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODEL_VERSIONS.map(v => (
                  <SelectItem key={v.value} value={v.value}>
                    <span className="font-medium">{v.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{v.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data inputs summary */}
          {selectedPatient && (
            <div className="bg-muted/40 p-3 rounded-md space-y-1 text-sm">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Data used for prediction
              </p>
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span>Latest clinical record (vitals + symptoms)</span>
                {selectedPatient.clinical_data_status === 'STALE' && (
                  <Clock className="h-3 w-3 text-yellow-500 ml-auto" />
                )}
                {selectedPatient.clinical_data_status === 'NO_DATA' && (
                  <XCircle className="h-3 w-3 text-red-500 ml-auto" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-primary" />
                <span>Lab results from the last 90 days</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span>Model: {modelVersion}</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full gap-2" size="lg"
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Running AI Pipeline…</>
              : <><Brain className="h-4 w-4" /> Run Prediction</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* ── Post-run data warnings ────────────────────────────────────────── */}
      {result && dataWarnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <Database className="h-4 w-4" /> Data Quality Notices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dataWarnings.map(w => {
              const meta = WARNING_META[w.type];
              const Icon = meta.icon;
              return (
                <div key={w.type} className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.color}`} />
                  <span>{w.message}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Result card ───────────────────────────────────────────────────── */}
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
              {overageWarn && (
                <Badge className="bg-[#fff2e8] text-[#ff832b] border-orange-200 gap-1 text-xs">
                  <Zap className="h-3 w-3" /> Overage #{overageWarn.predictions_overage}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Risk level + bar */}
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
                  <span>{Math.round(result.risk_score * 100)}%</span>
                </div>
                <Progress value={result.risk_score * 100} className={riskCfg.bar} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">
                          Confidence: {Math.round(result.confidence * 100)}%
                          <Info className="h-3 w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        Confidence reflects data completeness (clinical data freshness + lab results).
                        It is not the probability of infection.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span>Model: {result.model_version}</span>
                </div>
              </div>
            </div>

            {/* Stale data inline callout (when confidence is reduced) */}
            {dataWarnings.some(w => w.type === 'STALE_CLINICAL_DATA' || w.type === 'NO_CLINICAL_DATA') && (
              <div className="flex gap-2 p-2.5 bg-yellow-100 rounded border border-yellow-200 text-xs text-yellow-800">
                <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Confidence reduced due to stale or missing clinical data.
                  Record fresh vitals and re-run for a higher-accuracy result.
                </span>
              </div>
            )}

            {/* Overage notice */}
            {overageWarn && (
              <div className="bg-[#fff2e8] dark:bg-orange-950/20 p-3 text-sm text-[#ff832b] flex gap-2 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{overageWarn.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="gap-2 flex-1"
                onClick={() => navigate(`/doctor/predictions/${result.request_id}`)}>
                <TrendingUp className="h-4 w-4" /> View Full Report + XAI
              </Button>
              <Button className="gap-2 flex-1"
                onClick={() => { setResult(null); setDataWarnings([]); setOverageWarn(null); }}>
                <Brain className="h-4 w-4" /> New Prediction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <UpgradePrompt open={showUpgrade} onClose={() => setShowUpgrade(false)} limitType="prediction" />
    </div>
  );
}

// ── Tiny icon stubs used inside JSX above ────────────────────────────────────
function Thermometer(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}
function Heart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
