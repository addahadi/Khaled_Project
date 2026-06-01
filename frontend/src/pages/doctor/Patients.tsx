import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Search, UserPlus, Users, ChevronRight,
  AlertTriangle, Loader2,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { addPatientSchema, flattenZodErrors } from '@/api/schemas';

interface Patient {
  patient_id:  string;
  name:        string;
  age:         number;
  gender:      string;
  risk_status: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  risk_score:  number | null;
  created_at:  string;
}

const RISK_STYLE: Record<string, string> = {
  LOW:      'bg-green-100  text-green-800  border-green-200',
  MODERATE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH:     'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100    text-red-800    border-red-200',
};

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];

export default function Patients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [search,     setSearch]     = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [addOpen,    setAddOpen]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [form, setForm] = useState({ name: '', age: '', gender: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = () => {
    ApiManager.execute({
      queryKey: ['doctor', 'patients'],
      endpoint: '/doctor/patients',
      onStart:   startLoading,
      onSuccess: (d) => setPatients((d as { patients: Patient[] }).patients),
      onFinal:   stopLoading,
    });
  };

  useEffect(() => { load(); }, []);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q);
    const matchRisk   = riskFilter === 'ALL' || p.risk_status === riskFilter;
    return matchSearch && matchRisk;
  });

  const handleAdd = () => {
    const result = addPatientSchema.safeParse({
      name: form.name,
      age: form.age,
      gender: form.gender,
    });
    if (!result.success) { setFieldErrors(flattenZodErrors(result.error)); return; }
    setFieldErrors({});

    ApiManager.executeMutation({
      mutationFn: () =>
        apiClient.post('/doctor/patients', {
          name:   result.data.name,
          age:    result.data.age,
          gender: result.data.gender,
        }),
      invalidateKeys: [['doctor', 'patients']],
      onStart: () => setSaving(true),
      onSuccess: (_data, msg) => {
        toast({ title: 'Patient registered', description: msg });
        setAddOpen(false);
        setForm({ name: '', age: '', gender: '' });
        load();
      },
      onError: ({ message, fields }) => {
        if (fields) setFieldErrors(fields);
        else toast({ title: 'Error', description: message, variant: 'destructive' });
      },
      onFinal: () => setSaving(false),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
          <p className="text-muted-foreground text-sm">{patients.length} total patients</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> New Patient
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map(r => (
            <Button
              key={r}
              size="sm"
              variant={riskFilter === r ? 'default' : 'outline'}
              onClick={() => setRiskFilter(r)}
            >
              {r === 'ALL' ? 'All Risk' : r.charAt(0) + r.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 && patients.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No patients match your current filters.</p>
            <Button
              size="sm" variant="outline" className="mt-3"
              onClick={() => { setSearch(''); setRiskFilter('ALL'); }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No patients yet.</p>
            <Button
              size="sm" variant="outline" className="mt-3 gap-2"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Register first patient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <Card
              key={p.patient_id}
              className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
              onClick={() => navigate(`/doctor/patients/${p.patient_id}`)}
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.age} yrs · {p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>

                <div className="flex items-center justify-between mt-3">
                  {p.risk_status ? (
                    <Badge className={`text-xs ${RISK_STYLE[p.risk_status] ?? ''}`}>
                      {p.risk_status === 'CRITICAL' && (
                        <AlertTriangle className="mr-1 h-3 w-3" />
                      )}
                      {p.risk_status}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">No prediction</Badge>
                  )}
                  {p.risk_score !== null && (
                    <span className="text-xs text-muted-foreground">
                      Score: {Math.round(p.risk_score * 100)}%
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Added {new Date(p.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Patient Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Register New Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input
                placeholder="Ahmed Benali"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={fieldErrors.name ? 'border-destructive' : ''}
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Age</Label>
                <Input
                  type="number" min={0} max={150} placeholder="45"
                  value={form.age}
                  onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                  className={fieldErrors.age ? 'border-destructive' : ''}
                />
                {fieldErrors.age && <p className="text-xs text-destructive">{fieldErrors.age}</p>}
              </div>

              <div className="space-y-1">
                <Label>Gender</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v: string) => setForm(p => ({ ...p, gender: v }))}
                >
                  <SelectTrigger className={fieldErrors.gender ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map(g => (
                      <SelectItem key={g} value={g}>
                        {g.charAt(0) + g.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.gender && <p className="text-xs text-destructive">{fieldErrors.gender}</p>}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
