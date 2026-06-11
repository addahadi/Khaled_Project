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
  TrendingUp, Zap, Info, Clock, Database, XCircle, Search,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import UpgradePrompt from '@/components/auth/UpgradePrompt';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { timeAgo } from '@/lib/formatDate';

interface Patient {
  patient_id: string; name: string; age: number;
  gender: string; clinical_data_status: 'FRESH' | 'STALE' | 'NO_DATA';
}
interface ClinicalRecord {
  data_id: string; recorded_at: string | null; created_at: string;
  is_stale: boolean; vitals: Record<string, number | undefined>; symptoms: string[];
}
interface PredictionResult {
  request_id: string; risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_score: number; confidence: number; model_version: string;
}
interface DataWarning {
  type: 'NO_CLINICAL_DATA' | 'STALE_CLINICAL_DATA' | 'NO_LAB_RESULTS' | 'NO_RECENT_LAB_RESULTS';
  message: string;
}
interface OverageWarning { message: string; predictions_overage: number; }

const RISK_DISPLAY: Record<string, { color: string; bar: string; bg: string; border: string; icon: React.ElementType }> = {
  LOW:      { color: 'text-[#007a71]',  bar: '[&>div]:bg-[#00a89c]', bg: 'bg-[#00a89c]/8',  border: 'border-[#00a89c]/25', icon: CheckCircle2  },
  MODERATE: { color: 'text-[#a2680a]',  bar: '[&>div]:bg-[#faaf3a]', bg: 'bg-[#faaf3a]/10', border: 'border-[#faaf3a]/30', icon: AlertTriangle },
  HIGH:     { color: 'text-[#e07020]',  bar: '[&>div]:bg-[#e07020]', bg: 'bg-[#e07020]/8',  border: 'border-[#e07020]/25', icon: AlertTriangle },
  CRITICAL: { color: 'text-[#c0272d]',  bar: '[&>div]:bg-[#c0272d]', bg: 'bg-[#c0272d]/8',  border: 'border-[#c0272d]/20', icon: AlertTriangle },
};

const MODEL_VERSIONS = [
  { value: 'v2.3.1', label: 'Latest (v2.3.1)',  description: 'Recommended — best accuracy' },
  { value: 'v2.2.0', label: 'Stable (v2.2.0)',  description: 'Previous release' },
  { value: 'v2.1.5', label: 'Legacy (v2.1.5)',  description: 'For comparison only' },
];

const WARNING_META: Record<DataWarning['type'], { icon: React.ElementType; color: string }> = {
  NO_CLINICAL_DATA:      { icon: XCircle,      color: 'text-[#c0272d]' },
  STALE_CLINICAL_DATA:   { icon: Clock,        color: 'text-[#a2680a]' },
  NO_LAB_RESULTS:        { icon: FlaskConical, color: 'text-[#c0272d]' },
  NO_RECENT_LAB_RESULTS: { icon: FlaskConical, color: 'text-[#a2680a]' },
};

export default function NewPrediction() {
  const [searchParams]  = useSearchParams();
  const location        = useLocation();
  const navigate        = useNavigate();
  const { toast }       = useToast();
  const { isLoading: patientsLoading, startLoading, stopLoading } = useDelayedLoading();

  const preselectedId = (location.state as { patientId?: string })?.patientId
    ?? searchParams.get('patient_id') ?? '';

  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [selectedId,      setSelectedId]      = useState(preselectedId);
  const [searchTerm,      setSearchTerm]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDropdownOpen,  setIsDropdownOpen]  = useState(false);
  const [modelVersion,    setModelVersion]    = useState('v2.3.1');
  const [submitting,      setSubmitting]      = useState(false);
  const [result,          setResult]          = useState<PredictionResult | null>(null);
  const [dataWarnings,    setDataWarnings]    = useState<DataWarning[]>([]);
  const [overageWarn,     setOverageWarn]     = useState<OverageWarning | null>(null);
  const [showUpgrade,     setShowUpgrade]     = useState(false);
  const [latestClinical,  setLatestClinical]  = useState<ClinicalRecord | null | 'loading'>('loading');

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

  const preRunWarnings: DataWarning[] = [];
  if (selectedPatient) {
    if (selectedPatient.clinical_data_status === 'NO_DATA') {
      preRunWarnings.push({ type: 'NO_CLINICAL_DATA', message: 'No clinical data recorded for this patient. Prediction accuracy will be significantly reduced.' });
    } else if (selectedPatient.clinical_data_status === 'STALE') {
      const observedAt = latestClinical && latestClinical !== 'loading'
        ? (latestClinical.recorded_at ?? latestClinical.created_at) : null;
      preRunWarnings.push({
        type: 'STALE_CLINICAL_DATA',
        message: `Clinical vitals are${observedAt ? ` ${timeAgo(observedAt)} old` : ' stale'} (threshold: 72h). Consider recording fresh vitals first.`,
      });
    }
  }

  const handleSubmit = () => {
    if (!selectedId) { toast({ title: 'Select a patient first', variant: 'destructive' }); return; }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/doctor/predictions', { patient_id: selectedId, model_version: modelVersion }),
      invalidateKeys: [['doctor', 'predictions'], ['doctor', 'patients']],
      onStart:   () => { setSubmitting(true); setResult(null); setDataWarnings([]); setOverageWarn(null); },
      onSuccess: (data) => {
        const res = data as {
          predictionRequest: PredictionResult; clinical_data_stale: boolean;
          data_warnings?: DataWarning[]; overage_warning?: OverageWarning;
        };
        setResult(res.predictionRequest);
        setDataWarnings(res.data_warnings ?? []);
        if (res.overage_warning) setOverageWarn(res.overage_warning);
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

  const riskCfg  = result ? RISK_DISPLAY[result.risk_level] : null;
  const RiskIcon = riskCfg?.icon ?? Brain;

  return (
    <div className="space-y-6 w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0"
          onClick={() => navigate(selectedPatient ? `/doctor/patients/${selectedId}` : '/doctor/predictions')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">New AI Prediction</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Runs an ensemble AI model on the patient's latest clinical record and recent lab results.
          </p>
        </div>
      </div>

      {/* Setup card */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
            <Brain className="h-4 w-4" /> Prediction Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">

          {/* Patient selector */}
          <div className="space-y-1.5 relative">
            <Label className="text-sm">Patient</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 pr-9"
                placeholder="Search patient by name…"
                value={selectedId ? (selectedPatient?.name ?? '') : searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedId(''); setIsDropdownOpen(true); }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              />
              {selectedId && (
                <XCircle
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => { setSelectedId(''); setSearchTerm(''); setLatestClinical('loading'); }}
                />
              )}
            </div>

            {isDropdownOpen && !selectedId && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-[var(--radius)] shadow-md max-h-60 overflow-auto">
                {patientsLoading ? (
                  <div className="p-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : patients.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No patients found.{' '}
                    <button className="text-primary font-medium hover:underline" onClick={() => navigate('/doctor/patients')}>
                      Register new patient
                    </button>
                  </div>
                ) : (
                  patients.map(p => (
                    <div
                      key={p.patient_id}
                      className="p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); setSelectedId(p.patient_id); setSearchTerm(''); setIsDropdownOpen(false); }}
                    >
                      <span className="font-medium text-sm text-foreground">{p.name}</span>
                      <span className="text-muted-foreground text-xs block mt-0.5">
                        {p.age} yrs, {p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}
                        {p.clinical_data_status === 'STALE' && <span className="ml-2 text-[#a2680a]">· stale vitals</span>}
                        {p.clinical_data_status === 'NO_DATA' && <span className="ml-2 text-[#c0272d]">· no clinical data</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Pre-run warnings */}
          {preRunWarnings.length > 0 && (
            <div className="space-y-2">
              {preRunWarnings.map(w => {
                const meta = WARNING_META[w.type];
                const Icon = meta.icon;
                const isError = w.type.startsWith('NO_') && !w.type.includes('RECENT');
                return (
                  <div key={w.type} className={`flex gap-2.5 p-3 rounded-[var(--radius)] border text-sm ${
                    isError
                      ? 'bg-[#c0272d]/8 border-[#c0272d]/20 text-[#c0272d]'
                      : 'bg-[#faaf3a]/10 border-[#faaf3a]/25 text-[#a2680a]'
                  }`}>
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.color}`} />
                    <span className="flex-1">{w.message}</span>
                    {(w.type === 'NO_CLINICAL_DATA' || w.type === 'STALE_CLINICAL_DATA') && (
                      <button
                        className="shrink-0 text-xs font-medium underline hover:no-underline ml-2"
                        onClick={() => navigate(`/doctor/patients/${selectedId}`)}
                      >
                        Add vitals
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Clinical data snapshot */}
          {selectedPatient && latestClinical !== 'loading' && latestClinical && (
            <div className="bg-muted/50 rounded-[var(--radius)] p-3 space-y-2 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Snapshot that will be used
              </p>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {latestClinical.vitals.temperature && (
                    <span className="text-foreground">{latestClinical.vitals.temperature}°C</span>
                  )}
                  {latestClinical.vitals.heart_rate && (
                    <span className="text-foreground">{latestClinical.vitals.heart_rate} bpm</span>
                  )}
                  {latestClinical.symptoms.length > 0 && (
                    <span className="text-muted-foreground">
                      {latestClinical.symptoms.length} symptom{latestClinical.symptoms.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className={`text-xs flex items-center gap-1 ${latestClinical.is_stale ? 'text-[#a2680a]' : 'text-muted-foreground'}`}>
                  {latestClinical.is_stale && <Clock className="h-3 w-3" />}
                  {timeAgo(latestClinical.recorded_at ?? latestClinical.created_at)}
                </span>
              </div>
            </div>
          )}

          {/* Model version */}
          <div className="space-y-1.5">
            <Label className="text-sm">Model Version</Label>
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
            <div className="bg-muted/40 rounded-[var(--radius)] p-3 space-y-2 border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Data used for prediction
              </p>
              {[
                { icon: Activity,    text: 'Latest clinical record (vitals + symptoms)', status: selectedPatient.clinical_data_status },
                { icon: FlaskConical,text: 'Lab results from the last 90 days',          status: null },
                { icon: Brain,       text: `Model: ${modelVersion}`,                     status: null },
              ].map(({ icon: Icon, text, status }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="flex-1">{text}</span>
                  {status === 'STALE'   && <Clock   className="h-3 w-3 text-[#a2680a]" />}
                  {status === 'NO_DATA' && <XCircle className="h-3 w-3 text-[#c0272d]" />}
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <Button className="w-full gap-2" size="lg" onClick={handleSubmit} disabled={submitting || !selectedId}>
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Running AI Pipeline…</>
              : <><Brain className="h-4 w-4" /> Run Prediction</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Post-run data warnings */}
      {result && dataWarnings.length > 0 && (
        <Card className="border-[#faaf3a]/30 bg-[#faaf3a]/8">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#a2680a]">
              <Database className="h-4 w-4" /> Data Quality Notices
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {dataWarnings.map(w => {
              const meta = WARNING_META[w.type];
              const Icon = meta.icon;
              return (
                <div key={w.type} className="flex items-start gap-2 text-sm text-[#a2680a]">
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.color}`} />
                  <span>{w.message}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Result card */}
      {result && riskCfg && (
        <Card className={`border-2 ${riskCfg.border} ${riskCfg.bg}`}>
          <CardHeader className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <RiskIcon className={`h-5 w-5 ${riskCfg.color}`} />
                Prediction Result
              </CardTitle>
              {overageWarn && (
                <Badge className="bg-[#faaf3a]/15 text-[#a2680a] border-[#faaf3a]/30 gap-1 text-xs">
                  <Zap className="h-3 w-3" /> Overage #{overageWarn.predictions_overage}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                <span className={`text-3xl font-bold ${riskCfg.color}`}>{result.risk_level}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Risk Score</span>
                  <span className="font-medium">{Math.round(result.risk_score * 100)}%</span>
                </div>
                <Progress value={result.risk_score * 100} className={riskCfg.bar} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 cursor-help">
                          Confidence: {Math.round(result.confidence * 100)}%
                          <Info className="h-3 w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                        Confidence reflects data completeness. It is not the probability of infection.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span>Model: {result.model_version}</span>
                </div>
              </div>
            </div>

            {dataWarnings.some(w => w.type === 'STALE_CLINICAL_DATA' || w.type === 'NO_CLINICAL_DATA') && (
              <div className="flex gap-2 p-3 bg-[#faaf3a]/10 rounded-[var(--radius)] border border-[#faaf3a]/25 text-xs text-[#a2680a]">
                <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Confidence reduced due to stale or missing clinical data. Record fresh vitals and re-run for a higher-accuracy result.</span>
              </div>
            )}

            {overageWarn && (
              <div className="flex gap-2 p-3 bg-[#faaf3a]/10 rounded-[var(--radius)] border border-[#faaf3a]/25 text-sm text-[#a2680a]">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{overageWarn.message}</span>
              </div>
            )}

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

function Thermometer(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}
