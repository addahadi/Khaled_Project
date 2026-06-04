import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, X, UserPlus, Clock } from 'lucide-react';
import ApiManager from '../../api/ApiManager';
import apiClient from '../../api/apiClient';
import { queryClient } from '../../api/queryClientSetup';
import { useDelayedLoading } from '../../api/useDelayedLoading';
import UpgradePrompt from '../auth/UpgradePrompt';
import { inviteStaffSchema, flattenZodErrors } from '../../api/schemas';
import { formatDate } from '@/lib/formatDate';

interface Department { department_id: string; name: string }
interface Invitation {
  invitation_id: string;
  email:         string;
  role:          string;
  department_name: string | null;
  status:        'PENDING' | 'ACCEPTED' | 'EXPIRED';
  created_at:    string;
  expires_at:    string;
}

interface InviteStaffDialogProps {
  open:    boolean;
  onClose: () => void;
  onSent?: () => void;
}

const ROLE_OPTIONS = [
  { value: 'DOCTOR',   label: 'Doctor' },
  { value: 'LAB_TECH', label: 'Lab Technician' },
  { value: 'MANAGER',  label: 'Manager' },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  EXPIRED:  'bg-muted text-muted-foreground',
};

export default function InviteStaffDialog({ open, onClose, onSent }: InviteStaffDialogProps) {
  const { toast } = useToast();

  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState('');
  const [deptId, setDeptId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const { isLoading: invLoading, startLoading, stopLoading } = useDelayedLoading();

  // Load departments and existing invitations when dialog opens
  useEffect(() => {
    if (!open) return;

    ApiManager.execute({
      queryKey: ['manager', 'departments'],
      endpoint: '/manager/departments',
      onSuccess: (d) => setDepartments((d as { departments: Department[] }).departments),
    });

    ApiManager.execute({
      queryKey: ['manager', 'invitations'],
      endpoint: '/invitations',
      onStart:   startLoading,
      onSuccess: (d) => setInvitations((d as { invitations: Invitation[] }).invitations),
      onFinal:   stopLoading,
    });
  }, [open, startLoading, stopLoading]);

  const reset = () => {
    setEmail(''); setRole(''); setDeptId('');
    setFieldErrors({});
  };

  const handleSend = () => {
    const result = inviteStaffSchema.safeParse({ email, role, dept_id: deptId || undefined });
    if (!result.success) { setFieldErrors(flattenZodErrors(result.error)); return; }
    setFieldErrors({});

    ApiManager.executeMutation({
      mutationFn: () =>
        apiClient.post('/invitations', {
          email: result.data.email,
          role: result.data.role,
          ...(result.data.dept_id && { dept_id: result.data.dept_id }),
        }),
      invalidateKeys: [['manager', 'invitations'], ['manager', 'staff']],
      onStart: () => setSubmitting(true),
      onSuccess: (data, msg) => {
        const res = data as {
          invite_sent:    boolean;
          overage_notice?: { message: string };
        };

        toast({
          title:       'Invitation sent',
          description: res.overage_notice
            ? `${msg} — ${res.overage_notice.message}`
            : msg,
          variant: res.overage_notice ? 'default' : 'default',
        });

        // Invalidate then refresh invitation list
        queryClient.invalidateQueries({ queryKey: ['manager', 'invitations'] });
        ApiManager.execute({
          queryKey: ['manager', 'invitations'],
          endpoint: '/invitations',
          onSuccess: (d) => setInvitations((d as { invitations: Invitation[] }).invitations),
        });

        reset();
        onSent?.();
      },
      onError: ({ message, fields }) => {
        // 402 trial limit → show upgrade prompt
        if (message.includes('trial') || message.includes('limit')) {
          setShowUpgrade(true);
        } else if (fields) {
          setFieldErrors(fields);
        } else {
          toast({ title: 'Error', description: message, variant: 'destructive' });
        }
      },
      onFinal: () => setSubmitting(false),
    });
  };

  const handleCancel = (invitationId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.delete(`/invitations/${invitationId}`),
      invalidateKeys: [['manager', 'invitations']],
      onStart: () => setCancellingId(invitationId),
      onSuccess: (_d, msg) => {
        toast({ title: 'Cancelled', description: msg });
        setInvitations(prev => prev.filter(i => i.invitation_id !== invitationId));
      },
      onError: ({ message }) =>
        toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setCancellingId(null),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Invite Staff Member
            </DialogTitle>
            <DialogDescription>
              Send an email invitation. The staff member will set their password via the link.
            </DialogDescription>
          </DialogHeader>

          {/* Invite form */}
          <div className="grid sm:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="doctor@hospital.dz"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={fieldErrors.email ? 'border-destructive' : ''}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className={fieldErrors.role ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.role && (
                <p className="text-xs text-destructive">{fieldErrors.role}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Department (optional)</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dept." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <Button
                onClick={handleSend}
                disabled={submitting || !email || !role}
                className="gap-2"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
                Send Invitation
              </Button>
            </div>
          </div>

          {/* Pending invitations */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Sent Invitations
            </h3>
            {invLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">Loading…</div>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invitations sent yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map(inv => (
                    <TableRow key={inv.invitation_id}>
                      <TableCell className="text-sm">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {inv.role === 'LAB_TECH' ? 'Lab Tech' : inv.role.charAt(0) + inv.role.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.department_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_STYLE[inv.status] ?? ''}`}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(inv.expires_at)}
                      </TableCell>
                      <TableCell>
                        {inv.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={cancellingId === inv.invitation_id}
                            onClick={() => handleCancel(inv.invitation_id)}
                          >
                            {cancellingId === inv.invitation_id ? (
                              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade prompt on 402 trial limit */}
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        limitType="user"
      />
    </>
  );
}
