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
  Activity, Thermometer, Heart, Plus, Pencil, Trash2,
  AlertTriangle, Loader2, Clock, Calendar, Link,
  Users, Shield, ShieldCheck, UserCheck, UserPlus,
  LockKeyhole,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { labOrderSchema, clinicalDataSchema, flattenZodErrors } from '@/api/schemas';
import { TagInput } from '@/components/ui/tag-input';
import { formatDate, timeAgo } from '@/lib/formatDate';

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
  LOW:      'bg-[#defbe6] text-[#24a148]',
  MODERATE: 'bg-[#fdf1da] text-[#a2680a]',
  HIGH:     'bg-[#fff2e8] text-[#ff832b]',
  CRITICAL: 'bg-[#fff1f1] text-[#da1e28]',
};
const LAB_STATUS: Record<string, string> = {
  PENDING:    'bg-[#fdf1da] text-[#a2680a]',
  INPROGRESS: 'bg-primary/10 text-primary',
  COMPLETED:  'bg-[#defbe6] text-[#24a148]',
};
const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; className: string }> = {
  PRIMARY:    { label: 'Primary',    icon: ShieldCheck, className: 'bg-primary/10 text-primary border-primary/20' },
  COVERING:   { label: 'Covering',   icon: Shield,      className: 'bg-orange-50 text-orange-700 border-orange-200' },
  CONSULTING: { label: 'Consulting', icon: UserCheck,   className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientDetail() {
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

  // Lab results
  const [resultsOpen,   setResultsOpen]   = useState(false);
  const [activeLabTest, setActiveLabTest] = useState<LabTest | null>(null);
  const [labResults,    setLabResults]    = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Lab order form
  const [labForm,  setLabForm]  = useState({ test_type: '', notes: '', assigned_to: 'any' });
  const [labTechs, setLabTechs] = useState<{user_id: string, username: string}[]>([]);

  // Clinical data form
  const [clinForm, setClinForm] = useState({
    temperature: '', heart_rate: '', spo2: '',
    bp_sys: '', bp_dia: '',
    symptoms:    [] as string[],
    recorded_at: '',
    visit_date:  '',
  });

  // ── Care team state ───────────────────────────────────────────────────────
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

    // Predictions: org-scoped, client-filter by patientId
    ApiManager.execute({
      queryKey: ['doctor', 'predictions', 'org'],
      endpoint: '/doctor/predictions?scope=org',
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

    // Org doctors for assign-colleague dialog
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
        className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
        <Clock className="h-2.5 w-2.5" /> Stale · {timeAgo(observedAt)}
      </span>
    );
  };

  const linkedBadge = (cd: ClinicalRecord) => {
    const count = Number(cd.linked_prediction_count);
    if (count === 0) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
        <Link className="h-2.5 w-2.5" /> Used in {count} prediction{count > 1 ? 's' : ''}
      </span>
    );
  };

  // ─── Loading / not found ──────────────────────────────────────────────────

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
  if (!patient) return (
    <div className="text-center py-16 text-muted-foreground">Patient not found.</div>
  );

  const latestClinical = patient.clinicalData[0] ?? null;
  const isAssigned     = patient.is_assigned;

  // Is the current user the PRIMARY for this patient?
  const isPrimary = patient.assignments.some(
    a => a.doctor_id === user?.user_id && a.role === 'PRIMARY',
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate('/doctor/patients')}
          className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Patients
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{patient.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-light">{patient.name}</h1>
            {isAssigned && (
              <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30">
                <ShieldCheck className="h-3 w-3" /> Assigned
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {patient.age} yrs · {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Write actions require assignment */}
          {isAssigned && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setLabOpen(true)}>
                <FlaskConical className="h-4 w-4" /> Order Lab
              </Button>
              <Button
                variant="outline" size="sm" className="gap-2"
                onClick={() => {
                  setEditingClin(null);
                  setClinForm({ temperature: '', heart_rate: '', spo2: '', bp_sys: '', bp_dia: '', symptoms: [], recorded_at: '', visit_date: '' });
                  setClinicOpen(true);
                }}
              >
                <Activity className="h-4 w-4" /> Add Vitals
              </Button>
              <Button
                size="sm" className="gap-2"
                onClick={() => navigate('/doctor/predictions/new', { state: { patientId: patient.patient_id } })}
              >
                <Brain className="h-4 w-4" /> Run AI Prediction
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Not-assigned banner ──────────────────────────────────────────────── */}
      {!isAssigned && (
        <Card className="border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/10">
          <CardContent className="py-3 flex items-center gap-3">
            <LockKeyhole className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-blue-800">Read-only access</p>
              <p className="text-xs text-blue-700">
                You are viewing this patient as an observer. You must be assigned by the primary doctor to gain write access.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk banner */}
      {patient.risk_level && (
        <Card className={`border-l-4 ${
          patient.risk_level === 'CRITICAL' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/10'
          : patient.risk_level === 'HIGH'   ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/10'
          : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/10'
        }`}>
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${
              patient.risk_level === 'CRITICAL' ? 'text-[#da1e28]'
              : patient.risk_level === 'HIGH'   ? 'text-[#ff832b]' : 'text-[#a2680a]'
            }`} />
            <div>
              <p className="font-normal text-sm">
                {patient.risk_level} Risk — Score:{' '}
                {patient.risk_score !== null ? `${Math.round(patient.risk_score * 100)}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Latest AI prediction result</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stale clinical data banner */}
      {latestClinical?.is_stale && (
        <Card className="border-l-4 border-l-yellow-400 bg-yellow-50 dark:bg-yellow-950/10">
          <CardContent className="py-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-medium text-sm text-yellow-800">Clinical data is stale</p>
              <p className="text-xs text-yellow-700">
                The latest observation is from {timeAgo(latestClinical.recorded_at ?? latestClinical.created_at)}.
                {isAssigned && ' Consider recording fresh vitals before running a new prediction.'}
              </p>
            </div>
            {isAssigned && (
              <Button size="sm" variant="outline" className="ml-auto shrink-0 border-yellow-300"
                onClick={() => setClinicOpen(true)}>
                Add Vitals
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clinical">
            Clinical Data
            {patient.clinicalData.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{patient.clinicalData.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="lab">
            Lab Tests
            {patient.labTests.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{patient.labTests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="predictions">
            Predictions
            {predictions.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{predictions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="care-team">
            Care Team
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {patient.assignments.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Patient Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['Name',       patient.name],
                  ['Age',        patient.age],
                  ['Gender',     patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()],
                  ['Registered', formatDate(patient.created_at)],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Latest Vitals
                  {latestClinical?.is_stale && <Clock className="h-3.5 w-3.5 text-yellow-500 ml-auto" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!latestClinical ? (
                  <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        { label: 'Temp',  val: latestClinical.vitals.temperature  ? `${latestClinical.vitals.temperature}°C` : null },
                        { label: 'HR',    val: latestClinical.vitals.heart_rate   ? `${latestClinical.vitals.heart_rate} bpm` : null },
                        { label: 'SpO2',  val: latestClinical.vitals.spo2         ? `${latestClinical.vitals.spo2}%` : null },
                        { label: 'BP',    val: latestClinical.vitals.blood_pressure_systolic
                            ? `${latestClinical.vitals.blood_pressure_systolic}/${latestClinical.vitals.blood_pressure_diastolic}` : null },
                      ].filter(x => x.val).map(({ label, val }) => (
                        <div key={label} className="flex flex-col">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Observed {timeAgo(latestClinical.recorded_at ?? latestClinical.created_at)}
                      {latestClinical.visit_date && ` · Visit ${latestClinical.visit_date}`}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Clinical Data ────────────────────────────────────────────────── */}
        <TabsContent value="clinical" className="mt-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">
              {patient.clinicalData.length} record{patient.clinicalData.length !== 1 ? 's' : ''} — newest first.
              {patient.clinicalData.some(r => r.is_stale) && (
                <span className="text-yellow-700 ml-2">Some records are stale (&gt;72h).</span>
              )}
            </p>
            <Button
              size="sm" variant="outline" className="gap-2"
              disabled={!isAssigned}
              title={!isAssigned ? 'Join the care team to add records' : undefined}
              onClick={() => {
                setEditingClin(null);
                setClinForm({ temperature: '', heart_rate: '', spo2: '', bp_sys: '', bp_dia: '', symptoms: [], recorded_at: '', visit_date: '' });
                setClinicOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New Record
            </Button>
          </div>

          {patient.clinicalData.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Activity className="mx-auto h-8 w-8 mb-2" />
              <p>No clinical data yet.</p>
              {isAssigned && (
                <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setClinicOpen(true)}>
                  <Plus className="h-4 w-4" /> Add First Record
                </Button>
              )}
            </CardContent></Card>
          ) : patient.clinicalData.map((cd, idx) => (
            <Card key={cd.data_id} className={cd.is_stale ? 'border-yellow-200' : ''}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {idx === 0 && (
                      <Badge className="text-xs bg-primary/10 text-primary border-none">Latest</Badge>
                    )}
                    {staleBadge(cd)}
                    {linkedBadge(cd)}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {cd.visit_date ?? formatDate(cd.recorded_at ?? cd.created_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Observed {timeAgo(cd.recorded_at ?? cd.created_at)}
                    </span>
                  </div>
                  {/* Edit/delete only when assigned */}
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

                <div className="grid sm:grid-cols-4 gap-3 text-sm mb-3">
                  {cd.vitals.temperature    && <div><span className="text-muted-foreground">Temp: </span><strong>{cd.vitals.temperature}°C</strong></div>}
                  {cd.vitals.heart_rate     && <div><span className="text-muted-foreground">HR: </span><strong>{cd.vitals.heart_rate} bpm</strong></div>}
                  {cd.vitals.spo2           && <div><span className="text-muted-foreground">SpO2: </span><strong>{cd.vitals.spo2}%</strong></div>}
                  {cd.vitals.blood_pressure_systolic && (
                    <div><span className="text-muted-foreground">BP: </span>
                      <strong>{cd.vitals.blood_pressure_systolic}/{cd.vitals.blood_pressure_diastolic}</strong>
                    </div>
                  )}
                  {!cd.vitals.temperature && !cd.vitals.heart_rate && !cd.vitals.spo2 && !cd.vitals.blood_pressure_systolic && (
                    <span className="text-xs text-muted-foreground col-span-4">No vitals recorded in this entry.</span>
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
                    Edits to this record will be reflected in the linked prediction history.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Lab Tests ──────────────────────────────────────────────────────── */}
        <TabsContent value="lab" className="mt-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-muted-foreground">
              {patient.labTests.length} order{patient.labTests.length !== 1 ? 's' : ''}
            </p>
            {isAssigned && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setLabOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Order
              </Button>
            )}
          </div>

          {patient.labTests.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <FlaskConical className="mx-auto h-8 w-8 mb-2" />
              <p>No lab orders yet.</p>
              {isAssigned && (
                <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setLabOpen(true)}>
                  <Plus className="h-4 w-4" /> Order First Test
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
                  <p className="text-xs text-muted-foreground mt-1">Ordered {formatDate(lt.ordered_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={`text-xs ${LAB_STATUS[lt.status] ?? ''}`}>{lt.status}</Badge>
                  {lt.status === 'COMPLETED' && <span className="text-[10px] text-muted-foreground underline underline-offset-2">View Results</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Predictions ──────────────────────────────────────────────────── */}
        <TabsContent value="predictions" className="mt-4 space-y-3">
          {predictions.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Brain className="mx-auto h-8 w-8 mb-2" />
              <p>No predictions yet.</p>
              {isAssigned && (
                <Button size="sm" className="mt-3 gap-2"
                  onClick={() => navigate(`/doctor/predictions/new?patient_id=${patient.patient_id}`)}>
                  <Brain className="h-4 w-4" /> Run First Prediction
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
                    <Badge className={`text-xs ${RISK_STYLE[pr.risk_level] ?? ''}`}>{pr.risk_level}</Badge>
                    <span className="text-sm font-medium">Score: {Math.round(pr.risk_score * 100)}%</span>
                    <span className="text-xs text-muted-foreground">· Confidence: {Math.round(pr.confidence * 100)}%</span>
                    {pr.clinical_data_stale && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                        <Clock className="h-2.5 w-2.5" /> stale data
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(pr.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={pr.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                  {pr.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Care Team ────────────────────────────────────────────────────── */}
        <TabsContent value="care-team" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {patient.assignments.length} active member{patient.assignments.length !== 1 ? 's' : ''} on this patient's care team.
            </p>
            {/* Only the PRIMARY can invite colleagues */}
            {isPrimary && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Assign Colleague
              </Button>
            )}
          </div>

          {patient.assignments.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8 mb-2" />
              <p>No care team members found.</p>
              <p className="text-xs mt-1">This may indicate the patient was created before the assignment system was introduced.</p>
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
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {a.doctor_name}
                            {isSelf && <span className="text-muted-foreground text-xs ml-1.5">(you)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assigned {timeAgo(a.assigned_at)}
                            {a.notes && ` · ${a.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs gap-1 ${cfg?.className ?? ''}`}>
                          <RoleIcon className="h-3 w-3" /> {cfg?.label ?? a.role}
                        </Badge>
                        {canDischarge && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                            disabled={discharging === a.assignment_id}
                            onClick={() => handleDischargeAssignment(a.assignment_id)}
                          >
                            {discharging === a.assignment_id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : 'Remove'
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

          {/* Not assigned: show prominent join CTA inside the tab too */}
          {!isAssigned && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <UserPlus className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">You are not on this care team</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  You must be assigned by the primary doctor to gain write access.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Lab Order Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={labOpen} onOpenChange={setLabOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Order Lab Test</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Test Type</Label>
              <Input placeholder="e.g. CBC, Blood Culture, Urinalysis"
                value={labForm.test_type}
                onChange={e => setLabForm(p => ({ ...p, test_type: e.target.value }))}
                className={labErrors.test_type ? 'border-destructive' : ''} />
              {labErrors.test_type && <p className="text-xs text-destructive">{labErrors.test_type}</p>}
            </div>
            <div className="space-y-1">
              <Label>Assign To <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={labForm.assigned_to} onValueChange={val => setLabForm(p => ({ ...p, assigned_to: val }))}>
                <SelectTrigger><SelectValue placeholder="Any Lab Technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Lab Technician</SelectItem>
                  {labTechs.map(tech => (
                    <SelectItem key={tech.user_id} value={tech.user_id}>{tech.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Clinical indication or special instructions"
                value={labForm.notes}
                onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabOpen(false)}>Cancel</Button>
            <Button onClick={handleLabOrder} disabled={savingLab} className="gap-2">
              {savingLab && <Loader2 className="h-4 w-4 animate-spin" />} Send Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clinical Data Dialog ─────────────────────────────────────────────── */}
      <Dialog open={clinicOpen} onOpenChange={(open) => {
        if (!open) { setEditingClin(null); setClinErrors({}); }
        setClinicOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClin ? 'Edit Clinical Record' : 'Record Clinical Data'}</DialogTitle>
          </DialogHeader>

          {editingClin && Number(editingClin.linked_prediction_count) > 0 && (
            <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 -mt-2 mb-1">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This record was used in {editingClin.linked_prediction_count} prediction(s).
                Editing it will affect the data shown in those historical predictions.
              </span>
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Temperature (°C)', key: 'temperature', placeholder: '37.5' },
                { label: 'Heart Rate (bpm)', key: 'heart_rate',  placeholder: '80' },
                { label: 'SpO2 (%)',          key: 'spo2',        placeholder: '98' },
                { label: 'BP Systolic',       key: 'bp_sys',      placeholder: '120' },
                { label: 'BP Diastolic',      key: 'bp_dia',      placeholder: '80' },
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
              <Label>Symptoms</Label>
              <TagInput
                value={clinForm.symptoms}
                onChange={(tags) => setClinForm(p => ({ ...p, symptoms: tags }))}
                placeholder="Type a symptom (e.g. Fever)…"
              />
              <p className="text-xs text-muted-foreground">Press Enter or comma to add.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Observed At</Label>
                <Input type="datetime-local" value={clinForm.recorded_at}
                  onChange={e => setClinForm(p => ({ ...p, recorded_at: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Visit Date</Label>
                <Input type="date" value={clinForm.visit_date}
                  onChange={e => setClinForm(p => ({ ...p, visit_date: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClinicOpen(false)}>Cancel</Button>
            <Button onClick={handleClinicalData} disabled={savingClin} className="gap-2">
              {savingClin && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────────── */}
      <Dialog open={deleteClinId !== null}
        onOpenChange={(open) => { if (!open) { setDeleteClinId(null); setDeleteTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Archive Clinical Record</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This record will be <strong>archived</strong> (soft-deleted) and removed from future predictions for{' '}
            <strong>{patient.name}</strong>.
          </p>
          {deleteTarget && Number(deleteTarget.linked_prediction_count) > 0 && (
            <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This record was used in {deleteTarget.linked_prediction_count} completed prediction(s).
                Those historical records will be preserved but marked as referencing an archived snapshot.
              </span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteClinId(null); setDeleteTarget(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteClinicalData} disabled={deletingClin} className="gap-2">
              {deletingClin && <Loader2 className="h-4 w-4 animate-spin" />} Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Colleague Dialog ───────────────────────────────────────────── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Colleague</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Doctor</Label>
              <Select value={assignForm.doctor_id} onValueChange={v => setAssignForm(p => ({ ...p, doctor_id: v }))}>
                <SelectTrigger className={assignErrors.doctor_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a doctor" />
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
              <Label>Role</Label>
              <Select value={assignForm.role} onValueChange={v => setAssignForm(p => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSULTING">Consulting — specialist opinion, limited scope</SelectItem>
                  <SelectItem value="COVERING">Covering — full access while you are away</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignForm.role === 'COVERING' && (
              <div className="space-y-1">
                <Label>Valid Until</Label>
                <Input type="datetime-local" value={assignForm.valid_until} onChange={e => setAssignForm(p => ({ ...p, valid_until: e.target.value }))}
                  className={assignErrors.valid_until ? 'border-destructive' : ''} />
                {assignErrors.valid_until && <p className="text-xs text-destructive">{assignErrors.valid_until}</p>}
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Reason for assignment or scope of consultation…"
                value={assignForm.notes}
                onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))}
                className="resize-none" rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignColleague} disabled={assigning} className="gap-2">
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Lab Results Dialog ───────────────────────────────────────────── */}
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lab Test Results</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {activeLabTest && (
              <div className="text-sm bg-muted/30 p-3 rounded-md border flex justify-between items-start">
                <div>
                  <p><strong>Test Type:</strong> {activeLabTest.test_type}</p>
                  <p><strong>Ordered:</strong> {formatDate(activeLabTest.ordered_at)}</p>
                </div>
                {activeLabTest.notes && <p className="text-muted-foreground max-w-sm text-right">Notes: {activeLabTest.notes}</p>}
              </div>
            )}

            {loadingResults ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : labResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No results available yet.</p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Analyte</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Ref Range</TableHead>
                      <TableHead>Flag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acknowledge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labResults.map(r => {
                      const isAmended  = r.is_amended;
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
                            {isAmended   && <Badge variant="secondary" className="text-[10px] bg-muted-foreground text-white">Amended</Badge>}
                            {isCorrected && <Badge className="text-[10px] bg-primary text-primary-foreground">Corrected</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            {isAmended ? (
                              <span className="text-[10px] text-muted-foreground">Archived</span>
                            ) : r.acknowledged_at ? (
                              <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" /> Ack'd
                              </span>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => handleAcknowledgeResult(r.result_id)}>
                                Acknowledge
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
            <Button variant="outline" onClick={() => setResultsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
