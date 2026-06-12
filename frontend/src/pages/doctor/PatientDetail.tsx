import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, User, FlaskConical, Brain,
  Activity, Plus, Pencil, Trash2,
  AlertTriangle, Loader2, Clock, Calendar, Link,
  Users, Shield, ShieldCheck, UserCheck, UserPlus,
  LockKeyhole, CheckCircle2,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { labOrderSchema, clinicalDataSchema, flattenZodErrors } from '@/api/schemas';
import { TagInput } from '@/components/ui/tag-input';
import { formatDate, timeAgo } from '@/lib/formatDate';
import { useTranslation, Trans } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  assignment_id: string;
  role:          'PRIMARY' | 'CONSULTING' | 'COVERING';
  assigned_at:   string;
  notes:         string | null;
  doctor_id:     string;
  doctor_name:   string;
}

interface PatientDetail {
  patient_id:    string; name: string; age: number;
  gender:        string; medical_history: Record<string, unknown>;
  risk_level:    string | null; risk_score: number | null;
  created_at:    string;
  clinicalData:  ClinicalRecord[];
  labTests:      LabTest[];
  assignments:   Assignment[];
  is_assigned:   boolean;
}
interface ClinicalRecord {
  data_id:      string;
  vitals:       { temperature?: number; heart_rate?: number; spo2?: number;
                  blood_pressure_systolic?: number; blood_pressure_diastolic?: number };
  symptoms:     string[];
  recorded_at:  string | null;
  visit_date:   string | null;
  created_at:   string;
  is_stale:     boolean;
  linked_prediction_count: number;
}
interface LabTest {
  test_id: string; test_type: string; status: string;
  notes: string; ordered_at: string;
}
interface Prediction {
  request_id: string; risk_level: string; risk_score: number;
  confidence: number; status: string; created_at: string;
  clinical_data_stale: boolean;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, string> = {
  LOW:      'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25 rounded-full',
  MODERATE: 'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30 rounded-full',
  HIGH:     'bg-[#e07020]/10 text-[#a04c10] border border-[#e07020]/25 rounded-full',
  CRITICAL: 'bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20 rounded-full',
};
const LAB_STATUS: Record<string, string> = {
  PENDING:    'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30 rounded-full',
  INPROGRESS: 'bg-primary/10 text-primary border border-primary/20 rounded-full',
  COMPLETED:  'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25 rounded-full',
};
const ROLE_CONFIG: Record<string, { labelKey: string; icon: typeof Shield; className: string }> = {
  PRIMARY:    { labelKey: 'roles.PRIMARY',    icon: ShieldCheck, className: 'bg-primary/10 text-primary border border-primary/20 rounded-full' },
  COVERING:   { labelKey: 'roles.COVERING',   icon: Shield,      className: 'bg-[#e07020]/10 text-[#a04c10] border border-[#e07020]/25 rounded-full' },
  CONSULTING: { labelKey: 'roles.CONSULTING', icon: UserCheck,   className: 'bg-[#2e368f]/10 text-[#2e368f] border border-[#2e368f]/20 rounded-full' },
};

// ─── Vitals HUD helpers (signature element) ───────────────────────────────────

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

function VitalChip({ label, value, unit, sev }: {
  label: string; value: string; unit: string; sev: VitalSev;
}) {
  const s = VSTY[sev];
  return (
    <div className={`p-2.5 rounded-md ${s.chip}`}>
      <p className={`text-[9px] font-medium uppercase tracking-[0.07em] ${s.label}`}>{label}</p>
      <p className={`text-[18px] font-medium leading-[1.3] tabular-nums mt-0.5 ${s.val}`}>
        {value}
        <span className={`text-[11px] font-normal opacity-70 ml-0.5 ${s.label}`}>{unit}</span>
      </p>
    </div>
  );
}

// ─── Status strip config ──────────────────────────────────────────────────────

type StripSev = 'critical' | 'high' | 'moderate' | 'info';

const STRIP_BORDER: Record<StripSev, string> = {
  critical: '#c0272d',
  high:     '#e07020',
  moderate: '#faaf3a',
  info:     'hsl(var(--primary))',
};
const STRIP_BG: Record<StripSev, string> = {
  critical: 'bg-[#c0272d]/[0.04]',
  high:     'bg-[#e07020]/[0.04]',
  moderate: 'bg-[#faaf3a]/[0.06]',
  info:     'bg-primary/[0.04]',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientDetail() {
  const { t } = useTranslation('doctor');
  const { t: c } = useTranslation('common');
  const { patientId } = useParams<{ patientId: string }>();
  const navigate       = useNavigate();
  const { toast }      = useToast();
  const { user }       = useAuth();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [patient,      setPatient]      = useState<PatientDetail | null>(null);
  const [predictions,  setPredictions]  = useState<Prediction[]>([]);
  const [labOpen,      setLabOpen]      = useState(false);
  const [clinicOpen,   setClinicOpen]   = useState(false);
  const [savingLab,    setSavingLab]    = useState(false);
  const [savingClin,   setSavingClin]   = useState(false);
  const [labErrors,    setLabErrors]    = useState<Record<string, string>>({});
  const [clinErrors,   setClinErrors]   = useState<Record<string, string>>({});
  const [editingClin,  setEditingClin]  = useState<ClinicalRecord | null>(null);
  const [deleteClinId, setDeleteClinId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClinicalRecord | null>(null);
  const [deletingClin, setDeletingClin] = useState(false);

  const [resultsOpen,    setResultsOpen]    = useState(false);
  const [activeLabTest,  setActiveLabTest]  = useState<LabTest | null>(null);
  const [labResults,     setLabResults]     = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const [labForm,  setLabForm]  = useState({ test_type: '', notes: '', assigned_to: 'any' });
  const [labTechs, setLabTechs] = useState<{user_id: string, username: string}[]>([]);

  const [clinForm, setClinForm] = useState({
    temperature: '', heart_rate: '', spo2: '',
    bp_sys: '', bp_dia: '',
    symptoms:    [] as string[],
    recorded_at: '',
    visit_date:  '',
  });

  const [joining,       setJoining]       = useState(false);
  const [assignOpen,    setAssignOpen]     = useState(false);
  const [assigning,     setAssigning]      = useState(false);
  const [discharging,   setDischarging]    = useState<string | null>(null);
  const [orgDoctors,    setOrgDoctors]     = useState<{user_id: string, username: string}[]>([]);
  const [assignForm,    setAssignForm]     = useState({ doctor_id: '', role: 'CONSULTING', notes: '', valid_until: '' });
  const [assignErrors,  setAssignErrors]   = useState<Record<string, string>>({});

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadPatient = () => {
    if (!patientId) return;
    ApiManager.execute({
      queryKey: ['doctor', 'patient', patientId],
      endpoint: `/doctor/patients/${patientId}`,
      onStart:   startLoading,
      onSuccess: (d) => setPatient((d as { patient: PatientDetail }).patient),
      onFinal:   stopLoading,
    });
  };

  useEffect(() => {
    loadPatient();
    if (!patientId) return;

    ApiManager.execute({
      queryKey: ['doctor', 'predictions', 'org'],
      endpoint: `/doctor/predictions?scope=org&patient_id=${patientId}&limit=50`,
      onSuccess: (d) => {
        const all = (d as { predictions: (Prediction & { patient_id: string })[] }).predictions;
        setPredictions(all.filter(p => p.patient_id === patientId));
      },
    });

    ApiManager.execute({
      queryKey: ['doctor', 'labTechs'],
      endpoint: '/doctor/lab-techs',
      onSuccess: (d) => setLabTechs((d as any).techs ?? []),
    });

    ApiManager.execute({
      queryKey: ['doctor', 'orgDoctors'],
      endpoint: '/doctor/org-doctors',
      onSuccess: (d) => setOrgDoctors((d as any).doctors ?? []),
    });
  }, [patientId]);

  // ── Lab order ─────────────────────────────────────────────────────────────
  const handleLabOrder = () => {
    const result = labOrderSchema.safeParse(labForm);
    if (!result.success) { setLabErrors(flattenZodErrors(result.error)); return; }
    setLabErrors({});
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/doctor/lab-orders', {
        patient_id: patientId, test_type: result.data.test_type,
        notes: result.data.notes || undefined,
        assigned_to: labForm.assigned_to !== 'any' ? labForm.assigned_to : undefined,
      }),
      invalidateKeys: [['doctor', 'patient', patientId!]],
      onStart:   () => setSavingLab(true),
      onSuccess: (_d, msg) => {
        toast({ title: 'Lab order sent', description: msg });
        setLabOpen(false);
        setLabForm({ test_type: '', notes: '', assigned_to: 'any' });
        loadPatient();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setSavingLab(false),
    });
  };

  const handleOpenResults = (lt: LabTest) => {
    setActiveLabTest(lt);
    setResultsOpen(true);
    ApiManager.execute({
      queryKey: ['doctor', 'lab-results', lt.test_id],
      endpoint: `/doctor/lab-results/${lt.test_id}`,
      onStart:   () => setLoadingResults(true),
      onSuccess: (d: any) => setLabResults(d.data?.results ?? d.results ?? []),
      onFinal:   () => setLoadingResults(false),
    });
  };

  const handleAcknowledgeResult = (resultId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/doctor/lab-results/${resultId}/acknowledge`),
      invalidateKeys: [['doctor', 'lab-results', activeLabTest!.test_id]],
      onSuccess: () => {
        toast({ title: 'Result acknowledged' });
        setLabResults(prev => prev.map(r =>
          r.result_id === resultId ? { ...r, acknowledged_at: new Date().toISOString() } : r
        ));
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
    });
  };

  // ── Clinical data ─────────────────────────────────────────────────────────
  const handleClinicalData = () => {
    const result = clinicalDataSchema.safeParse(clinForm);
    if (!result.success) { setClinErrors(flattenZodErrors(result.error)); return; }
    setClinErrors({});

    const toNum = (v: string | undefined) => v ? Number(v) : undefined;
    const vitals = {
      temperature:              toNum(result.data.temperature),
      heart_rate:               toNum(result.data.heart_rate),
      spo2:                     toNum(result.data.spo2),
      blood_pressure_systolic:  toNum(result.data.bp_sys),
      blood_pressure_diastolic: toNum(result.data.bp_dia),
    };

    const payload: Record<string, unknown> = {
      vitals, symptoms: clinForm.symptoms,
      ...(clinForm.recorded_at && { recorded_at: new Date(clinForm.recorded_at).toISOString() }),
      ...(clinForm.visit_date  && { visit_date:  clinForm.visit_date }),
    };

    const isEdit = editingClin !== null;
    ApiManager.executeMutation({
      mutationFn: isEdit
        ? () => apiClient.patch(`/doctor/clinical-data/${editingClin.data_id}`, payload)
        : () => apiClient.post('/doctor/clinical-data', { patient_id: patientId, ...payload }),
      invalidateKeys: [['doctor', 'patient', patientId!]],
      onStart:   () => setSavingClin(true),
      onSuccess: (responseData, msg) => {
        toast({ title: isEdit ? 'Record updated' : 'Record saved', description: msg });
        const warn = (responseData as any)?.warning;
        if (warn) toast({ title: 'Note', description: warn });
        setClinicOpen(false);
        setEditingClin(null);
        setClinForm({ temperature: '', heart_rate: '', spo2: '', bp_sys: '', bp_dia: '', symptoms: [], recorded_at: '', visit_date: '' });
        loadPatient();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setSavingClin(false),
    });
  };

  const handleDeleteClinicalData = () => {
    if (!deleteClinId) return;
    ApiManager.executeMutation({
      mutationFn: () => apiClient.delete(`/doctor/clinical-data/${deleteClinId}`),
      invalidateKeys: [['doctor', 'patient', patientId!]],
      onStart:   () => setDeletingClin(true),
      onSuccess: (responseData, msg) => {
        toast({ title: 'Record archived', description: msg });
        const note = (responseData as any)?.note;
        if (note) toast({ title: 'Note', description: note });
        setDeleteClinId(null);
        setDeleteTarget(null);
        loadPatient();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setDeletingClin(false),
    });
  };

  const openEditDialog = (cd: ClinicalRecord) => {
    setEditingClin(cd);
    const dtLocal = new Date(cd.recorded_at ?? cd.created_at).toISOString().slice(0, 16);
    setClinForm({
      temperature: cd.vitals.temperature?.toString() ?? '',
      heart_rate:  cd.vitals.heart_rate?.toString()  ?? '',
      spo2:        cd.vitals.spo2?.toString()         ?? '',
      bp_sys:      cd.vitals.blood_pressure_systolic?.toString()  ?? '',
      bp_dia:      cd.vitals.blood_pressure_diastolic?.toString() ?? '',
      symptoms:    Array.isArray(cd.symptoms) ? cd.symptoms : [],
      recorded_at: dtLocal,
      visit_date:  cd.visit_date ?? '',
    });
    setClinErrors({});
    setClinicOpen(true);
  };

  // ── Care team handlers ────────────────────────────────────────────────────
  const handleAssignColleague = () => {
    if (!assignForm.doctor_id) {
      setAssignErrors({ doctor_id: 'Please select a doctor' });
      return;
    }
    setAssignErrors({});
    if (assignForm.role === 'COVERING' && !assignForm.valid_until) {
      setAssignErrors({ valid_until: 'Expiration date is required for covering role' });
      return;
    }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post(`/doctor/patients/${patientId}/assignments`, {
        doctor_id: assignForm.doctor_id,
        role:      assignForm.role,
        notes:     assignForm.notes || undefined,
        valid_until: assignForm.role === 'COVERING' && assignForm.valid_until ? new Date(assignForm.valid_until).toISOString() : undefined,
      }),
      invalidateKeys: [['doctor', 'patient', patientId!]],
      onStart:   () => setAssigning(true),
      onSuccess: () => {
        toast({ title: 'Doctor assigned', description: 'Care team updated successfully.' });
        setAssignOpen(false);
        setAssignForm({ doctor_id: '', role: 'CONSULTING', notes: '', valid_until: '' });
        loadPatient();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setAssigning(false),
    });
  };

  const handleDischargeAssignment = (assignmentId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.delete(`/doctor/patients/${patientId}/assignments/${assignmentId}`),
      invalidateKeys: [['doctor', 'patient', patientId!]],
      onStart:   () => setDischarging(assignmentId),
      onSuccess: () => {
        toast({ title: 'Doctor removed', description: 'Assignment ended.' });
        loadPatient();
      },
      onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setDischarging(null),
    });
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const staleBadge = (cd: ClinicalRecord) => {
    if (!cd.is_stale) return null;
    const observedAt = cd.recorded_at ?? cd.created_at;
    return (
      <span title={`Observation time: ${new Date(observedAt).toLocaleString()}`}
        className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30">
        <Clock className="h-2.5 w-2.5" /> {t('patientDetail.stale')} · {timeAgo(observedAt)}
      </span>
    );
  };

  const linkedBadge = (cd: ClinicalRecord) => {
    const count = Number(cd.linked_prediction_count);
    if (count === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
        <Link className="h-2.5 w-2.5" /> {count} prediction{count > 1 ? 's' : ''}
      </span>
    );
  };

  // ─── Loading / not found ──────────────────────────────────────────────────
  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
  if (!patient) return (
    <div className="text-center py-16 text-muted-foreground">{t('patientDetail.patientNotFound')}</div>
  );

  const latestClinical = patient.clinicalData[0] ?? null;
  const isAssigned     = patient.is_assigned;

  const isPrimary = patient.assignments.some(
    a => a.doctor_id === user?.user_id && a.role === 'PRIMARY',
  );

  // ── Status strip ──────────────────────────────────────────────────────────
  const getStripSev = (): StripSev | null => {
    if (patient.risk_level === 'CRITICAL') return 'critical';
    if (patient.risk_level === 'HIGH')     return 'high';
    if (patient.risk_level === 'MODERATE') return 'moderate';
    if (latestClinical?.is_stale)          return 'moderate';
    if (!isAssigned)                       return 'info';
    return null;
  };
  const stripSev = getStripSev();

  const openAddVitals = () => {
    setEditingClin(null);
    setClinForm({ temperature: '', heart_rate: '', spo2: '', bp_sys: '', bp_dia: '', symptoms: [], recorded_at: '', visit_date: '' });
    setClinicOpen(true);
  };

  // ─── Patient name initials ────────────────────────────────────────────────
  const initials = patient.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0 max-w-5xl">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={() => navigate('/doctor/patients')}
          className="hover:text-primary transition-colors flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('patients.title')}
        </button>
        <span className="text-border">/</span>
        <span className="text-foreground font-medium">{patient.name}</span>
      </div>

      {/* ── Patient identity bar ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
            aria-hidden="true">
            <span className="text-base font-medium text-primary">{initials}</span>
          </div>
          <div>
            <h1 className="text-[22px] font-medium tracking-tight text-foreground leading-tight">
              {patient.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {patient.age} {t('dashboard.yrs')} · {c(`gender.${patient.gender.toUpperCase()}`) ?? (patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase())}
              · {t('patientDetail.patientSince')} {formatDate(patient.created_at)}
            </p>
            {/* Role + assignment badges */}
            {patient.assignments.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {patient.assignments
                  .filter(a => a.doctor_id === user?.user_id)
                  .map(a => {
                    const cfg = ROLE_CONFIG[a.role];
                    const RoleIcon = cfg?.icon ?? Shield;
                    return (
                      <span key={a.assignment_id}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg?.className ?? ''}`}>
                        <RoleIcon className="h-3 w-3" />
                        {t(`roles.${a.role}`) ?? a.role}
                      </span>
                    );
                  })
                }
                {isAssigned && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25">
                    <ShieldCheck className="h-3 w-3" /> {t('patientDetail.assigned')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary actions — only when assigned */}
        {isAssigned && (
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setLabOpen(true)}>
              <FlaskConical className="h-3.5 w-3.5" /> {t('patientDetail.orderLab')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={openAddVitals}>
              <Activity className="h-3.5 w-3.5" /> {t('patientDetail.addVitals')}
            </Button>
            <Button size="sm" className="gap-1.5 h-8 text-xs"
              onClick={() => navigate('/doctor/predictions/new', { state: { patientId: patient.patient_id } })}>
              <Brain className="h-3.5 w-3.5" /> {t('patientDetail.runAiPrediction')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Status strip — single line, highest severity wins ─────────────── */}
      {stripSev && (
        <div
          className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm mt-3 mb-2 rounded-r-lg ${STRIP_BG[stripSev]}`}
          style={{ borderLeft: `3px solid ${STRIP_BORDER[stripSev]}` }}
          role="status"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {/* Pulsing dot for CRITICAL */}
            {stripSev === 'critical' && (
              <span className="w-2 h-2 rounded-full bg-[#c0272d] animate-pulse shrink-0" aria-hidden="true" />
            )}

            {/* Not-assigned condition */}
            {!isAssigned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                <LockKeyhole className="h-3 w-3" /> {t('patientDetail.readOnlyAccess')}
              </span>
            )}

            {/* Risk level condition */}
            {patient.risk_level && patient.risk_score !== null && (
              <>
                {!isAssigned && <span className="text-border text-xs">·</span>}
                <div className="flex items-center gap-3">
                  <div className={`px-2.5 py-1 text-xs font-semibold ${RISK_STYLE[patient.risk_level]}`}>
                    {t(`riskLevels.${patient.risk_level.toLowerCase()}`)} {t('patientDetail.riskLabel', { defaultValue: 'risk' })}
                  </div>
                  <span className="text-sm font-medium" dir="ltr">
                    {Math.round(patient.risk_score * 100)}%
                  </span>
                </div>
                {/* Render the AI-generated message */}
                {patient.message_ar && patient.message_en && (
                  <p className="text-xs text-muted-foreground ml-1">
                    {localStorage.getItem('app_lang') === 'ar' ? patient.message_ar : patient.message_en}
                  </p>
                )}
              </>
            )}

            {/* Stale data condition */}
            {latestClinical?.is_stale && (
              <>
                {(patient.risk_level || !isAssigned) && <span className="text-border text-xs">·</span>}
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30">
                  <Clock className="h-3 w-3" />
                  {t('patientDetail.staleData', { time: timeAgo(latestClinical.recorded_at ?? latestClinical.created_at), defaultValue: `Stale data — ${timeAgo(latestClinical.recorded_at ?? latestClinical.created_at)}` })}
                </span>
              </>
            )}
          </div>

          {/* Strip CTA — update vitals link */}
          {isAssigned && latestClinical?.is_stale && (
            <button
              onClick={openAddVitals}
              className="text-[11px] font-medium text-primary hover:underline underline-offset-2 whitespace-nowrap shrink-0 transition-all"
            >
              {t('patientDetail.updateVitals')} →
            </button>
          )}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        {/* Sticky tab bar */}
        <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
          <TabsList className="flex items-center bg-card border border-border rounded-[var(--radius)] p-1.5 gap-1 h-auto shadow-sm w-full">
            <TabsTrigger value="overview"
              className="rounded-md text-sm h-9 px-4 border-b-0 mb-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-none hover:bg-muted/60">
              {t('patientDetail.tabs.overview')}
            </TabsTrigger>

            {/* Clinical Data + add action */}
            <div className="flex items-center gap-0.5">
              <TabsTrigger value="clinical"
                className="rounded-md text-sm h-9 px-4 border-b-0 mb-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-none hover:bg-muted/60">
                {t('patientDetail.tabs.clinicalData')}
                {patient.clinicalData.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-current/10 data-[state=active]:bg-white/20">
                    {patient.clinicalData.length}
                  </span>
                )}
              </TabsTrigger>
              {isAssigned && (
                <button
                  className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-all text-xs shrink-0"
                  title="Add clinical record"
                  aria-label="Add new clinical record"
                  onClick={(e) => { e.stopPropagation(); openAddVitals(); }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Lab Tests + order action */}
            <div className="flex items-center gap-0.5">
              <TabsTrigger value="lab"
                className="rounded-md text-sm h-9 px-4 border-b-0 mb-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-none hover:bg-muted/60">
                {t('patientDetail.tabs.labTests')}
                {patient.labTests.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {patient.labTests.length}
                  </span>
                )}
              </TabsTrigger>
              {isAssigned && (
                <button
                  className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-all text-xs shrink-0"
                  title="Order lab test"
                  aria-label="Order new lab test"
                  onClick={(e) => { e.stopPropagation(); setLabOpen(true); }}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Predictions + run AI action */}
            <div className="flex items-center gap-0.5">
              <TabsTrigger value="predictions"
                className="rounded-md text-sm h-9 px-4 border-b-0 mb-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-none hover:bg-muted/60">
                {t('patientDetail.tabs.predictions')}
                {predictions.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {predictions.length}
                  </span>
                )}
              </TabsTrigger>
              {isAssigned && (
                <button
                  className="h-5 px-1.5 rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-all text-[10px] font-medium shrink-0"
                  title="Run AI prediction"
                  aria-label="Run new AI prediction"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/doctor/predictions/new', { state: { patientId: patient.patient_id } });
                  }}
                >
                  AI
                </button>
              )}
            </div>

            <TabsTrigger value="care-team"
              className="rounded-md text-sm h-9 px-4 border-b-0 mb-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-transparent data-[state=active]:shadow-none hover:bg-muted/60">
              {t('patientDetail.tabs.careTeam')}
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {patient.assignments.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Patient info */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-muted-foreground" /> {t('patientDetail.patientInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {[
                      [t('patients.dialogs.fullName'),       patient.name],
                      [t('patients.dialogs.age'),        `${patient.age} ${t('dashboard.yrs')}`],
                      [t('patients.dialogs.gender'),     c(`gender.${patient.gender.toUpperCase()}`) ?? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase())],
                      [t('patientDetail.registered'), formatDate(patient.created_at)],
                    ].map(([label, val]) => (
                      <tr key={String(label)} className="border-b border-muted/40 last:border-0">
                        <td className="py-1.5 text-muted-foreground w-[42%]">{label}</td>
                        <td className="py-1.5 font-medium">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Vitals HUD — SIGNATURE ELEMENT */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm flex items-center gap-2 font-medium">
                  <Activity className="h-4 w-4 text-muted-foreground" /> {t('patientDetail.latestVitals')}
                  {latestClinical?.is_stale && (
                    <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> {t('patientDetail.stale')}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                {!latestClinical ? (
                  <p className="text-sm text-muted-foreground">{t('patientDetail.noVitalsRecorded')}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {latestClinical.vitals.temperature != null && (
                        <VitalChip
                          label={t('predictionDetail.vitals.temp')} unit="°C"
                          value={String(latestClinical.vitals.temperature)}
                          sev={vitalSev('temp', latestClinical.vitals.temperature)}
                        />
                      )}
                      {latestClinical.vitals.heart_rate != null && (
                        <VitalChip
                          label={t('predictionDetail.vitals.hr')} unit="bpm"
                          value={String(latestClinical.vitals.heart_rate)}
                          sev={vitalSev('hr', latestClinical.vitals.heart_rate)}
                        />
                      )}
                      {latestClinical.vitals.spo2 != null && (
                        <VitalChip
                          label={t('predictionDetail.vitals.spo2')} unit="%"
                          value={String(latestClinical.vitals.spo2)}
                          sev={vitalSev('spo2', latestClinical.vitals.spo2)}
                        />
                      )}
                      {latestClinical.vitals.blood_pressure_systolic != null && (
                        <VitalChip
                          label={t('predictionDetail.vitals.bp')} unit=""
                          value={`${latestClinical.vitals.blood_pressure_systolic}/${latestClinical.vitals.blood_pressure_diastolic}`}
                          sev={vitalSev('bp_sys', latestClinical.vitals.blood_pressure_systolic)}
                        />
                      )}
                      {!latestClinical.vitals.temperature &&
                       !latestClinical.vitals.heart_rate &&
                       !latestClinical.vitals.spo2 &&
                       !latestClinical.vitals.blood_pressure_systolic && (
                        <p className="text-xs text-muted-foreground col-span-2">{t('patientDetail.noVitalsInEntry')}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('predictionDetail.observed')} {timeAgo(latestClinical.recorded_at ?? latestClinical.created_at)}
                      {latestClinical.visit_date && ` · ${t('predictionDetail.visit')} ${latestClinical.visit_date}`}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Symptoms — shown when latestClinical has symptoms */}
          {latestClinical && Array.isArray(latestClinical.symptoms) && latestClinical.symptoms.length > 0 && (
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" /> {t('predictionDetail.reportedSymptoms')}
                  <span className="text-xs font-normal text-muted-foreground ml-1">{t('patientDetail.fromLatestRecord')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {latestClinical.symptoms.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Clinical Data ──────────────────────────────────────────────────── */}
        <TabsContent value="clinical" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {patient.clinicalData.length} {t('patientDetail.records')} — {t('patientDetail.newestFirst')}.
              {patient.clinicalData.some(r => r.is_stale) && (
                <span className="text-[#a2680a] ml-2">{t('patientDetail.someRecordsStale')}</span>
              )}
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
              disabled={!isAssigned}
              title={!isAssigned ? t('patientDetail.joinTeamToAdd') : undefined}
              onClick={openAddVitals}>
              <Plus className="h-3.5 w-3.5" /> {t('patientDetail.newRecord')}
            </Button>
          </div>

          {patient.clinicalData.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Activity className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">{t('patientDetail.noClinicalDataYet')}</p>
              {isAssigned && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openAddVitals}>
                  <Plus className="h-3.5 w-3.5" /> {t('patientDetail.addFirstRecord')}
                </Button>
              )}
            </CardContent></Card>
          ) : patient.clinicalData.map((cd, idx) => (
            <Card key={cd.data_id} className={cd.is_stale ? 'border-[#faaf3a]/30' : ''}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {idx === 0 && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-none">{t('patientDetail.latest')}</Badge>
                    )}
                    {staleBadge(cd)}
                    {linkedBadge(cd)}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {cd.visit_date ?? formatDate(cd.recorded_at ?? cd.created_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {timeAgo(cd.recorded_at ?? cd.created_at)}
                    </span>
                  </div>
                  {isAssigned && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(cd)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { setDeleteClinId(cd.data_id); setDeleteTarget(cd); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2.5">
                  {cd.vitals.temperature    != null && <span className="text-muted-foreground">{t('predictionDetail.vitals.temp')}: <strong className="text-foreground">{cd.vitals.temperature}°C</strong></span>}
                  {cd.vitals.heart_rate     != null && <span className="text-muted-foreground">{t('predictionDetail.vitals.hr')}: <strong className="text-foreground">{cd.vitals.heart_rate} bpm</strong></span>}
                  {cd.vitals.spo2           != null && <span className="text-muted-foreground">{t('predictionDetail.vitals.spo2')}: <strong className="text-foreground">{cd.vitals.spo2}%</strong></span>}
                  {cd.vitals.blood_pressure_systolic != null && (
                    <span className="text-muted-foreground">{t('predictionDetail.vitals.bp')}: <strong className="text-foreground">{cd.vitals.blood_pressure_systolic}/{cd.vitals.blood_pressure_diastolic}</strong></span>
                  )}
                  {!cd.vitals.temperature && !cd.vitals.heart_rate && !cd.vitals.spo2 && !cd.vitals.blood_pressure_systolic && (
                    <span className="text-xs text-muted-foreground">{t('patientDetail.noVitalsInEntry')}</span>
                  )}
                </div>

                {Array.isArray(cd.symptoms) && cd.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cd.symptoms.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}

                {Number(cd.linked_prediction_count) > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Link className="h-3 w-3" />
                    {t('patientDetail.editsReflectedInHistory')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Lab Tests ──────────────────────────────────────────────────────── */}
        <TabsContent value="lab" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {patient.labTests.length} {t('patientDetail.orders')}
            </p>
            {isAssigned && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setLabOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('patientDetail.newOrder')}
              </Button>
            )}
          </div>

          {patient.labTests.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <FlaskConical className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">{t('patientDetail.noLabOrdersYet')}</p>
              {isAssigned && (
                <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setLabOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> {t('patientDetail.orderFirstTest')}
                </Button>
              )}
            </CardContent></Card>
          ) : patient.labTests.map(lt => (
            <Card key={lt.test_id}
              className={lt.status === 'COMPLETED' ? 'cursor-pointer hover:border-primary/30 transition-all' : ''}
              onClick={() => lt.status === 'COMPLETED' && handleOpenResults(lt)}>
              <CardContent className="pt-4 pb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{lt.test_type}</p>
                  {lt.notes && <p className="text-xs text-muted-foreground mt-0.5">{lt.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{t('patientDetail.ordered')} {formatDate(lt.ordered_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={`text-xs ${LAB_STATUS[lt.status] ?? ''}`}>
                    {t(`lab.${lt.status}`) ?? lt.status}
                  </Badge>
                  {lt.status === 'COMPLETED' && (
                    <span className="text-[10px] text-primary underline underline-offset-2">{t('patientDetail.viewResults')}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Predictions ──────────────────────────────────────────────────── */}
        <TabsContent value="predictions" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {predictions.length} {t('patientDetail.predictions')} — {t('patientDetail.newestFirst')}
            </p>
            {isAssigned && (
              <Button size="sm" className="gap-1.5 h-8 text-xs"
                onClick={() => navigate(`/doctor/predictions/new?patient_id=${patient.patient_id}`)}>
                <Brain className="h-3.5 w-3.5" /> {t('patientDetail.runPrediction')}
              </Button>
            )}
          </div>

          {predictions.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Brain className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">{t('patientDetail.noPredictionsYet')}</p>
              {isAssigned && (
                <Button size="sm" className="mt-3 gap-1.5"
                  onClick={() => navigate(`/doctor/predictions/new?patient_id=${patient.patient_id}`)}>
                  <Brain className="h-3.5 w-3.5" /> {t('patientDetail.runFirstPrediction')}
                </Button>
              )}
            </CardContent></Card>
          ) : predictions.map(pr => (
            <Card key={pr.request_id}
              className="cursor-pointer hover:border-primary/30 transition-all"
              onClick={() => navigate(`/doctor/predictions/${pr.request_id}`)}>
              <CardContent className="pt-4 pb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${RISK_STYLE[pr.risk_level] ?? ''}`}>{t(`patients.riskLevels.${pr.risk_level}`) ?? pr.risk_level}</Badge>
                    <span className="text-sm font-medium" dir="ltr">{Math.round(pr.risk_score * 100)}% {t('dashboard.score')}</span>
                    {pr.clinical_data_stale && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30">
                        <Clock className="h-2.5 w-2.5" /> {t('patientDetail.staleInput')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(pr.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant={pr.status === 'COMPLETED' ? 'default' : 'secondary'}
                  className="text-xs shrink-0">
                  {t(`predictions.${pr.status}`) ?? pr.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Care Team ────────────────────────────────────────────────────── */}
        <TabsContent value="care-team" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {patient.assignments.length} {t('patientDetail.activeMembersOnCareTeam')}
            </p>
            {isPrimary && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> {t('patientDetail.assignColleague')}
              </Button>
            )}
          </div>

          {patient.assignments.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">{t('patientDetail.noCareTeamMembers')}</p>
              <p className="text-xs mt-1">{t('patientDetail.noCareTeamMembersDesc')}</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {patient.assignments.map(a => {
                const cfg = ROLE_CONFIG[a.role];
                const RoleIcon = cfg?.icon ?? Shield;
                const isSelf = a.doctor_id === user?.user_id;
                const canDischarge = (isPrimary || isSelf) && a.role !== 'PRIMARY';

                return (
                  <Card key={a.assignment_id}>
                    <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-muted-foreground">
                            {a.doctor_name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {a.doctor_name}
                            {isSelf && <span className="text-muted-foreground text-xs ml-1.5">({t('patientDetail.you')})</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('patientDetail.assignedLabel')} {timeAgo(a.assigned_at)}
                            {a.notes && ` · ${a.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs gap-1 ${cfg?.className ?? ''}`}>
                          <RoleIcon className="h-3 w-3" /> {t(`roles.${a.role}`) ?? a.role}
                        </Badge>
                        {canDischarge && (
                          <Button variant="ghost" size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            disabled={discharging === a.assignment_id}
                            onClick={() => handleDischargeAssignment(a.assignment_id)}>
                            {discharging === a.assignment_id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : c('actions.remove')
                            }
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!isAssigned && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <UserPlus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">{t('patientDetail.notOnCareTeam')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('patientDetail.notOnCareTeamDesc')}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════════════════════
          ALL DIALOGS — UNCHANGED
      ════════════════════════════════════════════════════════════════════ */}

      {/* Lab Order Dialog */}
      <Dialog open={labOpen} onOpenChange={setLabOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('patientDetail.orderLabDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t('patientDetail.orderLabDialog.testType')}</Label>
              <Input placeholder={t('patientDetail.orderLabDialog.testTypePlaceholder')}
                value={labForm.test_type}
                onChange={e => setLabForm(p => ({ ...p, test_type: e.target.value }))}
                className={labErrors.test_type ? 'border-destructive' : ''} />
              {labErrors.test_type && <p className="text-xs text-destructive">{labErrors.test_type}</p>}
            </div>
            <div className="space-y-1">
              <Label>{t('patientDetail.orderLabDialog.assignTo')} <span className="text-muted-foreground text-xs">({c('labels.optional')})</span></Label>
              <Select value={labForm.assigned_to} onValueChange={val => setLabForm(p => ({ ...p, assigned_to: val }))}>
                <SelectTrigger><SelectValue placeholder={t('patientDetail.orderLabDialog.anyLabTechnician')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t('patientDetail.orderLabDialog.anyLabTechnician')}</SelectItem>
                  {labTechs.map(tech => (
                    <SelectItem key={tech.user_id} value={tech.user_id}>{tech.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('patientDetail.orderLabDialog.notes')} <span className="text-muted-foreground text-xs">({c('labels.optional')})</span></Label>
              <Input placeholder={t('patientDetail.orderLabDialog.notesPlaceholder')}
                value={labForm.notes}
                onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabOpen(false)}>{c('actions.cancel')}</Button>
            <Button onClick={handleLabOrder} disabled={savingLab} className="gap-2">
              {savingLab && <Loader2 className="h-4 w-4 animate-spin" />} {t('patientDetail.orderLabDialog.sendOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clinical Data Dialog */}
      <Dialog open={clinicOpen} onOpenChange={(open) => {
        if (!open) { setEditingClin(null); setClinErrors({}); }
        setClinicOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClin ? t('patientDetail.clinicalDialog.editTitle') : t('patientDetail.clinicalDialog.addTitle')}</DialogTitle>
          </DialogHeader>

          {editingClin && Number(editingClin.linked_prediction_count) > 0 && (
            <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 -mt-2 mb-1">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <Trans i18nKey="patientDetail.clinicalDialog.editWarning" t={t} values={{ count: editingClin.linked_prediction_count }}>
                  This record was used in {{count: editingClin.linked_prediction_count}} prediction(s).
                  Editing it will affect the data shown in those historical predictions.
                </Trans>
              </span>
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('predictionDetail.vitals.temp') + ' (°C)', key: 'temperature', placeholder: '37.5' },
                { label: t('predictionDetail.vitals.hr') + ' (bpm)', key: 'heart_rate',  placeholder: '80' },
                { label: t('predictionDetail.vitals.spo2') + ' (%)',          key: 'spo2',        placeholder: '98' },
                { label: t('patientDetail.clinicalDialog.bpSys'),       key: 'bp_sys',      placeholder: '120' },
                { label: t('patientDetail.clinicalDialog.bpDia'),      key: 'bp_dia',      placeholder: '80' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" placeholder={placeholder}
                    value={clinForm[key as keyof typeof clinForm] as string}
                    onChange={e => setClinForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label>{t('predictionDetail.reportedSymptoms')}</Label>
              <TagInput
                value={clinForm.symptoms}
                onChange={(tags) => setClinForm(p => ({ ...p, symptoms: tags }))}
                placeholder={t('patientDetail.clinicalDialog.symptomPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('patientDetail.clinicalDialog.symptomHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t('patientDetail.clinicalDialog.observedAt')}</Label>
                <Input type="datetime-local" value={clinForm.recorded_at}
                  onChange={e => setClinForm(p => ({ ...p, recorded_at: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> {t('patientDetail.clinicalDialog.visitDate')}</Label>
                <Input type="date" value={clinForm.visit_date}
                  onChange={e => setClinForm(p => ({ ...p, visit_date: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClinicOpen(false)}>{c('actions.cancel')}</Button>
            <Button onClick={handleClinicalData} disabled={savingClin} className="gap-2">
              {savingClin && <Loader2 className="h-4 w-4 animate-spin" />} {c('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteClinId !== null}
        onOpenChange={(open) => { if (!open) { setDeleteClinId(null); setDeleteTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('patientDetail.archiveDialog.title')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <Trans i18nKey="patientDetail.archiveDialog.desc" t={t} values={{ name: patient.name }}>
              This record will be <strong>archived</strong> (soft-deleted) and removed from future predictions for <strong>{{name: patient.name}}</strong>.
            </Trans>
          </p>
          {deleteTarget && Number(deleteTarget.linked_prediction_count) > 0 && (
            <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <Trans i18nKey="patientDetail.archiveDialog.warning" t={t} values={{ count: deleteTarget.linked_prediction_count }}>
                  This record was used in {{count: deleteTarget.linked_prediction_count}} completed prediction(s).
                  Those historical records will be preserved but marked as referencing an archived snapshot.
                </Trans>
              </span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteClinId(null); setDeleteTarget(null); }}>{c('actions.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteClinicalData} disabled={deletingClin} className="gap-2">
              {deletingClin && <Loader2 className="h-4 w-4 animate-spin" />} {t('patientDetail.archiveDialog.archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Colleague Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('patientDetail.assignDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t('patientDetail.assignDialog.doctor')}</Label>
              <Select value={assignForm.doctor_id} onValueChange={v => setAssignForm(p => ({ ...p, doctor_id: v }))}>
                <SelectTrigger className={assignErrors.doctor_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder={t('patientDetail.assignDialog.selectDoctor')} />
                </SelectTrigger>
                <SelectContent>
                  {orgDoctors.filter(d =>
                    !patient.assignments.some(a => a.doctor_id === d.user_id)
                  ).map(d => (
                    <SelectItem key={d.user_id} value={d.user_id}>{d.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignErrors.doctor_id && <p className="text-xs text-destructive">{assignErrors.doctor_id}</p>}
            </div>

            <div className="space-y-1">
              <Label>{t('patientDetail.assignDialog.role')}</Label>
              <Select value={assignForm.role} onValueChange={v => setAssignForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSULTING">{t('patientDetail.assignDialog.consultingDesc')}</SelectItem>
                  <SelectItem value="COVERING">{t('patientDetail.assignDialog.coveringDesc')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignForm.role === 'COVERING' && (
              <div className="space-y-1">
                <Label>{t('patientDetail.assignDialog.validUntil')}</Label>
                <Input type="datetime-local" value={assignForm.valid_until}
                  onChange={e => setAssignForm(p => ({ ...p, valid_until: e.target.value }))}
                  className={assignErrors.valid_until ? 'border-destructive' : ''} />
                {assignErrors.valid_until && <p className="text-xs text-destructive">{assignErrors.valid_until}</p>}
              </div>
            )}

            <div className="space-y-1">
              <Label>{t('patientDetail.orderLabDialog.notes')} <span className="text-muted-foreground text-xs">({c('labels.optional')})</span></Label>
              <Textarea
                placeholder={t('patientDetail.assignDialog.notesPlaceholder')}
                value={assignForm.notes}
                onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))}
                className="resize-none" rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>{c('actions.cancel')}</Button>
            <Button onClick={handleAssignColleague} disabled={assigning} className="gap-2">
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />} {c('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Lab Results Dialog */}
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('patientDetail.resultsDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {activeLabTest && (
              <div className="text-sm bg-muted/30 p-3 rounded-md border flex justify-between items-start">
                <div>
                  <p><strong>{t('patientDetail.resultsDialog.testType')}:</strong> {activeLabTest.test_type}</p>
                  <p><strong>{t('patientDetail.ordered')}:</strong> {formatDate(activeLabTest.ordered_at)}</p>
                </div>
                {activeLabTest.notes && <p className="text-muted-foreground max-w-sm text-right">{t('patientDetail.orderLabDialog.notes')}: {activeLabTest.notes}</p>}
              </div>
            )}

            {loadingResults ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : labResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t('patientDetail.resultsDialog.noResults')}</p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('patientDetail.resultsDialog.analyte')}</TableHead>
                      <TableHead>{t('patientDetail.resultsDialog.value')}</TableHead>
                      <TableHead>{t('patientDetail.resultsDialog.refRange')}</TableHead>
                      <TableHead>{t('patientDetail.resultsDialog.flag')}</TableHead>
                      <TableHead>{t('patientDetail.resultsDialog.status')}</TableHead>
                      <TableHead className="text-right">{t('patientDetail.resultsDialog.acknowledge')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labResults.map(r => {
                      const isAmended   = r.is_amended;
                      const isCorrected = r.original_result_id !== null;
                      return (
                        <TableRow key={r.result_id}
                          className={`${isAmended ? 'opacity-60 bg-muted/30' : ''} ${isCorrected ? 'bg-primary/5' : ''}`}>
                          <TableCell className={isAmended ? 'line-through' : ''}>
                            {r.analyte_name}
                            {r.sub_panel && <span className="block text-[10px] text-muted-foreground">{r.sub_panel}</span>}
                          </TableCell>
                          <TableCell className={isAmended ? 'line-through' : ''}>
                            {r.value} {r.unit_symbol}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {r.reference_low !== null && r.reference_high !== null ? `${r.reference_low} - ${r.reference_high}` : '—'}
                          </TableCell>
                          <TableCell>
                            {r.flag && (
                              <Badge variant="outline" className={`text-[10px] ${
                                r.flag === 'CRITICAL' ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : r.flag === 'ABNORMAL' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''
                              }`}>{r.flag}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAmended   && <Badge variant="secondary" className="text-[10px] bg-muted-foreground text-white">{t('patientDetail.resultsDialog.amended')}</Badge>}
                            {isCorrected && <Badge className="text-[10px] bg-primary text-primary-foreground">{t('patientDetail.resultsDialog.corrected')}</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAmended ? (
                              <span className="text-[10px] text-muted-foreground">{t('patientDetail.resultsDialog.archived')}</span>
                            ) : !['CRITICAL', 'ABNORMAL'].includes(r.flag ?? '') ? (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            ) : r.acknowledged_at ? (
                              <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {t('patientDetail.resultsDialog.ackd')}
                              </span>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => handleAcknowledgeResult(r.result_id)}>
                                {t('patientDetail.resultsDialog.acknowledge')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultsOpen(false)}>{c('actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
