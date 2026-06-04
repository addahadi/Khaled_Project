import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Brain, FlaskConical,
  Bell, UserCircle, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAlerts } from '@/contexts/AlertsContext';

const NAV_ITEMS = [
  { title: 'Dashboard',   url: '/doctor/dashboard',         icon: LayoutDashboard },
  { title: 'Patients',    url: '/doctor/patients',          icon: Users },
  { title: 'Predictions', url: '/doctor/predictions',       icon: Brain },
  { title: 'Alerts',      url: '/doctor/alerts',            icon: Bell },
  { title: 'Profile',     url: '/doctor/profile',           icon: UserCircle },
];

function DoctorSidebar() {
  const { state }  = useSidebar();
  const collapsed  = state === 'collapsed';
  const { user, logout } = useAuth();
  const navigate   = useNavigate();
  const { unreadCount: unread } = useAlerts();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed
              ? <span className="text-base font-bold tracking-tight text-primary">DiagInfect</span>
              : <span className="text-xs font-bold text-primary">DI</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/doctor/dashboard'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.title === 'Alerts' && unread > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto text-[10px] h-4 min-w-4 px-1 py-0 flex items-center justify-center"
                        >
                          {unread > 9 ? '9+' : unread}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-3 px-2 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {user?.username?.slice(0, 2).toUpperCase() ?? 'DR'}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end">
              <DropdownMenuItem onClick={() => navigate('/doctor/profile')}>
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{user?.username}</span>
              <span className="text-xs text-muted-foreground">Doctor</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function DoctorLayout() {
  const navigate = useNavigate();
  const { unreadCount: unread } = useAlerts();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DoctorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 shrink-0">
            <SidebarTrigger />
            <Button
              variant="ghost" size="icon" className="relative"
              aria-label={`View alerts${unread > 0 ? ` (${unread} unread)` : ''}`}
              onClick={() => navigate('/doctor/alerts')}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {unread > 9 ? '9+' : unread}
                </Badge>
              )}
            </Button>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
