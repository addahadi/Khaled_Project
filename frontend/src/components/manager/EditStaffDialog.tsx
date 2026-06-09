import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UserCog } from 'lucide-react';
import ApiManager from '../../api/ApiManager';
import apiClient from '../../api/apiClient';

interface Department { department_id: string; name: string }

interface EditStaffDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  staff: {
    user_id: string;
    username: string;
    department_id?: string | null;
  } | null;
}

export default function EditStaffDialog({ open, onClose, onSaved, staff }: EditStaffDialogProps) {
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [deptId, setDeptId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (open && staff) {
      setUsername(staff.username);
      setDeptId(staff.department_id || 'none');
    }
  }, [open, staff]);

  useEffect(() => {
    if (!open) return;
    ApiManager.execute({
      queryKey: ['manager', 'departments'],
      endpoint: '/manager/departments',
      onSuccess: (d) => setDepartments((d as { departments: Department[] }).departments),
    });
  }, [open]);

  const handleSave = () => {
    if (!staff) return;

    const payload: any = {
      username,
      department_id: deptId === 'none' ? null : deptId,
    };

    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/manager/staff/${staff.user_id}/profile`, payload),
      invalidateKeys: [['manager', 'staff']],
      onStart: () => setSubmitting(true),
      onSuccess: (_d, msg) => {
        toast({ title: 'Profile updated', description: msg });
        onSaved?.();
        onClose();
      },
      onError: ({ message }) => {
        toast({ title: 'Error', description: message, variant: 'destructive' });
      },
      onFinal: () => setSubmitting(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" /> Edit Staff Profile
          </DialogTitle>
          <DialogDescription>
            Update department or username. Role changes require deleting and re-inviting the staff member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger>
                <SelectValue placeholder="Select dept." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Department</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.department_id} value={d.department_id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={submitting || !username}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
