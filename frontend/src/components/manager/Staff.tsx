import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import InviteStaffDialog from '@/components/manager/InviteStaffDialog';

interface StaffMember {
 user_id:  string;
 username:  string;
 email:  string;
 role:  'DOCTOR' | 'LAB_TECH' | 'MANAGER';
 status:  'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
 department_name: string | null;
 created_at:  string;
}

const ROLE_BADGE: Record<string, string> = {
 DOCTOR:  'bg-primary text-primary',
 LAB_TECH: 'bg-primary text-primary',
 MANAGER:  'bg-violet-100 text-violet-800',
};

const STATUS_BADGE: Record<string, string> = {
 ACTIVE:  'bg-[#defbe6] text-[#24a148]',
 INACTIVE:  'bg-muted text-muted-foreground',
 SUSPENDED: 'bg-[#fff1f1] text-[#da1e28]',
};

export default function Staff() {
 const { toast } = useToast();
 const { isLoading, startLoading, stopLoading } = useDelayedLoading();

 const [staff, setStaff]  = useState<StaffMember[]>([]);
 const [search, setSearch]  = useState('');
 const [roleFilter, setRoleFilter] = useState('ALL');
 const [inviteOpen, setInviteOpen] = useState(false);
 const [updatingId, setUpdatingId] = useState<string | null>(null);
 const [confirmAction, setConfirmAction] = useState<{
 userId: string; username: string; status: StaffMember['status'];
 } | null>(null);
 const [suspendReason, setSuspendReason] = useState('');

 const loadStaff = useCallback(() => {
 ApiManager.execute({
 queryKey: ['manager', 'staff'],
 endpoint: '/manager/staff',
 onStart:  startLoading,
 onSuccess: (data: unknown) => setStaff((data as { staff: StaffMember[] }).staff),
 onFinal:  stopLoading,
 });
 }, [startLoading, stopLoading]);

 useEffect(() => { loadStaff(); }, [loadStaff]);

 const updateStatus = (userId: string, status: StaffMember['status']) => {
 ApiManager.executeMutation({
 mutationFn: () => apiClient.patch(`/manager/staff/${userId}/status`, { status }),
 invalidateKeys: [['manager', 'staff'], ['manager', 'reports']],
 onStart: () => setUpdatingId(userId),
 onSuccess: (_d: unknown, msg: string) => {
 setStaff(prev => prev.map(m => m.user_id === userId ? { ...m, status } : m));
 toast({ title: 'Status updated', description: msg });
 },
 onError: ({ message }: { message: string }) =>
 toast({ title: 'Error', description: message, variant: 'destructive' }),
 onFinal: () => setUpdatingId(null),
 });
 };

 const filtered = staff.filter(m => {
 const matchSearch =
 m.username.toLowerCase().includes(search.toLowerCase()) ||
 m.email.toLowerCase().includes(search.toLowerCase());
 const matchRole = roleFilter === 'ALL' || m.role === roleFilter;
 return matchSearch && matchRole;
 });

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h1 className="text-[28px] font-light">Staff Management</h1>
 {/* Invite button opens InviteStaffDialog */}
 <Button className="gap-2" onClick={() => setInviteOpen(true)}>
 <UserPlus className="h-4 w-4" /> Invite Staff
 </Button>
 </div>

 <Card>
 <CardHeader>
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <CardTitle className="text-base flex items-center gap-2">
 <Users className="h-4 w-4" /> All Staff
 <Badge variant="secondary">{filtered.length}</Badge>
 </CardTitle>
 <div className="flex gap-2 w-full sm:w-auto flex-wrap">
 <div className="relative flex-1 sm:w-56">
 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
 <Input
 className="pl-8"
 placeholder="Search name or email…"
 value={search}
 onChange={e => setSearch((e as React.ChangeEvent<HTMLInputElement>).target.value)}
 />
 </div>
 {['ALL', 'DOCTOR', 'LAB_TECH', 'MANAGER'].map(r => (
 <Button
 key={r}
 size="sm"
 variant={roleFilter === r ? 'default' : 'outline'}
 onClick={() => setRoleFilter(r)}
 >
 {r === 'ALL' ? 'All' : r === 'LAB_TECH' ? 'Lab Tech' : r.charAt(0) + r.slice(1).toLowerCase()}
 </Button>
 ))}
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {isLoading ? (
 <div className="space-y-2">
 {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
 </div>
 ) : filtered.length === 0 && staff.length > 0 ? (
 <div className="text-center py-10 text-muted-foreground">
 <Search className="mx-auto h-8 w-8 mb-2" />
 <p>No staff members match your filters.</p>
 <Button size="sm" variant="outline" className="mt-4" onClick={() => { setSearch(''); setRoleFilter('ALL'); }}>
 Clear Filters
 </Button>
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-10 text-muted-foreground">
 <Users className="mx-auto h-8 w-8 mb-2" />
 <p>No staff members found.</p>
 <Button
 size="sm" variant="outline" className="mt-3 gap-2"
 onClick={() => setInviteOpen(true)}
 >
 <UserPlus className="h-4 w-4" /> Invite your first team member
 </Button>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Name</TableHead>
 <TableHead>Email</TableHead>
 <TableHead>Role</TableHead>
 <TableHead>Department</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Joined</TableHead>
 <TableHead className="w-10" />
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.map(m => (
 <TableRow key={m.user_id}>
 <TableCell className="font-medium">{m.username}</TableCell>
 <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
 <TableCell>
 <Badge className={`text-xs ${ROLE_BADGE[m.role] ?? ''}`}>
 {m.role === 'LAB_TECH' ? 'Lab Tech' : m.role.charAt(0) + m.role.slice(1).toLowerCase()}
 </Badge>
 </TableCell>
 <TableCell className="text-muted-foreground text-sm">
 {m.department_name ?? '—'}
 </TableCell>
 <TableCell>
 <Badge className={`text-xs ${STATUS_BADGE[m.status] ?? ''}`}>
 {m.status}
 </Badge>
 </TableCell>
 <TableCell className="text-muted-foreground text-sm">
 {formatDate(m.created_at)}
 </TableCell>
 <TableCell>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" disabled={updatingId === m.user_id}>
 {updatingId === m.user_id ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <MoreVertical className="h-4 w-4" />
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 {m.status !== 'ACTIVE' && (
 <DropdownMenuItem onClick={() => updateStatus(m.user_id, 'ACTIVE')}>
 Activate
 </DropdownMenuItem>
 )}
 {m.status !== 'INACTIVE' && (
 <DropdownMenuItem onClick={() => setConfirmAction({
 userId: m.user_id, username: m.username, status: 'INACTIVE',
 })}>
 Deactivate
 </DropdownMenuItem>
 )}
 {m.status !== 'SUSPENDED' && (
 <DropdownMenuItem
 className="text-destructive"
 onClick={() => setConfirmAction({
 userId: m.user_id, username: m.username, status: 'SUSPENDED',
 })}
 >
 Suspend
 </DropdownMenuItem>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>

 {/* Staff status confirmation dialog (C5 fix) */}
 <Dialog
 open={confirmAction !== null}
 onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
 >
 <DialogContent className="max-w-sm">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 {confirmAction?.status === 'SUSPENDED' ? 'Suspend' : 'Deactivate'} Staff Member
 </DialogTitle>
 <DialogDescription>
 {confirmAction?.status === 'SUSPENDED'
 ? <>Are you sure you want to suspend <strong>{confirmAction?.username}</strong>? They will <strong>immediately lose access</strong> to all platform features. This can be reversed from this page.</>
 : <>Are you sure you want to deactivate <strong>{confirmAction?.username}</strong>? Their account will be set to inactive. This can be reversed from this page.</>}
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-1.5 py-1">
 <Label htmlFor="suspend-reason" className="text-sm">Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
 <Textarea
 id="suspend-reason"
 placeholder={confirmAction?.status === 'SUSPENDED' ? 'e.g. Pending HR review' : 'e.g. Employment ended'}
 value={suspendReason}
 onChange={e => setSuspendReason(e.target.value)}
 rows={2}
 className="resize-none"
 />
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => { setConfirmAction(null); setSuspendReason(''); }}>
 Cancel
 </Button>
 <Button
 variant="destructive"
 disabled={updatingId === confirmAction?.userId}
 onClick={() => {
 if (confirmAction) {
 updateStatus(confirmAction.userId, confirmAction.status);
 setConfirmAction(null);
 setSuspendReason('');
 }
 }}
 >
 {updatingId === confirmAction?.userId && (
 <Loader2 className="h-4 w-4 mr-1 animate-spin" />
 )}
 {confirmAction?.status === 'SUSPENDED' ? 'Suspend' : 'Deactivate'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Invite staff dialog */}
 <InviteStaffDialog
 open={inviteOpen}
 onClose={() => setInviteOpen(false)}
 onSent={loadStaff}
 />
 </div>
 );
}
