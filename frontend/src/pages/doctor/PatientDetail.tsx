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
  Activity, Thermometer, Heart, Plus,
  AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import ApiManager  from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { labOrderSchema, clinicalDataSchema, flattenZodErrors } from '@/api/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PatientDetail {
  patient_id:   string; name: string; age: number;
  gender:       string; medical_history: Record<string, unknown>;
  risk_level:   string | null; risk_score: number | null;
  created_at:   string;
  clinicalData: ClinicalRecord[];
  labTests:     LabTest[];
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
  LOW:      'bg-green-100  text-green-800',
  MODERATE: 'bg-yellow-100 text-yellow-800',
  HIGH:     'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100    text-red-800',
};
const LAB_STATUS: Record<string, string> = {
  PENDING:    'bg-yellow-100 text-yellow-800',
  INPROGRESS: 'bg-blue-100   text-blue-800',
  COMPLETED:  'bg-green-100  text-green-800',
};

export default function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate       = useNavigate();
  const { toast }      = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [patient,     setPatient]     = useState<PatientDetail | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [labOpen,     setLabOpen]     = useState(false);
  const [clinicOpen,  setClinicOpen]  = useState(false);
  const [savingLab,   setSavingLab]   = useState(false);
  const [savingClin,  setSavingClin]  = useState(false);
  const [labErrors,   setLabErrors]   = useState<Record<string, string>>({});
  const [clinErrors,  setClinErrors]  = useState<Record<string, string>>({});

  // Lab order form
  const [labForm, setLabForm] = useState({ test_type: '', notes: '' });
  // Clinical data form
  const [clinForm, setClinForm] = useState({
    temperature: '', heart_rate: '', spo2: '',
    bp_sys: '', bp_dia: '', symptoms: '',
  });

  useEffect(() => {
    if (!patientId) return;
    ApiManager.execute({
      queryKey: ['doctor', 'patient', patientId],
      endpoint: `/doctor/patients/${patientId}`,
      onStart:   startLoading,
      onSuccess: (d) => setPatient((d as { patient: PatientDetail }).patient),
      onFinal:   stopLoading,
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

  // ── Submit clinical data ────────────────────────────────────────────────────
  const handleClinicalData = () => {
    const result = clinicalDataSchema.safeParse({
      ...clinForm,
      temperature: clinForm.temperature ? Number(clinForm.temperature) : undefined,
      heart_rate: clinForm.heart_rate ? Number(clinForm.heart_rate) : undefined,
      spo2: clinForm.spo2 ? Number(clinForm.spo2) : undefined,
      bp_sys: clinForm.bp_sys ? Number(clinForm.bp_sys) : undefined,
      bp_dia: clinForm.bp_dia ? Number(clinForm.bp_dia) : undefined,
      symptoms: clinForm.symptoms ? clinForm.symptoms.split(',').map(s => s.trim()) : [],
    });
    if (!result.success) { setClinErrors(flattenZodErrors(result.error)); return; }
    setClinErrors({});
    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/doctor/clinical-data', {
        patient_id: patientId,
        vitals: {
          temperature: result.data.temperature,
          heart_rate: result.data.heart_rate,
          spo2: result.data.spo2,
          blood_pressure_systolic: result.data.bp_sys,
          blood_pressure_diastolic: result.data.bp_dia,
        },
        symptoms: result.data.symptoms,
      }),
      invalidateKeys: [['doctor', 'patient', patientId!]],
      onStart: () => setSavingClin(true),
      onSuccess: (_d, msg) => {
        toast({ title: 'Clinical data saved', description: msg });
        setClinicOpen(false);
        setClinForm({ temperature: '', heart_rate: '', spo2: '', bp_sys: '', bp_dia: '', symptoms: '' });
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
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/doctor/patients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{patient.name}</h1>
            <p className="text-muted-foreground text-sm">
              {patient.age} yrs · {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setClinicOpen(true)}>
            <Activity className="h-4 w-4" /> Add Vitals
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setLabOpen(true)}>
            <FlaskConical className="h-4 w-4" /> Order Lab
          </Button>
          <Button size="sm" className="gap-2"
            onClick={() => navigate(`/doctor/predictions/new?patient_id=${patient.patient_id}`)}>
            <Brain className="h-4 w-4" /> Run AI Prediction
          </Button>
        </div>
      </div>

      {/* Risk banner */}
      {patient.risk_level && (
        <Card className={`border-l-4 ${
          patient.risk_level === 'CRITICAL' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/10'
          : patient.risk_level === 'HIGH'   ? 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/10'
          : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/10'
        }`}>
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className={`h-5 w-5 ${
              patient.risk_level === 'CRITICAL' ? 'text-red-500'
              : patient.risk_level === 'HIGH' ? 'text-orange-500' : 'text-yellow-500'
            }`} />
            <div>
              <p className="font-semibold text-sm">
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
                <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span className="font-medium">{new Date(patient.created_at).toLocaleDateString()}</span></div>
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
                        { icon: Thermometer, label: 'Temp',  val: latest.vitals.temperature   ? `${latest.vitals.temperature}°C` : null },
                        { icon: Heart,       label: 'HR',    val: latest.vitals.heart_rate     ? `${latest.vitals.heart_rate} bpm` : null },
                        { icon: Activity,    label: 'SpO2',  val: latest.vitals.spo2           ? `${latest.vitals.spo2}%` : null },
                        { icon: Activity,    label: 'BP',    val: latest.vitals.blood_pressure_systolic ? `${latest.vitals.blood_pressure_systolic}/${latest.vitals.blood_pressure_diastolic}` : null },
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
                </div>
                <div className="grid sm:grid-cols-4 gap-3 text-sm mb-3">
                  {cd.vitals.temperature     && <div><span className="text-muted-foreground">Temp: </span><strong>{cd.vitals.temperature}°C</strong></div>}
                  {cd.vitals.heart_rate      && <div><span className="text-muted-foreground">HR: </span><strong>{cd.vitals.heart_rate} bpm</strong></div>}
                  {cd.vitals.spo2            && <div><span className="text-muted-foreground">SpO2: </span><strong>{cd.vitals.spo2}%</strong></div>}
                  {cd.vitals.blood_pressure_systolic && (
                    <div><span className="text-muted-foreground">BP: </span>
                      <strong>{cd.vitals.blood_pressure_systolic}/{cd.vitals.blood_pressure_diastolic}</strong>
                    </div>
                  )}
                </div>
                {cd.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cd.symptoms.map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}
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
                    Ordered {new Date(lt.ordered_at).toLocaleDateString()}
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
              className="cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
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

      {/* ── Clinical Data Dialog ─────────────────────────────────────────────── */}
      <Dialog open={clinicOpen} onOpenChange={setClinicOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Clinical Data</DialogTitle></DialogHeader>
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
                    value={clinForm[key as keyof typeof clinForm]}
                    onChange={e => setClinForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Symptoms <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
              <Input placeholder="fever, cough, fatigue"
                value={clinForm.symptoms}
                onChange={e => setClinForm(p => ({ ...p, symptoms: e.target.value }))} />
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
    </div>
  );
}
