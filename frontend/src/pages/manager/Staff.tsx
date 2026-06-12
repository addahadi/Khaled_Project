import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, MoreVertical, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { formatDate } from '@/lib/formatDate';
import InviteStaffDialog from '@/components/manager/InviteStaffDialog';
import EditStaffDialog from '@/components/manager/EditStaffDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation, Trans } from 'react-i18next';

interface StaffMember {
  user_id: string; username: string; email: string;
  role: 'DOCTOR' | 'LAB_TECH' | 'MANAGER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  department_id: string | null; department_name: string | null;
  created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  DOCTOR:   'bg-primary/10 text-primary border border-primary/20',
  LAB_TECH: 'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25',
  MANAGER:  'bg-[#2e368f]/10 text-[#2e368f] border border-[#2e368f]/20',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25',
  INACTIVE:  'bg-muted text-muted-foreground border border-border',
  SUSPENDED: 'bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20',
};

const ROLE_FILTERS = ['ALL', 'DOCTOR', 'LAB_TECH', 'MANAGER'];

export default function Staff() {
  const { t }     = useTranslation('manager');
  const { t: c }  = useTranslation('common');
  const { toast } = useToast();
  const { user }  = useAuth();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [staff,         setStaff]         = useState<StaffMember[]>([]);
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState('ALL');
  const [inviteOpen,    setInviteOpen]    = useState(false);
  const [updatingId,    setUpdatingId]    = useState<string | null>(null);
  const [editingStaff,  setEditingStaff]  = useState<StaffMember | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    userId: string; username: string; status: StaffMember['status'] | 'DELETE';
  } | null>(null);

  const loadStaff = useCallback(() => {
    ApiManager.execute({
      queryKey: ['manager', 'staff'],
      endpoint:  '/manager/staff',
      onStart:   startLoading,
      onSuccess: (d) => setStaff((d as { staff: StaffMember[] }).staff),
      onFinal:   stopLoading,
    });
  }, [startLoading, stopLoading]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const updateStatus = (userId: string, status: StaffMember['status']) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch(`/manager/staff/${userId}/status`, { status }),
      invalidateKeys: [['manager', 'staff'], ['manager', 'reports']],
      onStart:   () => setUpdatingId(userId),
      onSuccess: (_d, msg) => {
        setStaff(prev => prev.map(m => m.user_id === userId ? { ...m, status } : m));
        toast({ title: t('staff.statusUpdated'), description: msg });
      },
      onError: ({ message }) => toast({ title: t('staff.error'), description: message, variant: 'destructive' }),
      onFinal: () => setUpdatingId(null),
    });
  };

  const deleteStaff = (userId: string) => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.delete(`/manager/staff/${userId}`),
      invalidateKeys: [['manager', 'staff'], ['manager', 'reports']],
      onStart:   () => setUpdatingId(userId),
      onSuccess: (_d, msg) => {
        setStaff(prev => prev.filter(m => m.user_id !== userId));
        toast({ title: t('staff.staffDeleted'), description: msg });
      },
      onError: ({ message }) => toast({ title: t('staff.error'), description: message, variant: 'destructive' }),
      onFinal: () => setUpdatingId(null),
    });
  };

  const filtered = staff.filter(m => {
    const q = search.toLowerCase();
    return (m.username.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      && (roleFilter === 'ALL' || m.role === roleFilter);
  });

  const actionLabel = confirmAction?.status === 'DELETE' ? c('actions.delete')
    : confirmAction?.status === 'SUSPENDED' ? t('staff.actions.suspend') : t('staff.actions.deactivate');
  const roleLabel = (role: string) => t(`staff.roles.${role}`, { defaultValue: role });
  const statusLabel = (status: string) => t(`staff.status.${status}`, { defaultValue: status });

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('staff.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('staff.teamCount', { count: staff.length })}</p>
        </div>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> {t('staff.inviteStaff')}
        </Button>
      </div>

      {/* Filter row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input className="pl-9" placeholder={t('staff.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-[var(--radius)]">
          {ROLE_FILTERS.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                roleFilter === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {roleLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {/* Table card */}
      <Card>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="px-5 py-4 space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 && staff.length > 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{t('staff.noMatch')}</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => { setSearch(''); setRoleFilter('ALL'); }}>
                {t('staff.clearFilters')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{t('staff.noStaff')}</p>
              <Button size="sm" className="mt-4 gap-2" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" /> {t('staff.inviteFirst')}
              </Button>
            </div>
          ) : (
            <>
              {/* Table head */}
              <div className="grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_1fr_40px] gap-3 px-5 py-2.5 border-b border-border bg-muted/30">
                {[t('staff.table.name'), t('staff.table.email'), t('staff.table.role'), t('staff.table.department'), t('staff.table.status'), t('staff.table.joined'), ''].map((h, i) => (
                  <span key={i} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
                ))}
              </div>
              {filtered.map((m, i) => (
                <div key={m.user_id}
                  className={`grid grid-cols-[2fr_2fr_1fr_1.5fr_1fr_1fr_40px] gap-3 items-center px-5 py-3 transition-colors hover:bg-muted/30 ${
                    i < filtered.length - 1 ? 'border-b border-border' : ''
                  }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                      {m.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{m.username}</span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${ROLE_BADGE[m.role] ?? ''}`}>
                    {roleLabel(m.role)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{m.department_name ?? '-'}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${STATUS_BADGE[m.status] ?? ''}`}>
                    {statusLabel(m.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={updatingId === m.user_id}>
                          {updatingId === m.user_id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <MoreVertical className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-40">
                        <DropdownMenuItem className="text-sm rounded-lg" onClick={() => setEditingStaff(m)}>{t('staff.actions.editProfile')}</DropdownMenuItem>
                        {m.status !== 'ACTIVE' && (
                          <DropdownMenuItem className="text-sm rounded-lg" onClick={() => updateStatus(m.user_id, 'ACTIVE')}>{t('staff.actions.activate')}</DropdownMenuItem>
                        )}
                        {m.user_id !== user?.user_id && m.status !== 'INACTIVE' && (
                          <DropdownMenuItem className="text-sm rounded-lg" onClick={() => setConfirmAction({ userId: m.user_id, username: m.username, status: 'INACTIVE' })}>{t('staff.actions.deactivate')}</DropdownMenuItem>
                        )}
                        {m.user_id !== user?.user_id && m.status !== 'SUSPENDED' && (
                          <DropdownMenuItem className="text-sm text-destructive rounded-lg" onClick={() => setConfirmAction({ userId: m.user_id, username: m.username, status: 'SUSPENDED' })}>{t('staff.actions.suspend')}</DropdownMenuItem>
                        )}
                        {m.user_id !== user?.user_id && (
                          <DropdownMenuItem className="text-sm text-destructive font-semibold rounded-lg" onClick={() => setConfirmAction({ userId: m.user_id, username: m.username, status: 'DELETE' })}>{c('actions.delete')}</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirm action dialog */}
      <Dialog open={confirmAction !== null} onOpenChange={o => { if (!o) setConfirmAction(null); }}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" /> {actionLabel} {t('staff.dialogs.staffMember')}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {confirmAction?.status === 'DELETE'
                ? <Trans i18nKey="staff.dialogs.deleteDesc" t={t} values={{ username: confirmAction?.username }} components={{ strong: <strong /> }}>Permanently delete <strong>{confirmAction?.username}</strong>? This cannot be undone.</Trans>
                : confirmAction?.status === 'SUSPENDED'
                ? <Trans i18nKey="staff.dialogs.suspendDesc" t={t} values={{ username: confirmAction?.username }} components={{ strong: <strong /> }}><strong>{confirmAction?.username}</strong> will immediately lose access. You can reverse this later.</Trans>
                : <Trans i18nKey="staff.dialogs.deactivateDesc" t={t} values={{ username: confirmAction?.username }} components={{ strong: <strong /> }}><strong>{confirmAction?.username}</strong>'s account will be set to inactive. You can reverse this later.</Trans>
              }
            </DialogDescription>
          </DialogHeader>
          {confirmAction?.status !== 'DELETE' && (
            <div className="space-y-1.5">
              <Label className="text-sm">{t('staff.dialogs.reason')} <span className="text-muted-foreground text-xs font-normal">({c('misc.optional')})</span></Label>
              <Textarea
                placeholder={confirmAction?.status === 'SUSPENDED' ? t('staff.dialogs.reasonSuspend') : t('staff.dialogs.reasonDeactivate')}
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                rows={2} className="resize-none text-sm"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmAction(null); setSuspendReason(''); }}>{c('actions.cancel')}</Button>
            <Button variant="destructive" disabled={updatingId === confirmAction?.userId}
              onClick={() => {
                if (!confirmAction) return;
                confirmAction.status === 'DELETE'
                  ? deleteStaff(confirmAction.userId)
                  : updateStatus(confirmAction.userId, confirmAction.status);
                setConfirmAction(null); setSuspendReason('');
              }}>
              {updatingId === confirmAction?.userId && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditStaffDialog open={editingStaff !== null} onClose={() => setEditingStaff(null)} onSaved={loadStaff} staff={editingStaff} />
      <InviteStaffDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onSent={loadStaff} />
    </div>
  );
}
