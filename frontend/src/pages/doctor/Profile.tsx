import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCircle, Mail, Building2, Stethoscope, Pencil, Loader2, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { useTranslation } from 'react-i18next';

interface Profile {
  user_id: string; username: string; email: string;
  org_name: string | null; status: string;
  preferred_lang: string; role: string;
}

export default function DoctorProfile() {
  const { t } = useTranslation(['doctor', 'common']);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', preferred_lang: 'en' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['auth', 'me'],
      endpoint:  '/auth/me',
      onStart:   startLoading,
      onSuccess: (d) => setProfile((d as { user: Profile }).user),
      onFinal:   stopLoading,
    });
  }, []);

  useEffect(() => {
    if (profile && editing) {
      setEditForm({ username: profile.username, preferred_lang: profile.preferred_lang });
    }
  }, [editing, profile]);

  const handleSave = () => {
    if (!editForm.username.trim()) {
      toast({ title: t('profile.validationError'), description: t('profile.usernameEmpty'), variant: 'destructive' });
      return;
    }
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch('/auth/profile', {
        username: editForm.username.trim(),
        preferred_lang: editForm.preferred_lang,
      }),
      invalidateKeys: [['auth', 'me']],
      onStart:   () => setSaving(true),
      onSuccess: (_data: unknown, msg: string) => {
        toast({ title: t('profile.profileUpdated'), description: msg || t('profile.profileSaved') });
        setProfile(prev => prev ? { ...prev, username: editForm.username.trim(), preferred_lang: editForm.preferred_lang } : prev);
        setEditing(false);
      },
      onError: ({ message }: { message: string }) => {
        toast({ title: t('profile.error'), description: message, variant: 'destructive' });
      },
      onFinal: () => setSaving(false),
    });
  };

  const initials = profile?.username?.slice(0, 2).toUpperCase()
    ?? user?.username?.slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="space-y-6 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('profile.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('profile.subtitle')}</p>
        </div>
        {!editing && profile && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> {t('profile.editProfile')}
          </Button>
        )}
      </div>

      {/* Avatar card */}
      <Card>
        <CardContent className="p-5">
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
              <Avatar className="h-16 w-16 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{profile?.username}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {t('profile.doctor')}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    profile?.status === 'ACTIVE'
                      ? 'bg-[#00a89c]/10 text-[#007a71] border-[#00a89c]/25'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {profile?.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details card */}
      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
            <Stethoscope className="h-4 w-4" /> {t('profile.accountDetails')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : editing ? (
            /* Edit mode */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{t('profile.username')}</Label>
                <Input
                  value={editForm.username}
                  onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              {/* Email — read only */}
              <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-muted/50 border border-border">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{t('profile.email')}</p>
                  <p className="text-sm font-medium truncate">{profile?.email ?? '—'}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{t('profile.readOnly')}</Badge>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t('profile.preferredLang')}</Label>
                <Select
                  value={editForm.preferred_lang}
                  onValueChange={v => setEditForm(prev => ({ ...prev, preferred_lang: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t('profile.english')}</SelectItem>
                    <SelectItem value="ar">{t('profile.arabic')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Org — read only */}
              <div className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-muted/50 border border-border">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('profile.organization')}</p>
                  <p className="text-sm font-medium">{profile?.org_name ?? t('profile.notLinked')}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="h-3.5 w-3.5" /> {t('profile.cancelEdit')}
                </Button>
                <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {t('profile.saveChanges')}
                </Button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="space-y-2">
              {[
                { icon: UserCircle,  label: t('profile.username'),     value: profile?.username },
                { icon: Mail,        label: t('profile.email'),        value: profile?.email },
                { icon: Building2,   label: t('profile.organization'), value: profile?.org_name ?? t('profile.notLinked') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-[var(--radius)] hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
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
    </div>
  );
}
