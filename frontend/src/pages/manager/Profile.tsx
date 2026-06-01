import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserCircle, Mail, Building2, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';

interface UserProfile {
  user_id: string; username: string; email: string;
  org_name: string | null; department_id: string | null;
  preferred_lang: string; status: string; role: string;
  created_at?: string;
}

const ROLE_COLOR: Record<string, string> = {
  DOCTOR:   'bg-blue-100 text-blue-800',
  LAB_TECH: 'bg-teal-100 text-teal-800',
  MANAGER:  'bg-violet-100 text-violet-800',
};

export default function Profile() {
  const { user } = useAuth();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['auth', 'me'],
      endpoint: '/auth/me',
      onStart: startLoading,
      onSuccess: (data: unknown) => setProfile((data as { user: UserProfile }).user),
      onFinal: stopLoading,
    });
  }, []);

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? user?.username?.slice(0, 2).toUpperCase() ?? '??';

  const Info = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) => (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value ?? '—'}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

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
                <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{profile?.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs ${ROLE_COLOR[profile?.role ?? ''] ?? ''}`}>
                    {profile?.role === 'LAB_TECH' ? 'Lab Technician' : profile?.role ?? '—'}
                  </Badge>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4" /> Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              <Info icon={UserCircle} label="Username"     value={profile?.username} />
              <Info icon={Mail}       label="Email"        value={profile?.email} />
              <Info icon={Building2}  label="Organization" value={profile?.org_name} />
              <Info icon={MapPin}     label="Language"     value={profile?.preferred_lang === 'ar' ? 'Arabic' : 'English'} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
