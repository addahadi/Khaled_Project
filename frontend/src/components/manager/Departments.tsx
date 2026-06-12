import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
 Dialog, DialogContent, DialogHeader, DialogTitle,
 DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
 Building2, Search, Plus, Loader2, Pencil, Trash2,
 ChevronDown, ChevronUp, Stethoscope, FlaskConical,
 Users, HeartPulse, Microscope, Pill, Brain, Baby,
 Bone, Eye, Ear, Activity, Thermometer, ShieldPlus,
 Truck, Dna, Syringe, ClipboardList, BedDouble,
 LayoutGrid,
} from 'lucide-react';
import apiClient from '@/api/apiClient';
import { queryClient } from '@/api/queryClientSetup';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import { useTranslation, Trans } from 'react-i18next';

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_OPTIONS: { name: string; label: string; Icon: React.ElementType }[] = [
 { name: 'Building2',  label: 'General',  Icon: Building2 },
 { name: 'Stethoscope',  label: 'Cardiology',  Icon: Stethoscope },
 { name: 'HeartPulse',  label: 'Cardio ICU',  Icon: HeartPulse },
 { name: 'Brain',  label: 'Neurology',  Icon: Brain },
 { name: 'Eye',  label: 'Ophthalmology', Icon: Eye },
 { name: 'Ear',  label: 'ENT',  Icon: Ear },
 { name: 'Bone',  label: 'Orthopedics',  Icon: Bone },
 { name: 'Baby',  label: 'Pediatrics',  Icon: Baby },
 { name: 'FlaskConical',  label: 'Laboratory',  Icon: FlaskConical },
 { name: 'Microscope',  label: 'Pathology',  Icon: Microscope },
 { name: 'Dna',  label: 'Genetics',  Icon: Dna },
 { name: 'Syringe',  label: 'Oncology',  Icon: Syringe },
 { name: 'Pill',  label: 'Pharmacy',  Icon: Pill },
 { name: 'Thermometer',  label: 'Emergency',  Icon: Thermometer },
 { name: 'Truck',  label: 'Trauma',  Icon: Truck },
 { name: 'Activity',  label: 'Radiology',  Icon: Activity },
 { name: 'ShieldPlus',  label: 'Immunology',  Icon: ShieldPlus },
 { name: 'BedDouble',  label: 'Inpatient',  Icon: BedDouble },
 { name: 'ClipboardList', label: 'Outpatient',  Icon: ClipboardList },
 { name: 'Users',  label: 'Administration',Icon: Users },
];

const iconMap: Record<string, React.ElementType> = Object.fromEntries(
 ICON_OPTIONS.map(o => [o.name, o.Icon])
);

function DeptIcon({ name, className }: { name?: string | null; className?: string }) {
 const Icon = (name && iconMap[name]) ? iconMap[name] : Building2;
 return <Icon className={className} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
 department_id: string;
 name:  string;
 icon:  string;
 created_at:  string;
}

interface Member {
 user_id:  string;
 username: string;
 email:  string;
 status:  string;
 role:  'DOCTOR' | 'LAB_TECH' | 'UNKNOWN';
}

// ─── Sub-component: Member list for one department ───────────────────────────

function DepartmentMembers({ departmentId }: { departmentId: string }) {
 const { t } = useTranslation('manager');
 const { t: c } = useTranslation('common');
 const [members, setMembers]  = useState<Member[] | null>(null);
 const [loading, setLoading]  = useState(true);
 const { toast } = useToast();

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 (apiClient.get(`/manager/departments/${departmentId}/members`) as Promise<{ members: Member[] }>)
 .then(res => { if (!cancelled) setMembers(res.members); })
 .catch(() => {
 if (!cancelled) {
 toast({ title: 'Error', description: 'Failed to load members.', variant: 'destructive' });
 setMembers([]);
 }
 })
 .finally(() => { if (!cancelled) setLoading(false); });
 return () => { cancelled = true; };
 }, [departmentId]);

 if (loading) {
 return (
 <div className="space-y-2 pt-2">
 {[1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
 </div>
 );
 }

 if (!members || members.length === 0) {
 return (
 <p className="text-sm text-muted-foreground py-3 text-center">
 {t('departments.noStaffAssigned')}
 </p>
 );
 }

 const doctors  = members.filter(m => m.role === 'DOCTOR');
 const labTechs = members.filter(m => m.role === 'LAB_TECH');

 return (
 <div className="pt-3 space-y-4">
 {doctors.length > 0 && (
 <div>
 <div className="flex items-center gap-1.5 mb-2">
 <Stethoscope className="h-3.5 w-3.5 text-primary" />
 <span className="text-xs font-normal text-primary uppercase tracking-wide">
 {t('departments.doctorsCount', { count: doctors.length })}
 </span>
 </div>
 <div className="flex flex-col w-full gap-1.5">
 {doctors.map(m => (
 <div
 key={m.user_id}
 className="flex items-center w-full gap-2 p-2 rounded-md bg-primary/5 border border-blue-500/10"
 >
 <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
 <Stethoscope className="h-3.5 w-3.5 text-primary" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-medium truncate">{m.username}</p>
 <p className="text-xs text-muted-foreground truncate">{m.email}</p>
 </div>
 <Badge
 variant={m.status === 'ACTIVE' ? 'default' : 'secondary'}
 className="ml-auto shrink-0 text-xs"
 >
 {t(`staff.status.${m.status}`) ?? m.status}
 </Badge>
 </div>
 ))}
 </div>
 </div>
 )}

 {labTechs.length > 0 && (
 <div>
 <div className="flex items-center gap-1.5 mb-2">
 <FlaskConical className="h-3.5 w-3.5 text-emerald-500" />
 <span className="text-xs font-normal text-emerald-500 uppercase tracking-wide">
 {t('departments.labTechsCount', { count: labTechs.length })}
 </span>
 </div>
 <div className="flex flex-col w-full gap-1.5">
 {labTechs.map(m => (
 <div
 key={m.user_id}
 className="flex items-center w-full gap-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/10"
 >
 <div className="h-7 w-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
 <FlaskConical className="h-3.5 w-3.5 text-emerald-500" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-medium truncate">{m.username}</p>
 <p className="text-xs text-muted-foreground truncate">{m.email}</p>
 </div>
 <Badge
 variant={m.status === 'ACTIVE' ? 'default' : 'secondary'}
 className="ml-auto shrink-0 text-xs"
 >
 {t(`staff.status.${m.status}`) ?? m.status}
 </Badge>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}

// ─── Icon Picker ─────────────────────────────────────────────────────────────

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
 const { t } = useTranslation('manager');
 return (
 <div>
 <p className="text-sm font-medium mb-2">{t('departments.departmentIcon')}</p>
 <div className="grid grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1">
 {ICON_OPTIONS.map(({ name, label, Icon }) => (
 <button
 key={name}
 type="button"
 title={label}
 onClick={() => onChange(name)}
 className={`
 flex flex-col items-center gap-1 p-2  border text-xs transition-all
 ${value === name
 ? 'border-primary bg-primary/10 text-primary'
 : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'}
 `}
 >
 <Icon className="h-5 w-5" />
 <span className="truncate w-full text-center leading-tight">{label}</span>
 </button>
 ))}
 </div>
 </div>
 );
}

// ─── Department Card ──────────────────────────────────────────────────────────

function DepartmentCard({
 dept,
 onEdit,
 onDelete,
}: {
 dept:  Department;
 onEdit:  (d: Department) => void;
 onDelete: (d: Department) => void;
}) {
 const { t } = useTranslation('manager');
 const { t: c } = useTranslation('common');
 const [expanded, setExpanded] = useState(false);

 return (
 <Card className="overflow-hidden transition-all duration-200 ">
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between gap-3">
 {/* Icon + name */}
 <div className="flex items-center gap-3 min-w-0">
 <div className="h-10 w-10  bg-primary/10 flex items-center justify-center shrink-0">
 <DeptIcon name={dept.icon} className="h-5 w-5 text-primary" />
 </div>
 <div className="min-w-0">
 <CardTitle className="text-base truncate">{dept.name}</CardTitle>
 <p className="text-xs text-muted-foreground mt-0.5">
 <Trans i18nKey="departments.created" t={t} values={{date: formatDate(dept.created_at)}}>Created {{date: formatDate(dept.created_at)}}</Trans>
 </p>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-1 shrink-0">
 <Button
 size="icon" variant="ghost"
 className="h-8 w-8 text-muted-foreground hover:text-foreground"
 onClick={() => onEdit(dept)}
 title={t('departments.actions.edit')}
 >
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 <Button
 size="icon" variant="ghost"
 className="h-8 w-8 text-muted-foreground hover:text-destructive"
 onClick={() => onDelete(dept)}
 title={t('departments.actions.delete')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 </CardHeader>

 <CardContent className="pt-0">
 <Button
 variant="ghost"
 size="sm"
 className="w-full justify-between text-muted-foreground hover:text-foreground -mx-1 px-1 h-8"
 onClick={() => setExpanded(e => !e)}
 >
 <span className="flex items-center gap-1.5 text-xs">
 <Users className="h-3.5 w-3.5" />
 {t('departments.actions.viewStaff')}
 </span>
 {expanded
 ? <ChevronUp className="h-3.5 w-3.5" />
 : <ChevronDown className="h-3.5 w-3.5" />}
 </Button>

 {expanded && <DepartmentMembers departmentId={dept.department_id} />}
 </CardContent>
 </Card>
 );
}

// ─── Department Form Dialog ───────────────────────────────────────────────────

function DepartmentDialog({
 open,
 onOpenChange,
 department,
 onSaved,
}: {
 open:  boolean;
 onOpenChange: (v: boolean) => void;
 department:  Department | null;  // null = create mode
 onSaved:  () => void;
}) {
 const { t } = useTranslation('manager');
 const { t: c } = useTranslation('common');
 const { toast } = useToast();
 const isEdit = Boolean(department);

 const [name, setName]  = useState('');
 const [icon, setIcon]  = useState('Building2');
 const [saving, setSaving] = useState(false);

 // Sync form when dialog opens
 useEffect(() => {
 if (open) {
 setName(department?.name ?? '');
 setIcon(department?.icon ?? 'Building2');
 }
 }, [open, department]);

 const handleSave = async () => {
 if (!name.trim()) return;
 setSaving(true);
 try {
 if (isEdit && department) {
 await apiClient.patch(`/manager/departments/${department.department_id}`, { name: name.trim(), icon });
 toast({ title: t('departments.dialogs.updated'), description: t('departments.dialogs.updatedDesc') });
 } else {
 await apiClient.post('/manager/departments', { name: name.trim(), icon });
 toast({ title: t('departments.dialogs.created'), description: t('departments.dialogs.createdDesc') });
 }
 // Bust the React Query cache so the next fetch is always fresh
 queryClient.invalidateQueries({ queryKey: ['manager', 'departments'] });
 onSaved();
 onOpenChange(false);
 } catch (err: any) {
 toast({ title: 'Error', description: err?.message ?? 'Something went wrong.', variant: 'destructive' });
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>{isEdit ? t('departments.dialogs.editDepartment') : t('departments.dialogs.addDepartment')}</DialogTitle>
 <DialogDescription>
 {isEdit ? t('departments.dialogs.editDesc') : t('departments.dialogs.createDesc')}
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-4 py-2">
 <div>
 <label className="text-sm font-medium">{t('departments.departmentName')}</label>
 <Input
 className="mt-1.5"
 placeholder={t('departments.placeholders.name')}
 value={name}
 onChange={e => setName(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleSave()}
 />
 </div>
 <IconPicker value={icon} onChange={setIcon} />
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
 {c('actions.cancel')}
 </Button>
 <Button onClick={handleSave} disabled={!name.trim() || saving}>
 {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
 {isEdit ? c('actions.save') : c('actions.create')}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Departments() {
 const { t } = useTranslation('manager');
 const { t: c } = useTranslation('common');
 const { toast } = useToast();
 const { isLoading, startLoading, stopLoading } = useDelayedLoading();

 const [departments, setDepartments] = useState<Department[]>([]);
 const [search, setSearch]  = useState('');

 // Dialog state
 const [dialogOpen, setDialogOpen]  = useState(false);
 const [editing, setEditing]  = useState<Department | null>(null);

 // Delete confirm
 const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
 const [deleting, setDeleting]  = useState(false);

 const loadDepartments = useCallback(() => {
 apiClient.get('/manager/departments')
 .then((data: any) => {
 setDepartments((data as { departments: Department[] }).departments);
 })
 .catch((err: any) => {
 toast({ title: 'Error', description: err?.message ?? 'Failed to load departments.', variant: 'destructive' });
 })
 .finally(() => {
 stopLoading();
 });
 }, [startLoading, stopLoading]);

 useEffect(() => { loadDepartments(); }, [loadDepartments]);

 const handleSaved = () => {
 // invalidateQueries is already called inside executeMutation; just reload.
 loadDepartments();
 };

 const handleDeleteConfirm = async () => {
 if (!deleteTarget) return;
 setDeleting(true);
 try {
 await apiClient.delete(`/manager/departments/${deleteTarget.department_id}`);
 toast({ title: t('departments.dialogs.deleted'), description: t('departments.dialogs.deletedDesc', { name: deleteTarget.name }) });
 // Bust the React Query cache so the reload fetches fresh data
 queryClient.invalidateQueries({ queryKey: ['manager', 'departments'] });
 setDeleteTarget(null);
 handleSaved();
 } catch (err: any) {
 toast({ title: 'Error', description: err?.message ?? 'Could not delete department.', variant: 'destructive' });
 } finally {
 setDeleting(false);
 }
 };

 const openCreate = () => { setEditing(null); setDialogOpen(true); };
 const openEdit  = (d: Department) => { setEditing(d); setDialogOpen(true); };

 const filtered = departments.filter(d =>
 d.name.toLowerCase().includes(search.toLowerCase())
 );

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[28px] font-light">{t('departments.title')}</h1>
 <p className="text-sm text-muted-foreground mt-0.5">
 {t('departments.subtitle')}
 </p>
 </div>
 <Button className="gap-2" onClick={openCreate}>
 <Plus className="h-4 w-4" /> {t('departments.addDepartment')}
 </Button>
 </div>

 {/* Search + stats */}
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 className="pl-8"
 placeholder={t('departments.searchPlaceholder')}
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <LayoutGrid className="h-4 w-4" />
 <span><Trans i18nKey="departments.totalDepartments" t={t} count={departments.length}>{{count: departments.length}} department(s) total</Trans></span>
 </div>
 </div>

 {/* Grid */}
 {isLoading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {[1,2,3].map(i => (
 <Card key={i}>
 <CardHeader className="pb-3">
 <div className="flex items-center gap-3">
 <Skeleton className="h-10 w-10 " />
 <div className="space-y-1 flex-1">
 <Skeleton className="h-4 w-32" />
 <Skeleton className="h-3 w-24" />
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <Skeleton className="h-8 w-full" />
 </CardContent>
 </Card>
 ))}
 </div>
 ) : filtered.length === 0 && search ? (
 <div className="text-center py-16 text-muted-foreground">
 <Search className="mx-auto h-10 w-10 mb-3 opacity-30" />
 <p className="font-medium">{t('departments.noMatch')}</p>
 <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
 {t('departments.clearSearch')}
 </Button>
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 <Building2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
 <p className="font-medium">{t('departments.noDepartments')}</p>
 <p className="text-sm mt-1">{t('departments.createFirst')}</p>
 <Button size="sm" className="mt-4 gap-2" onClick={openCreate}>
 <Plus className="h-4 w-4" /> {t('departments.addDepartment')}
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {filtered.map(dept => (
 <DepartmentCard
 key={dept.department_id}
 dept={dept}
 onEdit={openEdit}
 onDelete={setDeleteTarget}
 />
 ))}
 </div>
 )}

 {/* Create / Edit dialog */}
 <DepartmentDialog
 open={dialogOpen}
 onOpenChange={setDialogOpen}
 department={editing}
 onSaved={handleSaved}
 />

 {/* Delete confirmation */}
 <Dialog open={Boolean(deleteTarget)} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
 <DialogContent className="sm:max-w-sm">
 <DialogHeader>
 <DialogTitle>{t('departments.dialogs.deleteDepartment')}</DialogTitle>
 <DialogDescription>
 <Trans i18nKey="departments.dialogs.deleteWarning" t={t} components={{ strong: <strong /> }}>
 Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Staff assigned to this department will have their department cleared. This action cannot be undone.
 </Trans>
 </DialogDescription>
 </DialogHeader>
 <DialogFooter className="gap-2">
 <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
 {c('actions.cancel')}
 </Button>
 <Button
 variant="destructive"
 onClick={handleDeleteConfirm}
 disabled={deleting}
 >
 {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
 {c('actions.delete')}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
