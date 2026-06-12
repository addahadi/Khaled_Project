import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Building2, Search, Plus, Loader2, Pencil, Trash2,
  ChevronDown, ChevronUp, Stethoscope, FlaskConical,
  Users, HeartPulse, Microscope, Pill, Brain, Baby,
  Bone, Eye, Ear, Activity, Thermometer, ShieldPlus,
  Truck, Dna, Syringe, ClipboardList, BedDouble, UserPlus,
} from 'lucide-react';
import apiClient from '@/api/apiClient';
import ApiManager from '@/api/ApiManager';
import { queryClient } from '@/api/queryClientSetup';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import { useTranslation, Trans } from 'react-i18next';

// ─── Icon registry ────────────────────────────────────────────────────────────
const ICON_OPTIONS: { name: string; label: string; Icon: React.ElementType }[] = [
  { name: 'Building2',     label: 'General',        Icon: Building2     },
  { name: 'Stethoscope',   label: 'Cardiology',     Icon: Stethoscope   },
  { name: 'HeartPulse',    label: 'Cardio ICU',     Icon: HeartPulse    },
  { name: 'Brain',         label: 'Neurology',      Icon: Brain         },
  { name: 'Eye',           label: 'Ophthalmology',  Icon: Eye           },
  { name: 'Ear',           label: 'ENT',            Icon: Ear           },
  { name: 'Bone',          label: 'Orthopedics',    Icon: Bone          },
  { name: 'Baby',          label: 'Pediatrics',     Icon: Baby          },
  { name: 'FlaskConical',  label: 'Laboratory',     Icon: FlaskConical  },
  { name: 'Microscope',    label: 'Pathology',      Icon: Microscope    },
  { name: 'Dna',           label: 'Genetics',       Icon: Dna           },
  { name: 'Syringe',       label: 'Oncology',       Icon: Syringe       },
  { name: 'Pill',          label: 'Pharmacy',       Icon: Pill          },
  { name: 'Thermometer',   label: 'Emergency',      Icon: Thermometer   },
  { name: 'Truck',         label: 'Trauma',         Icon: Truck         },
  { name: 'Activity',      label: 'Radiology',      Icon: Activity      },
  { name: 'ShieldPlus',    label: 'Immunology',     Icon: ShieldPlus    },
  { name: 'BedDouble',     label: 'Inpatient',      Icon: BedDouble     },
  { name: 'ClipboardList', label: 'Outpatient',     Icon: ClipboardList },
  { name: 'Users',         label: 'Administration', Icon: Users         },
];

const iconMap: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.name, o.Icon])
);

function DeptIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && iconMap[name]) ? iconMap[name] : Building2;
  return <Icon className={className} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Department { department_id: string; name: string; icon: string; created_at: string; }
interface Member { user_id: string; username: string; email: string; status: string; role: 'DOCTOR' | 'LAB_TECH' | 'UNKNOWN'; }

// ─── Members panel (lazy loaded) ──────────────────────────────────────────────
function DepartmentMembers({ departmentId }: { departmentId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation('manager');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (apiClient.get(`/manager/departments/${departmentId}/members`) as Promise<{ data: { members: Member[] } }>)
      .then(res => { if (!cancelled) setMembers(res.data.members); })
      .catch(() => { if (!cancelled) { toast({ title: t('departments.error'), description: t('departments.loadMembersError'), variant: 'destructive' }); setMembers([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [departmentId]);

  if (loading) return <div className="pt-3 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>;
  if (!members || members.length === 0) return <p className="text-xs text-muted-foreground py-3 text-center"><Trans i18nKey="departments.noStaffAssigned" t={t}>No staff assigned yet.</Trans></p>;

  const doctors  = members.filter(m => m.role === 'DOCTOR');
  const labTechs = members.filter(m => m.role === 'LAB_TECH');

  const MemberRow = ({ m, icon: Icon, accent }: { m: Member; icon: React.ElementType; accent: string }) => (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${accent}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{m.username}</p>
        <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
        m.status === 'ACTIVE'
          ? 'bg-[#00a89c]/10 text-[#007a71] border-[#00a89c]/25'
          : 'bg-muted text-muted-foreground border-border'
      }`}>{t(`staff.status.${m.status}`, { defaultValue: m.status })}</span>
    </div>
  );

  return (
    <div className="pt-3 space-y-4 border-t border-border mt-3">
      {doctors.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Stethoscope className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider"><Trans i18nKey="departments.doctorsCount" t={t} count={doctors.length}>Doctors ({{count: doctors.length}})</Trans></span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {doctors.map(m => <MemberRow key={m.user_id} m={m} icon={Stethoscope} accent="bg-primary/5 border-primary/10" />)}
          </div>
        </div>
      )}
      {labTechs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FlaskConical className="h-3 w-3 text-[#007a71]" />
            <span className="text-[10px] font-semibold text-[#007a71] uppercase tracking-wider"><Trans i18nKey="departments.labTechsCount" t={t} count={labTechs.length}>Lab Techs ({{count: labTechs.length}})</Trans></span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {labTechs.map(m => <MemberRow key={m.user_id} m={m} icon={FlaskConical} accent="bg-[#00a89c]/5 border-[#00a89c]/10" />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Icon Picker ──────────────────────────────────────────────────────────────
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('manager');
  return (
    <div>
      <p className="text-sm font-medium mb-2">{t('departments.departmentIcon')}</p>
      <div className="grid grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1">
        {ICON_OPTIONS.map(({ name, label, Icon }) => {
          const translatedLabel = t(`departments.icons.${name}`, { defaultValue: label });
          return (
            <button key={name} type="button" title={translatedLabel} onClick={() => onChange(name)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                value === name
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}>
              <Icon className="h-4 w-4" />
              <span className="truncate w-full text-center leading-tight text-[9px]">{translatedLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Department card ──────────────────────────────────────────────────────────
function DepartmentCard({ dept, onEdit, onDelete, onAssign }: {
  dept: Department; onEdit: (d: Department) => void;
  onDelete: (d: Department) => void; onAssign: (d: Department) => void;
}) {
  const { t } = useTranslation('manager');
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-md hover:border-primary/25 transition-all duration-150">
      <CardContent className="p-5">
        {/* Card header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <DeptIcon name={dept.icon} className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{dept.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('departments.created')} {formatDate(dept.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(dept)} title="Edit"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(dept)} title="Delete"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-3.5 w-3.5" />
            {expanded ? t('departments.hideMembers') : t('departments.viewMembers')}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onAssign(dept)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium transition-colors">
            <UserPlus className="h-3.5 w-3.5" /> {t('departments.assignStaff')}
          </button>
        </div>

        {expanded && <DepartmentMembers departmentId={dept.department_id} />}
      </CardContent>
    </Card>
  );
}

// ─── Department form dialog ───────────────────────────────────────────────────
function DepartmentDialog({ open, onOpenChange, department, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  department: Department | null; onSaved: () => void;
}) {
  const { t } = useTranslation('manager');
  const { t: c } = useTranslation('common');
  const { toast } = useToast();
  const isEdit = Boolean(department);
  const [name, setName]     = useState('');
  const [icon, setIcon]     = useState('Building2');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(department?.name ?? ''); setIcon(department?.icon ?? 'Building2'); }
  }, [open, department]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isEdit && department) {
        await apiClient.patch(`/manager/departments/${department.department_id}`, { name: name.trim(), icon });
        toast({ title: t('departments.dialogs.updated'), description: t('departments.dialogs.updateSuccess') });
      } else {
        await apiClient.post('/manager/departments', { name: name.trim(), icon });
        toast({ title: t('departments.dialogs.created'), description: t('departments.dialogs.createSuccess') });
      }
      queryClient.invalidateQueries({ queryKey: ['manager', 'departments'] });
      onSaved(); onOpenChange(false);
    } catch (err: any) {
      toast({ title: t('departments.error'), description: err?.message ?? t('departments.saveFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{isEdit ? t('departments.dialogs.editDepartment') : t('departments.dialogs.newDepartment')}</DialogTitle>
          <DialogDescription className="text-sm">{isEdit ? t('departments.dialogs.updateDesc') : t('departments.dialogs.createDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('departments.dialogs.nameLabel')}</label>
            <Input placeholder={t('departments.dialogs.namePlaceholder')} value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{c('actions.cancel')}</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? c('actions.save') : t('departments.dialogs.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign staff dialog ──────────────────────────────────────────────────────
function AssignStaffDialog({ open, onOpenChange, department, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  department: Department | null; onSaved: () => void;
}) {
  const { t } = useTranslation('manager');
  const { t: c } = useTranslation('common');
  const { toast } = useToast();
  const [allStaff,    setAllStaff]    = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (open && department) {
      setLoading(true);
      Promise.all([
        apiClient.get('/manager/staff') as Promise<{ data: { staff: Member[] } }>,
        apiClient.get(`/manager/departments/${department.department_id}/members`) as Promise<{ data: { members: Member[] } }>,
      ])
        .then(([staffRes, membersRes]) => {
          setAllStaff(staffRes.data.staff);
          setSelectedIds(new Set(membersRes.data.members.map(m => m.user_id)));
        })
        .catch(() => toast({ title: t('departments.error'), description: t('departments.loadStaffError'), variant: 'destructive' }))
        .finally(() => setLoading(false));
    }
  }, [open, department, toast]);

  const handleToggle = (userId: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n; });

  const handleSave = async () => {
    if (!department) return;
    setSaving(true);
    try {
      await apiClient.patch(`/manager/departments/${department.department_id}/members`, { user_ids: Array.from(selectedIds) });
      toast({ title: t('departments.dialogs.saved'), description: t('departments.dialogs.assignSuccess') });
      queryClient.invalidateQueries({ queryKey: ['manager', 'departments'] });
      onSaved(); onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to assign members.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const doctors  = allStaff.filter(m => m.role === 'DOCTOR');
  const labTechs = allStaff.filter(m => m.role === 'LAB_TECH');

  const StaffCheckbox = ({ m }: { m: Member }) => (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
      <Checkbox id={m.user_id} checked={selectedIds.has(m.user_id)} onCheckedChange={() => handleToggle(m.user_id)} />
      <label htmlFor={m.user_id} className="flex-1 cursor-pointer flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{m.username}</p>
          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
        </div>
        <span className={`ml-2 shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
          m.status === 'ACTIVE' ? 'bg-[#00a89c]/10 text-[#007a71] border-[#00a89c]/25' : 'bg-muted text-muted-foreground border-border'
        }`}>{t(`staff.status.${m.status}`, { defaultValue: m.status })}</span>
      </label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{t('departments.assignStaff')}</DialogTitle>
          <DialogDescription className="text-sm">
            <Trans i18nKey="departments.dialogs.assignDesc" t={t} components={{ strong: <strong /> }}>Select staff members for <strong>{department?.name}</strong>.</Trans>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 py-2">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : allStaff.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">{t('departments.noStaffFound')}</p>
          ) : (
            <>
              {doctors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('departments.doctors')}</p>
                  <div className="space-y-2">{doctors.map(m => <StaffCheckbox key={m.user_id} m={m} />)}</div>
                </div>
              )}
              {labTechs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('departments.labTechnicians')}</p>
                  <div className="space-y-2">{labTechs.map(m => <StaffCheckbox key={m.user_id} m={m} />)}</div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2 pt-3 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{c('actions.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('departments.dialogs.saveAssignments')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Departments() {
  const { t } = useTranslation('manager');
  const { t: c } = useTranslation('common');
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [departments,   setDepartments]   = useState<Department[]>([]);
  const [search,        setSearch]        = useState('');
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editing,       setEditing]       = useState<Department | null>(null);
  const [assignOpen,    setAssignOpen]    = useState(false);
  const [assignTarget,  setAssignTarget]  = useState<Department | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Department | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  const loadDepartments = useCallback(() => {
    ApiManager.execute({
      queryKey: ['manager', 'departments'],
      endpoint:  '/manager/departments',
      onStart:   startLoading,
      onSuccess: (d) => setDepartments((d as { departments: Department[] }).departments),
      onFinal:   stopLoading,
    });
  }, [startLoading, stopLoading]);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);

  const handleSaved = () => loadDepartments();

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/manager/departments/${deleteTarget.department_id}`);
      setDepartments(prev => prev.filter(d => d.department_id !== deleteTarget.department_id));
      toast({ title: c('actions.delete'), description: t('departments.dialogs.deleteSuccess', { name: deleteTarget.name }) });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: t('departments.error'), description: err?.message ?? t('departments.deleteFailed'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('departments.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('departments.departmentCount', { count: departments.length })}</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> {t('departments.newDepartment')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input className="pl-9" placeholder={t('departments.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Card grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36 w-full rounded-[var(--radius)]" />)}
        </div>
      ) : filtered.length === 0 && departments.length > 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{t('departments.noMatch')}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setSearch('')}>{t('departments.clearSearch')}</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{t('departments.noDepartments')}</p>
            <Button size="sm" className="mt-4 gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> {t('departments.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(dept => (
            <DepartmentCard
              key={dept.department_id} dept={dept}
              onEdit={d => { setEditing(d); setDialogOpen(true); }}
              onDelete={d => setDeleteTarget(d)}
              onAssign={d => { setAssignTarget(d); setAssignOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Department form dialog */}
      <DepartmentDialog open={dialogOpen} onOpenChange={setDialogOpen} department={editing} onSaved={handleSaved} />

      {/* Assign staff dialog */}
      <AssignStaffDialog open={assignOpen} onOpenChange={setAssignOpen} department={assignTarget} onSaved={handleSaved} />

      <Dialog open={deleteTarget !== null} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" /> {t('departments.dialogs.deleteDepartment')}
            </DialogTitle>
            <DialogDescription className="text-sm">
              <Trans i18nKey="departments.dialogs.deleteWarning" t={t} components={{ strong: <strong /> }}>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Staff members will be unassigned. This cannot be undone.</Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{c('actions.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {c('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
