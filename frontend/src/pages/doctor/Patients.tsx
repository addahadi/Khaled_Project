import { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Search, UserPlus, Users, ChevronRight,
  Loader2, Download, SortAsc,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient   from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { addPatientSchema, flattenZodErrors } from '@/api/schemas';
import { formatDate } from '@/lib/formatDate';
import { getRiskConfig } from '@/lib/riskConfig';

interface Patient {
  patient_id:  string;
  name:        string;
  age:         number;
  gender:      string;
  risk_status: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  risk_score:  number | null;
  created_at:  string;
  medical_history?: string;
}


const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];

export default function Patients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [search,     setSearch]     = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [sortOrder,  setSortOrder]  = useState('recent');
  const [addOpen,    setAddOpen]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [form, setForm] = useState({ name: '', age: '', gender: '', medical_history: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    ApiManager.execute({
      queryKey: ['doctor', 'patients'],
      endpoint: '/doctor/patients',
      onStart:   startLoading,
      onSuccess: (d) => setPatients((d as { patients: Patient[] }).patients),
      onFinal:   stopLoading,
    });
  }, [startLoading, stopLoading]);

  useEffect(() => { load(); }, [load]);

  let filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q);
    const matchRisk   = riskFilter === 'ALL' || p.risk_status === riskFilter;
    return matchSearch && matchRisk;
  });

  filtered.sort((a, b) => {
    if (sortOrder === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortOrder === 'name') return a.name.localeCompare(b.name);
    if (sortOrder === 'risk') {
      const r = { 'CRITICAL': 4, 'HIGH': 3, 'MODERATE': 2, 'LOW': 1, 'ALL': 0 };
      const sa = a.risk_status ? r[a.risk_status] || 0 : 0;
      const sb = b.risk_status ? r[b.risk_status] || 0 : 0;
      return sb - sa;
    }
    return 0;
  });

  const handleExportCSV = () => {
    const rows = [['Name', 'Age', 'Gender', 'Risk Level', 'Risk Score', 'Added Date']];
    patients.forEach(p => {
      rows.push([
        `"${p.name}"`,
        p.age.toString(),
        p.gender,
        p.risk_status || 'None',
        p.risk_score ? Math.round(p.risk_score * 100) + '%' : 'N/A',
        formatDate(p.created_at)
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        setForm({ name: '', age: '', gender: '', medical_history: '' });
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
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> New Patient
          </Button>
        </div>
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
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[160px] bg-background">
              <SortAsc className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Added</SelectItem>
              <SelectItem value="risk">Highest Risk</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>

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
                  {p.risk_status ? (() => {
                    const cfg = getRiskConfig(p.risk_status);
                    if (!cfg) return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
                    const RiskIcon = cfg.icon;
                    return (
                      <Badge className={`text-xs gap-1 ${cfg.badgeClass}`}>
                        <RiskIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    );
                  })() : (
                    <Badge variant="secondary" className="text-xs">No prediction</Badge>
                  )}
                  {p.risk_score !== null && (
                    <span className="text-xs text-muted-foreground">
                      Score: {Math.round(p.risk_score * 100)}%
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Added {formatDate(p.created_at)}
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

            <div className="space-y-1">
              <Label>Medical History (Optional)</Label>
              <Textarea
                placeholder="Prior conditions, known allergies..."
                value={form.medical_history}
                onChange={e => setForm(p => ({ ...p, medical_history: e.target.value }))}
                className="resize-none"
                rows={3}
              />
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
