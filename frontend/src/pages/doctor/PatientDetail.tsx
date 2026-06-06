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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 ArrowLeft, User, FlaskConical, Brain,
 Activity, Thermometer, Heart, Plus, Pencil, Trash2,
 AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import ApiManager  from '@/api/ApiManager';
import apiClient  from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { labOrderSchema, clinicalDataSchema, flattenZodErrors } from '@/api/schemas';
import { TagInput } from '@/components/ui/tag-input';
import { formatDate } from '@/lib/formatDate';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PatientDetail {
 patient_id:  string; name: string; age: number;
 gender:  string; medical_history: Record<string, unknown>;
 risk_level:  string | null; risk_score: number | null;
 created_at:  string;
 clinicalData: ClinicalRecord[];
 labTests:  LabTest[];
}
interface ClinicalRecord {
 data_id: string;
 vitals:  { temperature?: number; heart_rate?: number; spo2?: number;
 blood_pressure_systolic?: number; blood_pressure_diastolic?: number };
 symptoms: string[];
 created_at: string;
}
interface LabTest {
 test_id: string; test_type: string; status: string;
 notes: string; ordered_at: string;
}
interface Prediction {
 request_id: string; risk_level: string; risk_score: number;
 confidence: number; status: string; created_at: string;
}

const RISK_STYLE: Record<string, string> = {
 LOW:  'bg-[#defbe6]  text-[#24a148]',
 MODERATE: 'bg-[#fdf1da] text-[#a2680a]',
 HIGH:  'bg-[#fff2e8] text-[#ff832b]',
 CRITICAL: 'bg-[#fff1f1]  text-[#da1e28]',
};
const LAB_STATUS: Record<string, string> = {
 PENDING:  'bg-[#fdf1da] text-[#a2680a]',
 INPROGRESS: 'bg-primary  text-primary',
 COMPLETED:  'bg-[#defbe6]  text-[#24a148]',
};

export default function PatientDetail() {
 const { patientId } = useParams<{ patientId: string }>();
 const navigate  = useNavigate();
 const { toast }  = useToast();
 const { isLoading, startLoading, stopLoading } = useDelayedLoading();

 const [patient,  setPatient]  = useState<PatientDetail | null>(null);
 const [predictions, setPredictions] = useState<Prediction[]>([]);
 const [labOpen,  setLabOpen]  = useState(false);
 const [clinicOpen,  setClinicOpen]  = useState(false);
 const [savingLab,  setSavingLab]  = useState(false);
 const [savingClin,  setSavingClin]  = useState(false);
 const [labErrors,  setLabErrors]  = useState<Record<string, string>>({});
 const [clinErrors,  setClinErrors]  = useState<Record<string, string>>({});
 const [editingClin, setEditingClin] = useState<ClinicalRecord | null>(null);
 const [deleteClinId, setDeleteClinId] = useState<string | null>(null);
 const [deletingClin, setDeletingClin] = useState(false);

 // Lab order form
 const [labForm, setLabForm] = useState({ test_type: '', notes: '' });
 // Clinical data form
 const [clinForm, setClinForm] = useState({
 temperature: '', heart_rate: '', spo2: '',
 bp_sys: '', bp_dia: '', symptoms: [] as string[],
 });

 useEffect(() => {
 if (!patientId) return;
 ApiManager.execute({
 queryKey: ['doctor', 'patient', patientId],
 endpoint: `/doctor/patients/${patientId}`,
 onStart:  startLoading,
 onSuccess: (d) => setPatient((d as { patient: PatientDetail }).patient),
 onFinal:  stopLoading,
 });
 ApiManager.execute({
 queryKey: ['doctor', 'predictions'],
 endpoint: '/doctor/predictions',
 onSuccess: (d) => {
 const all = (d as { predictions: (Prediction & { patient_id: string })[] }).predictions;
 setPredictions(all.filter(p => p.patient_id === patientId));
 },
 });
 }, [patientId]);

 // ── Submit lab order ────────────────────────────────────────────────────────
 const handleLabOrder = () => {
 const result = labOrderSchema.safeParse(labForm);
 if (!result.success) { setLabErrors(flattenZodErrors(result.error)); return; }
 setLabErrors({});
 ApiManager.executeMutation({
 mutationFn: () => apiClient.post('/doctor/lab-orders', {
 patient_id: patientId, test_type: result.data.test_type, notes: result.data.notes || undefined,
 }),
 invalidateKeys: [['doctor', 'patient', patientId!]],
 onStart: () => setSavingLab(true),
 onSuccess: (_d, msg) => {
 toast({ title: 'Lab order sent', description: msg });
 setLabOpen(false);
 setLabForm({ test_type: '', notes: '' });
 // Reload patient
 ApiManager.execute({
 queryKey: ['doctor', 'patient', patientId!],
 endpoint: `/doctor/patients/${patientId}`,
 onSuccess: (d) => setPatient((d as { patient: PatientDetail }).patient),
 });
 },
 onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
 onFinal:  () => setSavingLab(false),
 });
 };

 // ── Submit clinical data (add / edit) ───────────────────────────────────────
 const handleClinicalData = () => {
 // Validate form values as strings (schema expects strings)
 const result = clinicalDataSchema.safeParse(clinForm);
 if (!result.success) { setClinErrors(flattenZodErrors(result.error)); return; }
 setClinErrors({});

 // Parse numbers and symptoms after validation passes
 const toNum = (v: string | undefined) => v ? Number(v) : undefined;
 const vitals = {
 temperature: toNum(result.data.temperature),
 heart_rate: toNum(result.data.heart_rate),
 spo2: toNum(result.data.spo2),
 blood_pressure_systolic: toNum(result.data.bp_sys),
 blood_pressure_diastolic: toNum(result.data.bp_dia),
 };
 const symptoms = clinForm.symptoms;

 const isEdit = editingClin !== null;
 const mutationFn = isEdit
 ? () => apiClient.patch(`/doctor/clinical-data/${editingClin.data_id}`, { vitals, symptoms })
 : () => apiClient.post('/doctor/clinical-data', { patient_id: patientId, vitals, symptoms });

 ApiManager.executeMutation({
 mutationFn,
 invalidateKeys: [['doctor', 'patient', patientId!]],
 onStart: () => setSavingClin(true),
 onSuccess: (_d, msg) => {
 toast({ title: isEdit ? 'Clinical data updated' : 'Clinical data saved', description: msg });
 setClinicOpen(false);
 setEditingClin(null);
 setClinForm({ temperature: '', heart_rate: '', spo2: '', bp_sys: '', bp_dia: '', symptoms: [] });
 ApiManager.execute({
 queryKey: ['doctor', 'patient', patientId!],
 endpoint: `/doctor/patients/${patientId}`,
 onSuccess: (d) => setPatient((d as { patient: PatientDetail }).patient),
 });
 },
 onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
 onFinal:  () => setSavingClin(false),
 });
 };

 // ── Delete clinical data ────────────────────────────────────────────────────
 const handleDeleteClinicalData = () => {
 if (!deleteClinId) return;
 ApiManager.executeMutation({
 mutationFn: () => apiClient.delete(`/doctor/clinical-data/${deleteClinId}`),
 invalidateKeys: [['doctor', 'patient', patientId!]],
 onStart: () => setDeletingClin(true),
 onSuccess: (_d, msg) => {
 toast({ title: 'Deleted', description: msg });
 setDeleteClinId(null);
 ApiManager.execute({
 queryKey: ['doctor', 'patient', patientId!],
 endpoint: `/doctor/patients/${patientId}`,
 onSuccess: (d) => setPatient((d as { patient: PatientDetail }).patient),
 });
 },
 onError: ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
 onFinal:  () => setDeletingClin(false),
 });
 };

 if (isLoading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-32 w-full" />
 <Skeleton className="h-64 w-full" />
 </div>
 );
 }

 if (!patient) return (
 <div className="text-center py-16 text-muted-foreground">Patient not found.</div>
 );

 return (
 <div className="space-y-6 max-w-5xl">
 {/* Breadcrumb Navigation */}
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
 <button onClick={() => navigate('/doctor/patients')} className="hover:text-primary transition-colors flex items-center gap-1">
 <ArrowLeft className="h-4 w-4" /> Patients
 </button>
 <span>/</span>
 <span className="text-foreground font-medium">{patient.name}</span>
 </div>

 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex-1">
 <h1 className="text-[28px] font-light">{patient.name}</h1>
 <p className="text-muted-foreground text-sm">
 {patient.age} yrs · {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
 </p>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" size="sm" className="gap-2" onClick={() => setClinicOpen(true)}>
 <Activity className="h-4 w-4" /> Add Vitals
 </Button>
 <Button variant="outline" size="sm" className="gap-2" onClick={() => setLabOpen(true)}>
 <FlaskConical className="h-4 w-4" /> Order Lab
 </Button>
 <Button size="sm" className="gap-2"
 onClick={() => navigate('/doctor/predictions/new', { state: { patientId: patient.patient_id } })}>
 <Brain className="h-4 w-4" /> Run AI Prediction
 </Button>
 </div>
 </div>

 {/* Risk banner */}
 {patient.risk_level && (
 <Card className={`border-l-4 ${
 patient.risk_level === 'CRITICAL' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/10'
 : patient.risk_level === 'HIGH'  ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/10'
 : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/10'
 }`}>
 <CardContent className="py-3 flex items-center gap-3">
 <AlertTriangle className={`h-5 w-5 ${
 patient.risk_level === 'CRITICAL' ? 'text-[#da1e28]'
 : patient.risk_level === 'HIGH' ? 'text-[#ff832b]' : 'text-[#a2680a]'
 }`} />
 <div>
 <p className="font-normal text-sm">
 {patient.risk_level} Risk — Score: {patient.risk_score !== null
 ? `${Math.round(patient.risk_score * 100)}%` : '—'}
 </p>
 <p className="text-xs text-muted-foreground">Latest AI prediction result</p>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Tabs */}
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
 </TabsList>

 {/* ── Overview ─────────────────────────────────────────────────────── */}
 <TabsContent value="overview" className="mt-4">
 <div className="grid sm:grid-cols-2 gap-4">
 <Card>
 <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Patient Info</CardTitle></CardHeader>
 <CardContent className="space-y-2 text-sm">
 <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{patient.name}</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span className="font-medium">{patient.age}</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">Gender</span><span className="font-medium">{patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span className="font-medium">{formatDate(patient.created_at)}</span></div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Latest Vitals</CardTitle></CardHeader>
 <CardContent>
 {patient.clinicalData.length === 0 ? (
 <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>
 ) : (() => {
 const latest = patient.clinicalData[0];
 return (
 <div className="grid grid-cols-2 gap-2 text-sm">
 {[
 { icon: Thermometer, label: 'Temp',  val: latest.vitals.temperature  ? `${latest.vitals.temperature}°C` : null },
 { icon: Heart,  label: 'HR',  val: latest.vitals.heart_rate  ? `${latest.vitals.heart_rate} bpm` : null },
 { icon: Activity,  label: 'SpO2',  val: latest.vitals.spo2  ? `${latest.vitals.spo2}%` : null },
 { icon: Activity,  label: 'BP',  val: latest.vitals.blood_pressure_systolic ? `${latest.vitals.blood_pressure_systolic}/${latest.vitals.blood_pressure_diastolic}` : null },
 ].map(({ label, val }) => val ? (
 <div key={label} className="flex flex-col">
 <span className="text-xs text-muted-foreground">{label}</span>
 <span className="font-medium">{val}</span>
 </div>
 ) : null)}
 </div>
 );
 })()}
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 {/* ── Clinical Data ─────────────────────────────────────────────────── */}
 <TabsContent value="clinical" className="mt-4 space-y-3">
 {patient.clinicalData.length === 0 ? (
 <Card><CardContent className="py-10 text-center text-muted-foreground">
 <Activity className="mx-auto h-8 w-8 mb-2" />
 <p>No clinical data yet.</p>
 <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setClinicOpen(true)}>
 <Plus className="h-4 w-4" /> Add First Record
 </Button>
 </CardContent></Card>
 ) : patient.clinicalData.map(cd => (
 <Card key={cd.data_id}>
 <CardContent className="pt-4 pb-3">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs text-muted-foreground">
 {new Date(cd.created_at).toLocaleString()}
 </span>
 <div className="flex gap-1">
 <Button variant="ghost" size="icon" className="h-7 w-7"
 onClick={() => {
 setEditingClin(cd);
 setClinForm({
 temperature: cd.vitals.temperature?.toString() ?? '',
 heart_rate: cd.vitals.heart_rate?.toString() ?? '',
 spo2: cd.vitals.spo2?.toString() ?? '',
 bp_sys: cd.vitals.blood_pressure_systolic?.toString() ?? '',
 bp_dia: cd.vitals.blood_pressure_diastolic?.toString() ?? '',
 symptoms: Array.isArray(cd.symptoms) ? cd.symptoms : [],
 });
 setClinErrors({});
 setClinicOpen(true);
 }}>
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
 onClick={() => setDeleteClinId(cd.data_id)}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 <div className="grid sm:grid-cols-4 gap-3 text-sm mb-3">
 {cd.vitals.temperature  && <div><span className="text-muted-foreground">Temp: </span><strong>{cd.vitals.temperature}°C</strong></div>}
 {cd.vitals.heart_rate  && <div><span className="text-muted-foreground">HR: </span><strong>{cd.vitals.heart_rate} bpm</strong></div>}
 {cd.vitals.spo2  && <div><span className="text-muted-foreground">SpO2: </span><strong>{cd.vitals.spo2}%</strong></div>}
 {cd.vitals.blood_pressure_systolic && (
 <div><span className="text-muted-foreground">BP: </span>
 <strong>{cd.vitals.blood_pressure_systolic}/{cd.vitals.blood_pressure_diastolic}</strong>
 </div>
 )}
 </div>
 {(() => {
 const sx = Array.isArray(cd.symptoms) ? cd.symptoms : [];
 return sx.length > 0 ? (
 <div className="flex flex-wrap gap-1">
 {sx.map(s => (
 <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
 ))}
 </div>
 ) : null;
 })()}
 </CardContent>
 </Card>
 ))}
 </TabsContent>

 {/* ── Lab Tests ─────────────────────────────────────────────────────── */}
 <TabsContent value="lab" className="mt-4 space-y-3">
 {patient.labTests.length === 0 ? (
 <Card><CardContent className="py-10 text-center text-muted-foreground">
 <FlaskConical className="mx-auto h-8 w-8 mb-2" />
 <p>No lab orders yet.</p>
 <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setLabOpen(true)}>
 <Plus className="h-4 w-4" /> Order First Test
 </Button>
 </CardContent></Card>
 ) : patient.labTests.map(lt => (
 <Card key={lt.test_id}>
 <CardContent className="pt-4 pb-3 flex items-center justify-between">
 <div>
 <p className="font-medium text-sm">{lt.test_type}</p>
 {lt.notes && <p className="text-xs text-muted-foreground mt-0.5">{lt.notes}</p>}
 <p className="text-xs text-muted-foreground mt-1">
 Ordered {formatDate(lt.ordered_at)}
 </p>
 </div>
 <Badge className={`text-xs ${LAB_STATUS[lt.status] ?? ''}`}>{lt.status}</Badge>
 </CardContent>
 </Card>
 ))}
 </TabsContent>

 {/* ── Predictions ───────────────────────────────────────────────────── */}
 <TabsContent value="predictions" className="mt-4 space-y-3">
 {predictions.length === 0 ? (
 <Card><CardContent className="py-10 text-center text-muted-foreground">
 <Brain className="mx-auto h-8 w-8 mb-2" />
 <p>No predictions yet.</p>
 <Button size="sm" className="mt-3 gap-2"
 onClick={() => navigate(`/doctor/predictions/new?patient_id=${patient.patient_id}`)}>
 <Brain className="h-4 w-4" /> Run First Prediction
 </Button>
 </CardContent></Card>
 ) : predictions.map(pr => (
 <Card key={pr.request_id}
 className="cursor-pointer  hover:border-primary/30 transition-all"
 onClick={() => navigate(`/doctor/predictions/${pr.request_id}`)}>
 <CardContent className="pt-4 pb-3 flex items-center justify-between">
 <div>
 <div className="flex items-center gap-2">
 <Badge className={`text-xs ${RISK_STYLE[pr.risk_level] ?? ''}`}>
 {pr.risk_level}
 </Badge>
 <span className="text-sm font-medium">
 Score: {Math.round(pr.risk_score * 100)}%
 </span>
 <span className="text-xs text-muted-foreground">
 · Confidence: {Math.round(pr.confidence * 100)}%
 </span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 {new Date(pr.created_at).toLocaleString()}
 </p>
 </div>
 <Badge variant={pr.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
 {pr.status}
 </Badge>
 </CardContent>
 </Card>
 ))}
 </TabsContent>
 </Tabs>

 {/* ── Lab Order Dialog ─────────────────────────────────────────────────── */}
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
 <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
 <Input placeholder="Clinical indication or special instructions"
 value={labForm.notes}
 onChange={e => setLabForm(p => ({ ...p, notes: e.target.value }))} />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setLabOpen(false)}>Cancel</Button>
 <Button onClick={handleLabOrder} disabled={savingLab} className="gap-2">
 {savingLab && <Loader2 className="h-4 w-4 animate-spin" />}
 Send Order
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ── Clinical Data Dialog (Add / Edit) ──────────────────────────────────── */}
 <Dialog open={clinicOpen} onOpenChange={(open) => { if (!open) { setEditingClin(null); setClinErrors({}); } setClinicOpen(open); }}>
 <DialogContent className="max-w-md">
 <DialogHeader><DialogTitle>{editingClin ? 'Edit Clinical Data' : 'Record Clinical Data'}</DialogTitle></DialogHeader>
 <div className="space-y-3 py-2">
 <div className="grid grid-cols-2 gap-3">
 {[
 { label: 'Temperature (°C)', key: 'temperature', placeholder: '37.5' },
 { label: 'Heart Rate (bpm)', key: 'heart_rate',  placeholder: '80' },
 { label: 'SpO2 (%)',  key: 'spo2',  placeholder: '98' },
 { label: 'BP Systolic',  key: 'bp_sys',  placeholder: '120' },
 { label: 'BP Diastolic',  key: 'bp_dia',  placeholder: '80' },
 ].map(({ label, key, placeholder }) => (
 <div key={key} className="space-y-1">
 <Label className="text-xs">{label}</Label>
 <Input type="number" placeholder={placeholder}
 value={clinForm[key as keyof typeof clinForm]}
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
 <p className="text-xs text-muted-foreground">Press Enter or comma to add. Suggestions appear as you type.</p>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setClinicOpen(false)}>Cancel</Button>
 <Button onClick={handleClinicalData} disabled={savingClin} className="gap-2">
 {savingClin && <Loader2 className="h-4 w-4 animate-spin" />}
 Save
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ── Delete Clinical Data Confirmation ─────────────────────────────────── */}
 <Dialog open={deleteClinId !== null} onOpenChange={(open) => { if (!open) setDeleteClinId(null); }}>
 <DialogContent className="max-w-sm">
 <DialogHeader><DialogTitle>Delete Clinical Data</DialogTitle></DialogHeader>
 <p className="text-sm text-muted-foreground">
 Deleting this record will remove it from AI prediction inputs. Any future predictions
 for <strong>{patient.name}</strong> will no longer include this clinical snapshot.
 </p>
 <p className="text-sm text-destructive font-medium mt-2">
 This action cannot be undone.
 </p>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDeleteClinId(null)}>Cancel</Button>
 <Button variant="destructive" onClick={handleDeleteClinicalData} disabled={deletingClin} className="gap-2">
 {deletingClin && <Loader2 className="h-4 w-4 animate-spin" />}
 Delete
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
