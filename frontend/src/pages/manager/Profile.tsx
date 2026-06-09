import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  UserCircle, Mail, Building2, Calendar, MapPin,
  Pencil, Loader2, X, Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';

interface UserProfile {
  user_id:        string; username: string; email: string;
  org_name:       string | null; department_id: string | null;
  preferred_lang: string; status: string; role: string;
  created_at?:    string;
}

interface OrganizationProfile {
  organization_id: string;
  name: string;
  type: string;
  email: string;
  address: string;
  created_at: string;
}

export default function ManagerProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile | null>(null);

  // Edit mode for Manager
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState({ username: '', preferred_lang: 'en' });
  const [saving, setSaving]     = useState(false);

  // Edit mode for Org
  const [orgEditing, setOrgEditing] = useState(false);
  const [orgEditForm, setOrgEditForm] = useState({ name: '', type: '', email: '', address: '' });
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['auth', 'me'],
      endpoint: '/auth/me',
      onStart:   startLoading,
      onSuccess: (data: unknown) => setProfile((data as { user: UserProfile }).user),
      onFinal:   stopLoading,
    });
    ApiManager.execute({
      queryKey: ['manager', 'organization'],
      endpoint: '/manager/organization',
      onSuccess: (data: unknown) => setOrgProfile((data as { organization: OrganizationProfile }).organization),
    });
  }, []);

  useEffect(() => {
    if (profile && editing) {
      setEditForm({ username: profile.username, preferred_lang: profile.preferred_lang });
    }
  }, [editing, profile]);

  useEffect(() => {
    if (orgProfile && orgEditing) {
      setOrgEditForm({
        name: orgProfile.name || '',
        type: orgProfile.type || '',
        email: orgProfile.email || '',
        address: orgProfile.address || '',
      });
    }
  }, [orgEditing, orgProfile]);

  const handleSave = () => {
    if (!editForm.username.trim()) {
      toast({ title: 'Validation Error', description: 'Username cannot be empty.', variant: 'destructive' });
      return;
    }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch('/auth/profile', {
        username:       editForm.username.trim(),
        preferred_lang: editForm.preferred_lang,
      }),
      invalidateKeys: [['auth', 'me']],
      onStart:   () => setSaving(true),
      onSuccess: (_data: unknown, msg: string) => {
        toast({ title: 'Profile updated', description: msg || 'Your profile has been saved.' });
        setProfile(prev => prev
          ? { ...prev, username: editForm.username.trim(), preferred_lang: editForm.preferred_lang }
          : prev);
        setEditing(false);
      },
      onError: ({ message }: { message: string }) => {
        toast({ title: 'Error', description: message, variant: 'destructive' });
      },
      onFinal: () => setSaving(false),
    });
  };

  const handleOrgSave = () => {
    if (!orgEditForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Organization name cannot be empty.', variant: 'destructive' });
      return;
    }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch('/manager/organization', {
        name: orgEditForm.name.trim(),
        type: orgEditForm.type,
        email: orgEditForm.email.trim(),
        address: orgEditForm.address.trim(),
      }),
      invalidateKeys: [['manager', 'organization']],
      onStart: () => setOrgSaving(true),
      onSuccess: (data: unknown, msg: string) => {
        toast({ title: 'Organization updated', description: msg || 'Organization profile has been saved.' });
        setOrgProfile((data as { organization: OrganizationProfile }).organization);
        setOrgEditing(false);
      },
      onError: ({ message }: { message: string }) => {
        toast({ title: 'Error', description: message, variant: 'destructive' });
      },
      onFinal: () => setOrgSaving(false),
    });
  };

  const initials = profile?.username?.slice(0, 2).toUpperCase()
    ?? user?.username?.slice(0, 2).toUpperCase() ?? 'MG';

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Profile</h1>
        {!editing && profile && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      {/* Avatar card */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl font-bold bg-violet-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{profile?.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="text-xs bg-violet-100 text-violet-800">Manager</Badge>
                  <Badge
                    variant={profile?.status === 'ACTIVE' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {profile?.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4" /> Account Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : editing ? (
            /* ── Edit mode ── */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={editForm.username}
                  onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{profile?.email ?? '—'}</p>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs">Read-only</Badge>
              </div>

              <div className="space-y-1.5">
                <Label>Preferred Language</Label>
                <Select
                  value={editForm.preferred_lang}
                  onValueChange={v => setEditForm(prev => ({ ...prev, preferred_lang: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Organization</p>
                  <p className="text-sm font-medium">{profile?.org_name ?? 'Not linked'}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline" className="flex-1 gap-1"
                  onClick={() => setEditing(false)} disabled={saving}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button className="flex-1 gap-1" onClick={handleSave} disabled={saving}>
                  {saving
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Check className="h-3.5 w-3.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <div className="space-y-4">
              {[
                { icon: UserCircle, label: 'Username',     value: profile?.username },
                { icon: Mail,       label: 'Email',        value: profile?.email },
                { icon: Building2,  label: 'Organization', value: profile?.org_name ?? 'Not linked' },
                { icon: MapPin,     label: 'Language',     value: profile?.preferred_lang === 'ar' ? 'Arabic' : 'English' },
                ...(profile?.created_at ? [{ icon: Calendar, label: 'Member since', value: formatDate(profile.created_at) }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value ?? '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Organization Details
          </CardTitle>
          {!orgEditing && orgProfile && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOrgEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && !orgProfile ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : orgEditing ? (
            /* ── Org Edit mode ── */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-org-name">Organization Name</Label>
                <Input
                  id="edit-org-name"
                  value={orgEditForm.name}
                  onChange={e => setOrgEditForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Organization Type</Label>
                <Select
                  value={orgEditForm.type}
                  onValueChange={v => setOrgEditForm(prev => ({ ...prev, type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                    <SelectItem value="CLINIC">Clinic</SelectItem>
                    <SelectItem value="LAB">Laboratory</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-email">Contact Email</Label>
                <Input
                  id="edit-org-email"
                  type="email"
                  value={orgEditForm.email}
                  onChange={e => setOrgEditForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-org-address">Address</Label>
                <Input
                  id="edit-org-address"
                  value={orgEditForm.address}
                  onChange={e => setOrgEditForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline" className="flex-1 gap-1"
                  onClick={() => setOrgEditing(false)} disabled={orgSaving}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button className="flex-1 gap-1" onClick={handleOrgSave} disabled={orgSaving}>
                  {orgSaving
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Check className="h-3.5 w-3.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            /* ── Org View mode ── */
            <div className="space-y-4">
              {[
                { icon: Building2, label: 'Organization Name', value: orgProfile?.name },
                { icon: Building2, label: 'Type',              value: orgProfile?.type === 'HOSPITAL' ? 'Hospital' : orgProfile?.type === 'CLINIC' ? 'Clinic' : orgProfile?.type === 'LAB' ? 'Laboratory' : 'Other' },
                { icon: Mail,      label: 'Contact Email',     value: orgProfile?.email },
                { icon: MapPin,    label: 'Address',           value: orgProfile?.address },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
