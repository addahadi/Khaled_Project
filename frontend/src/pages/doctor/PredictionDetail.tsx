import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Brain, Activity, User, Clock, Calendar,
  TrendingUp, AlertTriangle, CheckCircle2, Info, ShieldAlert,
  Thermometer, Heart, Wind, Gauge, FlaskConical, Zap,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDateTime, timeAgo } from '@/lib/formatDate';
import { getRiskConfig } from '@/lib/riskConfig';
import type { RiskLevel } from '@/lib/riskConfig';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation, Trans } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureExplanation {
  feature_name: string;
  contribution: number;
  direction: 'POSITIVE' | 'NEGATIVE';
  rank: number;
}

interface DomainScores {
  vitals:      number;
  lab:         number;
  symptoms:    number;
  interaction: number;
}

interface RawPayload {
  model:           string;
  model_version:   string;
  engine_version?: string;
  scoring_weights?: { vitals: number; lab: number; symptoms: number; interaction: number };
  domain_scores?:  DomainScores;
  features?:       FeatureExplanation[];
}

interface ClinicalVitals {
  temperature?:              number;
  heart_rate?:               number;
  spo2?:                     number;
  blood_pressure_systolic?:  number;
  blood_pressure_diastolic?: number;
}

interface PredictionDetail {
  request_id:           string;
  patient_id:           string;
  patient_name:         string;
  patient_age:          number;
  patient_gender:       string;
  model_version:        string;
  status:               string;
  created_at:           string;
  requested_by_name:    string | null;
  risk_score:           number | null;
  risk_level:           RiskLevel | null;
  confidence:           number | null;
  raw_payload:          RawPayload | null;
  clinical_data_id:     string | null;
  clinical_vitals:      ClinicalVitals | null;
  clinical_symptoms:    string[] | null;
  clinical_recorded_at: string | null;
  clinical_visit_date:  string | null;
  clinical_created_at:  string | null;
  clinical_deleted_at:  string | null;
  clinical_data_stale:  boolean;
  feature_explanations: FeatureExplanation[];
}

// ─── Severity helpers (reused from PatientDetail) ─────────────────────────────

type VitalSev = 'normal' | 'warning' | 'elevated' | 'critical';

const vitalSev = (name: string, v: number): VitalSev => {
  if (name === 'temp')   return v >= 38.5 ? 'critical' : v >= 37.5 ? 'warning'  : 'normal';
  if (name === 'hr')     return (v > 110 || v < 50) ? 'critical' : v > 100 ? 'elevated' : 'normal';
  if (name === 'spo2')   return v < 93 ? 'critical' : v < 96 ? 'warning'  : 'normal';
  if (name === 'bp_sys') return v >= 160 ? 'critical' : v >= 140 ? 'elevated' : 'normal';
  return 'normal';
};

const VSTY: Record<VitalSev, { chip: string; label: string; val: string }> = {
  critical: { chip: 'bg-[#c0272d]/10 border border-[#c0272d]/20', label: 'text-[#c0272d]',  val: 'text-[#c0272d]'  },
  elevated: { chip: 'bg-[#e07020]/10 border border-[#e07020]/20', label: 'text-[#e07020]',  val: 'text-[#e07020]'  },
  warning:  { chip: 'bg-[#faaf3a]/15 border border-[#faaf3a]/25', label: 'text-[#a2680a]',  val: 'text-[#a2680a]'  },
  normal:   { chip: 'bg-[#00a89c]/10 border border-[#00a89c]/20', label: 'text-[#007a71]',  val: 'text-[#007a71]'  },
};

function VitalChip({ label, value, unit, sev, icon: Icon }: {
  label: string; value: string; unit: string; sev: VitalSev; icon: React.ElementType;
}) {
  const s = VSTY[sev];
  return (
    <div className={`p-3 rounded-lg ${s.chip} flex items-start gap-2.5`}>
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
        sev === 'critical' ? 'bg-[#c0272d]/15' :
        sev === 'elevated' ? 'bg-[#e07020]/15' :
        sev === 'warning'  ? 'bg-[#faaf3a]/20' : 'bg-[#00a89c]/15'
      }`}>
        <Icon className={`h-3.5 w-3.5 ${s.label}`} />
      </div>
      <div>
        <p className={`text-[10px] font-medium uppercase tracking-[0.06em] ${s.label}`}>{label}</p>
        <p className={`text-lg font-semibold leading-tight tabular-nums mt-0.5 ${s.val}`}>
          {value}
          <span className={`text-xs font-normal opacity-70 ml-0.5`}>{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Risk display config ──────────────────────────────────────────────────────

const RISK_HERO: Record<RiskLevel, {
  bg: string; border: string; color: string; barClass: string;
}> = {
  CRITICAL: { bg: 'bg-[#c0272d]/[0.06]', border: 'border-[#c0272d]/25', color: 'text-[#c0272d]', barClass: '[&>div]:bg-[#c0272d]' },
  HIGH:     { bg: 'bg-[#e07020]/[0.06]', border: 'border-[#e07020]/25', color: 'text-[#e07020]', barClass: '[&>div]:bg-[#e07020]' },
  MODERATE: { bg: 'bg-[#faaf3a]/[0.08]', border: 'border-[#faaf3a]/30', color: 'text-[#a2680a]', barClass: '[&>div]:bg-[#faaf3a]' },
  LOW:      { bg: 'bg-[#00a89c]/[0.06]', border: 'border-[#00a89c]/25', color: 'text-[#007a71]', barClass: '[&>div]:bg-[#00a89c]' },
};

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAIN_CONFIG: {
  key: keyof DomainScores; label: string; weight: string;
  color: string; trackColor: string; icon: React.ElementType;
}[] = [
  { key: 'vitals',      label: 'Vitals',       weight: '30%', color: '#2e368f', trackColor: '#2e368f20', icon: Activity },
  { key: 'lab',         label: 'Lab Results',   weight: '40%', color: '#e07020', trackColor: '#e0702020', icon: FlaskConical },
  { key: 'symptoms',    label: 'Symptoms',      weight: '20%', color: '#a2680a', trackColor: '#faaf3a20', icon: AlertTriangle },
  { key: 'interaction', label: 'Interactions',   weight: '10%', color: '#c0272d', trackColor: '#c0272d15', icon: Zap },
];

// ─── Feature label humanizer ──────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  wbc_count: 'White Blood Cell Count', rbc_count: 'Red Blood Cell Count',
  hemoglobin: 'Hemoglobin', hematocrit: 'Hematocrit', platelet_count: 'Platelet Count',
  crp_level: 'C-Reactive Protein', esr: 'Erythrocyte Sedimentation Rate',
  procalcitonin: 'Procalcitonin', temperature: 'Body Temperature', heart_rate: 'Heart Rate',
  spo2: 'Blood Oxygen (SpO₂)', blood_pressure_systolic: 'Systolic BP',
  blood_pressure_diastolic: 'Diastolic BP', neutrophil_pct: 'Neutrophil %',
  lymphocyte_pct: 'Lymphocyte %', albumin: 'Albumin', creatinine: 'Creatinine',
  bun: 'Blood Urea Nitrogen', alt: 'ALT (Liver)', ast: 'AST (Liver)',
  bilirubin: 'Bilirubin', glucose: 'Blood Glucose', sodium: 'Sodium', potassium: 'Potassium',
  lactate: 'Lactate', age: 'Patient Age', gender: 'Patient Gender',
};

function featureLabel(raw: string): string {
  return FEATURE_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Ring Gauge component ─────────────────────────────────────────────────────

function RingGauge({ value, color, trackColor, size = 80, strokeWidth = 7 }: {
  value: number; color: string; trackColor: string; size?: number; strokeWidth?: number;
}) {
  const radius    = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset    = circumference - (Math.min(value, 1) * circumference);
  const pct       = Math.round(value * 100);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={trackColor} strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        className="transform rotate-90 origin-center"
        fill={color} fontSize={size * 0.2} fontWeight={600}
      >
        {pct}%
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PredictionDetailPage() {
  const { t } = useTranslation('doctor');
  const { t: c } = useTranslation('common');
  const { predictionId } = useParams<{ predictionId: string }>();
  const navigate = useNavigate();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);

  useEffect(() => {
    if (!predictionId) return;
    ApiManager.execute({
      queryKey: ['doctor', 'prediction', predictionId],
      endpoint: `/doctor/predictions/${predictionId}`,
      onStart:   startLoading,
      onSuccess: (d) => {
        const p = (d as { prediction: PredictionDetail }).prediction;
        // Normalize JSONB fields that may come as strings
        if (typeof p.clinical_vitals === 'string') {
          try { p.clinical_vitals = JSON.parse(p.clinical_vitals); } catch { p.clinical_vitals = null; }
        }
        if (typeof p.clinical_symptoms === 'string') {
          try { p.clinical_symptoms = JSON.parse(p.clinical_symptoms); } catch { p.clinical_symptoms = []; }
        }
        if (typeof p.raw_payload === 'string') {
          try { p.raw_payload = JSON.parse(p.raw_payload); } catch { p.raw_payload = null; }
        }
        if (typeof p.feature_explanations === 'string') {
          try { p.feature_explanations = JSON.parse(p.feature_explanations); } catch { p.feature_explanations = []; }
        }
        setPrediction(p);
      },
      onFinal: stopLoading,
    });
  }, [predictionId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading || !prediction) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />)}
        </div>
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      </div>
    );
  }

  const riskCfg   = getRiskConfig(prediction.risk_level);
  const heroCfg   = prediction.risk_level ? RISK_HERO[prediction.risk_level] : null;
  const RiskIcon  = riskCfg?.icon ?? Brain;
  const rawPayload = prediction.raw_payload;
  const domainScores = rawPayload?.domain_scores ?? null;
  const vitals     = prediction.clinical_vitals;
  const symptoms   = Array.isArray(prediction.clinical_symptoms) ? prediction.clinical_symptoms : [];

  const sortedFeatures = [...(prediction.feature_explanations ?? [])]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Highest contribution for scaling bars
  const maxContribution = sortedFeatures.length > 0
    ? Math.max(...sortedFeatures.map(f => Math.abs(f.contribution)))
    : 1;

  return (
    <div className="space-y-6">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate('/doctor/predictions')}
          className="hover:text-primary transition-colors flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('predictions.title')}
        </button>
        <span className="text-border">/</span>
        <span className="text-foreground font-medium truncate">
          {prediction.patient_name} · {formatDateTime(prediction.created_at)}
        </span>
      </div>

      {/* ═══ 1. RISK SUMMARY HERO ═══════════════════════════════════════════ */}
      {prediction.risk_level && heroCfg && riskCfg && (
        <Card className={`border-2 ${heroCfg.border} ${heroCfg.bg}`}>
          <CardContent className="p-6 space-y-5">
            {/* Top row: risk level + patient info */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  prediction.risk_level === 'CRITICAL' ? 'bg-[#c0272d]/15' :
                  prediction.risk_level === 'HIGH'     ? 'bg-[#e07020]/15' :
                  prediction.risk_level === 'MODERATE' ? 'bg-[#faaf3a]/15' : 'bg-[#00a89c]/15'
                }`}>
                  <RiskIcon className={`h-7 w-7 ${heroCfg.color}`} />
                </div>
                <div>
                  <p className={`text-3xl font-bold tracking-tight ${heroCfg.color}`}>
                    {t(`patients.riskLevels.${prediction.risk_level}`) ?? prediction.risk_level}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('predictionDetail.infectionRiskLevel')}</p>
                </div>
              </div>

              {/* Patient badge */}
              <button
                onClick={() => navigate(`/doctor/patients/${prediction.patient_id}`)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all shrink-0"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{prediction.patient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {prediction.patient_age} {t('dashboard.yrs')} · {c(`gender.${prediction.patient_gender}`) ?? (prediction.patient_gender?.charAt(0) + prediction.patient_gender?.slice(1).toLowerCase())}
                  </p>
                </div>
              </button>
            </div>

            {/* Risk score bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground font-medium">{t('predictionDetail.riskScore')}</span>
                <span className={`font-bold text-lg ${heroCfg.color}`}>
                  {prediction.risk_score !== null ? `${Math.round(prediction.risk_score * 100)}%` : '—'}
                </span>
              </div>
              <Progress
                value={(prediction.risk_score ?? 0) * 100}
                className={`h-3 rounded-full ${heroCfg.barClass}`}
              />
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 cursor-help">
                      <Info className="h-3 w-3" />
                      {t('predictionDetail.confidence')}: <span className="font-medium text-foreground">
                        {prediction.confidence !== null ? `${Math.round(prediction.confidence * 100)}%` : '—'}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    {t('predictionDetail.confidenceTooltip')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {t('predictionDetail.model')}: {prediction.model_version}
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateTime(prediction.created_at)}
              </span>
              {prediction.requested_by_name && (
                <>
                  <span className="text-border">·</span>
                  <span>{t('predictionDetail.by')} {t('predictionDetail.dr')} {prediction.requested_by_name}</span>
                </>
              )}
            </div>

            {/* Stale data warning */}
            {prediction.clinical_data_stale && (
              <div className="flex gap-2 p-3 bg-[#faaf3a]/10 rounded-lg border border-[#faaf3a]/25 text-xs text-[#a2680a]">
                <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{t('predictionDetail.staleWarning')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ 2. DOMAIN SCORE BREAKDOWN ═══════════════════════════════════════ */}
      {domainScores && (
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" /> {t('predictionDetail.scoringBreakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {DOMAIN_CONFIG.map(({ key, label, weight, color, trackColor, icon: DIcon }) => (
                <div key={key} className="flex flex-col items-center text-center">
                  <RingGauge
                    value={domainScores[key] ?? 0}
                    color={color}
                    trackColor={trackColor}
                    size={76}
                    strokeWidth={6}
                  />
                    <div className="mt-2.5">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1 justify-center">
                        <DIcon className="h-3 w-3" style={{ color }} />
                        {t(`predictionDetail.domains.${key}`) ?? label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t('predictionDetail.weight')}: {weight}
                      </p>
                    </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 3. CLINICAL DATA SNAPSHOT ═══════════════════════════════════════ */}
      {prediction.clinical_data_id && (
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <Activity className="h-4 w-4" /> {t('predictionDetail.clinicalDataUsed')}
              {prediction.clinical_data_stale && (
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30 flex items-center gap-1 normal-case tracking-normal">
                  <Clock className="h-2.5 w-2.5" /> {t('predictionDetail.staleAtPrediction')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Vitals grid */}
            {vitals && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {vitals.temperature != null && (
                  <VitalChip
                    label={t('predictionDetail.vitals.temp')} unit="°C" icon={Thermometer}
                    value={String(vitals.temperature)}
                    sev={vitalSev('temp', vitals.temperature)}
                  />
                )}
                {vitals.heart_rate != null && (
                  <VitalChip
                    label={t('predictionDetail.vitals.hr')} unit="bpm" icon={Heart}
                    value={String(vitals.heart_rate)}
                    sev={vitalSev('hr', vitals.heart_rate)}
                  />
                )}
                {vitals.spo2 != null && (
                  <VitalChip
                    label={t('predictionDetail.vitals.spo2')} unit="%" icon={Wind}
                    value={String(vitals.spo2)}
                    sev={vitalSev('spo2', vitals.spo2)}
                  />
                )}
                {vitals.blood_pressure_systolic != null && (
                  <VitalChip
                    label={t('predictionDetail.vitals.bp')} unit="" icon={Gauge}
                    value={`${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic ?? '?'}`}
                    sev={vitalSev('bp_sys', vitals.blood_pressure_systolic)}
                  />
                )}
              </div>
            )}

            {/* Symptoms */}
            {symptoms.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t('predictionDetail.reportedSymptoms')} ({symptoms.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {symptoms.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground border border-border">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Freshness note */}
            {prediction.clinical_recorded_at && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {t('predictionDetail.observed')} {timeAgo(prediction.clinical_recorded_at)}
                {prediction.clinical_visit_date && ` · ${t('predictionDetail.visit')} ${prediction.clinical_visit_date}`}
              </p>
            )}

            {/* No data fallback */}
            {!vitals && symptoms.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('predictionDetail.noClinicalDataLinked')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* No clinical data at all */}
      {!prediction.clinical_data_id && (
        <Card className="border-[#faaf3a]/25 bg-[#faaf3a]/[0.04]">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#faaf3a]/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-[#a2680a]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#a2680a]">{t('predictionDetail.noClinicalData')}</p>
              <p className="text-xs text-[#a2680a]/80 mt-0.5">
                {t('predictionDetail.noClinicalDataDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 4. XAI FEATURE EXPLANATIONS ════════════════════════════════════ */}
      {sortedFeatures.length > 0 && (
        <Card>
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" /> {t('predictionDetail.featureExplanations')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-2">
              {sortedFeatures.map((fe, i) => {
                const isPositive = fe.direction === 'POSITIVE';
                const barWidth = maxContribution > 0
                  ? Math.max((Math.abs(fe.contribution) / maxContribution) * 100, 3)
                  : 3;

                return (
                  <div key={i} className="flex items-center gap-3 group">
                    {/* Direction indicator */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isPositive
                        ? 'bg-[#c0272d]/10 text-[#c0272d]'
                        : 'bg-[#00a89c]/10 text-[#00a89c]'
                    }`}>
                      {isPositive ? '↑' : '↓'}
                    </div>

                    {/* Feature name */}
                    <span className="flex-1 text-sm text-foreground truncate min-w-0 group-hover:text-primary transition-colors">
                      {featureLabel(fe.feature_name)}
                    </span>

                    {/* Bar */}
                    <div className="w-28 bg-muted rounded-full h-2.5 shrink-0" role="progressbar">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
                          isPositive ? 'bg-[#c0272d]/50' : 'bg-[#00a89c]/50'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Value */}
                    <span className="text-xs text-muted-foreground w-12 text-right shrink-0 tabular-nums font-medium">
                      {(fe.contribution * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#c0272d]/50" />
                <span className="text-xs text-muted-foreground">{t('predictionDetail.increasesRisk')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#00a89c]/50" />
                <span className="text-xs text-muted-foreground">{t('predictionDetail.decreasesRisk')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ACTION BUTTONS ═════════════════════════════════════════════════ */}
      <div className="flex gap-3 pb-4">
        <Button
          variant="outline" className="gap-2 flex-1"
          onClick={() => navigate(`/doctor/patients/${prediction.patient_id}`)}
        >
          <User className="h-4 w-4" /> {t('predictionDetail.viewPatient')}
        </Button>
        <Button
          className="gap-2 flex-1"
          onClick={() => navigate('/doctor/predictions/new', { state: { patientId: prediction.patient_id } })}
        >
          <Brain className="h-4 w-4" /> {t('predictionDetail.runNewPrediction')}
        </Button>
      </div>
    </div>
  );
}
