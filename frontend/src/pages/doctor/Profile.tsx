import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserCircle, Mail, Building2, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';

interface Profile {
  user_id:    string; username: string; email: string;
  org_name:   string | null; status: string;
  preferred_lang: string; role: string;
}

export default function DoctorProfile() {
  const { user } = useAuth();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['auth', 'me'],
      endpoint:  '/auth/me',
      onStart:   startLoading,
      onSuccess: (d) => setProfile((d as { user: Profile }).user),
      onFinal:   stopLoading,
    });
  }, []);

  const initials = profile?.username?.slice(0, 2).toUpperCase()
    ?? user?.username?.slice(0, 2).toUpperCase() ?? 'DR';

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

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
                <AvatarFallback className="text-xl font-bold bg-blue-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{profile?.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="text-xs bg-blue-100 text-blue-800">Doctor</Badge>
                  <Badge variant={profile?.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
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
            <Stethoscope className="h-4 w-4" /> Account Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { icon: UserCircle, label: 'Username',     value: profile?.username },
                { icon: Mail,       label: 'Email',        value: profile?.email },
                { icon: Building2,  label: 'Organization', value: profile?.org_name ?? 'Not linked' },
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
    </div>
  );
}
