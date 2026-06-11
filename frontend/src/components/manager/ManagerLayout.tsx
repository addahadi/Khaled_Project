import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, CreditCard,
  BarChart3, UserCircle, LogOut, Building2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { title: 'Dashboard',    url: '/manager/dashboard',    icon: LayoutDashboard },
  { title: 'Staff',        url: '/manager/staff',        icon: Users },
  { title: 'Departments',  url: '/manager/departments',  icon: Building2 },
  { title: 'Subscription', url: '/manager/subscription', icon: CreditCard },
  { title: 'Reports',      url: '/manager/reports',      icon: BarChart3 },
  { title: 'Profile',      url: '/manager/profile',      icon: UserCircle },
];

function ManagerSidebar() {
  const { state }        = useSidebar();
  const collapsed        = state === 'collapsed';
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const initials         = user?.username?.slice(0, 2).toUpperCase() ?? 'MG';

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card shadow-[1px_0_0_0_hsl(var(--border))]"
    >
      <SidebarHeader className={collapsed ? "h-14 flex items-center justify-center border-b border-border p-0" : "h-14 flex items-center px-4 border-b border-border"}>
        {!collapsed ? (
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/30">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="8.5" y="1" width="3" height="18" fill="white" />
                <rect x="1" y="8.5" width="18" height="3" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">DiagInfect</span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/30 shrink-0">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="8.5" y="1" width="3" height="18" fill="white" />
              <rect x="1" y="8.5" width="18" height="3" fill="white" />
            </svg>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className={collapsed ? "justify-center" : ""}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/manager/dashboard'}
                      className={[
                        "flex items-center w-full text-sm font-medium rounded-lg",
                        "text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150",
                        collapsed ? "justify-center h-8 w-8 px-0" : "h-9 px-3"
                      ].join(" ")}
                      activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="ml-2.5">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={[
              "flex items-center w-full rounded-lg",
              "hover:bg-muted transition-all duration-150 text-left",
              collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
            ].join(" ")}>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-semibold shadow-sm">
                {initials}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {user?.username}
                  </span>
                  <span className="text-xs text-muted-foreground">Hospital manager</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-44 rounded-xl">
            <DropdownMenuItem onClick={() => navigate('/manager/profile')} className="text-sm rounded-lg">
              <UserCircle className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive text-sm rounded-lg" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function ManagerLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ManagerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 shrink-0 bg-card shadow-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-all duration-150" />
          </header>
          <main className="flex-1 overflow-auto bg-background p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
