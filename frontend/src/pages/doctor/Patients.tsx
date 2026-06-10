import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
  Loader2, Download, SortAsc, User, Building2,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient  from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { addPatientSchema, flattenZodErrors } from '@/api/schemas';
import { formatDate } from '@/lib/formatDate';
import { getRiskConfig } from '@/lib/riskConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  patient_id:           string;
  name:                 string;
  age:                  number;
  gender:               string;
  risk_status:          'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  risk_score:           number | null;
  created_at:           string;
  medical_history?:     string;
  clinical_data_status: 'FRESH' | 'STALE' | 'NO_DATA';
  is_assigned:          boolean;
}

type Scope = 'mine' | 'org';

const SCOPE_STORAGE_KEY = 'diaginfect_patient_scope';
const GENDER_OPTIONS    = ['MALE', 'FEMALE', 'OTHER'];

const RISK_FILTERS = [
  { value: 'ALL',      label: 'All Risk' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH',     label: 'High' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'LOW',      label: 'Low' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Patients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [scope, setScope] = useState<Scope>(
    () => (localStorage.getItem(SCOPE_STORAGE_KEY) as Scope | null) ?? 'org',
  );

  const handleScopeChange = (val: Scope) => {
    setScope(val);
    localStorage.setItem(SCOPE_STORAGE_KEY, val);
    setPatients([]);
    setNextCursor(null);
  };

  const [patients,    setPatients]    = useState<Patient[]>([]);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [totalCount,  setTotalCount]  = useState(0);
  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [riskFilter,  setRiskFilter]  = useState('ALL');
  const [sortOrder,   setSortOrder]   = useState('recent');
  const [loadingMore, setLoadingMore] = useState(false);

  const [addOpen,     setAddOpen]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState({ name: '', age: '', gender: '', medical_history: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback((cursor: string | null = null) => {
    const isLoadMore = !!cursor;
    const params     = new URLSearchParams();
    params.set('scope', scope);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (cursor)          params.set('cursor', cursor);

    ApiManager.execute({
      queryKey: ['doctor', 'patients', scope, debouncedSearch, cursor ?? ''],
      endpoint: `/doctor/patients?${params.toString()}`,
      onStart:   () => isLoadMore ? setLoadingMore(true) : startLoading(),
      onSuccess: (d) => {
        const data = d as { patients: Patient[]; next_cursor: string | null; total_count: number };
        setPatients(prev => isLoadMore ? [...prev, ...data.patients] : data.patients);
        setNextCursor(data.next_cursor);
        setTotalCount(data.total_count);
      },
      onFinal: () => isLoadMore ? setLoadingMore(false) : stopLoading(),
    });
  }, [scope, debouncedSearch, startLoading, stopLoading]);

  useEffect(() => {
    setPatients([]);
    setNextCursor(null);
    load();
  }, [load]);

  let filtered = patients.filter(p =>
    riskFilter === 'ALL' || p.risk_status === riskFilter,
  );

  filtered.sort((a, b) => {
    if (sortOrder === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortOrder === 'name')   return a.name.localeCompare(b.name);
    if (sortOrder === 'risk') {
      const r = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 } as Record<string, number>;
      return (r[b.risk_status ?? ''] ?? 0) - (r[a.risk_status ?? ''] ?? 0);
    }
    return 0;
  });

  const handleExportCSV = () => {
    const rows = [['Name', 'Age', 'Gender', 'Risk Level', 'Risk Score', 'Added Date']];
    patients.forEach(p => {
      rows.push([
        `"${p.name}"`, p.age.toString(), p.gender,
        p.risk_status || 'None',
        p.risk_score ? Math.round(p.risk_score * 100) + '%' : 'N/A',
        formatDate(p.created_at),
      ]);
    });
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAdd = () => {
    const result = addPatientSchema.safeParse({ name: form.name, age: form.age, gender: form.gender });
    if (!result.success) { setFieldErrors(flattenZodErrors(result.error)); return; }
    setFieldErrors({});

    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/doctor/patients', {
        name:   result.data.name,
        age:    result.data.age,
        gender: result.data.gender,
      }),
      invalidateKeys: [['doctor', 'patients']],
      onStart:   () => setSaving(true),
      onSuccess: (_data, msg) => {
        toast({ title: 'Patient registered', description: msg });
        setAddOpen(false);
        setForm({ name: '', age: '', gender: '', medical_history: '' });
        setPatients([]);
        setNextCursor(null);
        load();
      },
      onError: ({ message, fields }) => {
        if (fields) setFieldErrors(fields);
        else toast({ title: 'Error', description: message, variant: 'destructive' });
      },
      onFinal: () => setSaving(false),
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalCount} {scope === 'mine' ? 'assigned' : 'total'} patient{totalCount !== 1 ? 's' : ''}
          </p>
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

      {/* Scope toggle + filters row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

        {/* Scope pill toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-[var(--radius)] shrink-0">
          <button
            onClick={() => handleScopeChange('mine')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              scope === 'mine'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-3.5 w-3.5" /> My Patients
          </button>
          <button
            onClick={() => handleScopeChange('org')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              scope === 'org'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> All Patients
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Sort */}
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-[160px] bg-card shrink-0">
            <SortAsc className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently Added</SelectItem>
            <SelectItem value="risk">Highest Risk</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Risk filter chips */}
      <div className="flex gap-2 flex-wrap">
        {RISK_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setRiskFilter(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              riskFilter === value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Patient grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 w-full rounded-[var(--radius)]" />)}
        </div>

      ) : filtered.length === 0 && patients.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No matches found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search term.</p>
            <Button size="sm" variant="outline" className="mt-4"
              onClick={() => { setSearch(''); setRiskFilter('ALL'); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>

      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            {scope === 'mine' ? (
              <>
                <p className="text-sm font-medium text-foreground">No patients assigned yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Register a new patient or switch to All Patients to browse.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleScopeChange('org')}>
                    View All Patients
                  </Button>
                  <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Register Patient
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No patients yet</p>
                <Button size="sm" className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Register first patient
                </Button>
              </>
            )}
          </CardContent>
        </Card>

      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => {
              const cfg = getRiskConfig(p.risk_status);
              const RiskIcon = cfg?.icon;
              return (
                <Card
                  key={p.patient_id}
                  className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-150"
                  onClick={() => navigate(`/doctor/patients/${p.patient_id}`)}
                >
                  <CardContent className="p-4">
                    {/* Top row: avatar + name + chevron */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm text-foreground truncate">{p.name}</p>
                          {scope === 'org' && !p.is_assigned && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border shrink-0">
                              View only
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.age} yrs · {p.gender.charAt(0) + p.gender.slice(1).toLowerCase()}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    </div>

                    {/* Bottom row: risk badge + score */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      {cfg && RiskIcon ? (
                        <Badge className={`text-xs gap-1 ${cfg.badgeClass}`}>
                          <RiskIcon className="h-3 w-3" /> {cfg.label}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No prediction</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {p.risk_score !== null
                          ? `Score: ${Math.round(p.risk_score * 100)}%`
                          : formatDate(p.created_at)
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => load(nextCursor)} disabled={loadingMore} className="gap-2">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more patients
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Patient Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Register New Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Full Name</Label>
              <Input
                placeholder="e.g. Ahmed Benali"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Age</Label>
                <Input
                  type="number" min={0} max={150} placeholder="45"
                  value={form.age}
                  onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                  className={fieldErrors.age ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {fieldErrors.age && <p className="text-xs text-destructive">{fieldErrors.age}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Gender</Label>
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

            <div className="space-y-1.5">
              <Label className="text-sm">
                Medical History <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Prior conditions, known allergies…"
                value={form.medical_history}
                onChange={e => setForm(p => ({ ...p, medical_history: e.target.value }))}
                className="resize-none text-sm"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Register Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
