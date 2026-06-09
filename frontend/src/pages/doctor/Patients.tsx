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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Patients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  // ── Scope toggle — persisted to localStorage ──────────────────────────────
  const [scope, setScope] = useState<Scope>(
    () => (localStorage.getItem(SCOPE_STORAGE_KEY) as Scope | null) ?? 'org',
  );

  const handleScopeChange = (val: Scope) => {
    setScope(val);
    localStorage.setItem(SCOPE_STORAGE_KEY, val);
    // Reset pagination when scope changes
    setPatients([]);
    setNextCursor(null);
  };

  // ── List state ────────────────────────────────────────────────────────────
  const [patients,    setPatients]    = useState<Patient[]>([]);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [totalCount,  setTotalCount]  = useState(0);
  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [riskFilter,  setRiskFilter]  = useState('ALL');
  const [sortOrder,   setSortOrder]   = useState('recent');
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Add patient dialog state ──────────────────────────────────────────────
  const [addOpen,  setAddOpen]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ name: '', age: '', gender: '', medical_history: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Data loading ──────────────────────────────────────────────────────────
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

  // ── Client-side filtering (risk + sort only — search is server-side) ──────
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

  // ── CSV export ────────────────────────────────────────────────────────────
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

  // ── Add patient ───────────────────────────────────────────────────────────
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
        // Reload from scratch so the new patient appears with its assignment
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
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-light">Patients</h1>
          <p className="text-muted-foreground text-sm">
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

      {/* ── Scope toggle ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => handleScopeChange('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            scope === 'mine'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          My Patients
        </button>
        <button
          onClick={() => handleScopeChange('org')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            scope === 'org'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          All Patients
        </button>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
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

      {/* ── Patient list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>

      ) : filtered.length === 0 && patients.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No patients match your current filters.</p>
            <Button size="sm" variant="outline" className="mt-3"
              onClick={() => { setSearch(''); setRiskFilter('ALL'); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>

      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            {scope === 'mine' ? (
              <>
                <p className="text-muted-foreground">No patients assigned to you yet.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Register a new patient or switch to All Patients to browse and join a care team.
                </p>
                <div className="flex justify-center gap-2 mt-3">
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
                <p className="text-muted-foreground">No patients yet.</p>
                <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Register first patient
                </Button>
              </>
            )}
          </CardContent>
        </Card>

      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => (
              <Card
                key={p.patient_id}
                className="cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => navigate(`/doctor/patients/${p.patient_id}`)}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-normal truncate">{p.name}</p>
                        {/* Show assignment badge only in org scope to communicate read-only status */}
                        {scope === 'org' && !p.is_assigned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">
                            View only
                          </span>
                        )}
                      </div>
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
                          <RiskIcon className="h-3 w-3" /> {cfg.label}
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

          {nextCursor && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => load(nextCursor)} disabled={loadingMore} className="gap-2">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Add Patient Dialog ─────────────────────────────────────────────── */}
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
              <Label>Medical History <span className="text-muted-foreground text-xs">(Optional)</span></Label>
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
