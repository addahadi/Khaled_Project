import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  FlaskConical, LayoutDashboard, ClipboardList, UserCircle, LogOut, Bell,
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
import ApiManager from '@/api/ApiManager';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useLanguage } from '@/contexts/LanguageContext';

function LabSidebar() {
  const { t }            = useTranslation('common');
  const { state }        = useSidebar();
  const collapsed        = state === 'collapsed';
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const initials         = user?.username?.slice(0, 2).toUpperCase() ?? 'LT';
  const [unread, setUnread] = useState(0);
  const { dir } = useLanguage();

  useEffect(() => {
    const fetchUnread = () => {
      ApiManager.execute({
        queryKey: ['lab', 'alerts'],
        endpoint: '/lab/alerts',
        staleTime: 30_000,
        onSuccess: (data: unknown) => {
          const d = data as { alerts: Array<{ is_read: boolean }> };
          setUnread(d.alerts.filter(a => !a.is_read).length);
        },
      });
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 60_000);
    return () => clearInterval(id);
  }, []);

  const NAV_ITEMS = [
    { key: 'dashboard',    url: '/lab/dashboard', icon: LayoutDashboard, end: true,  badge: 0 },
    { key: 'labOrders',    url: '/lab/orders',    icon: ClipboardList,   end: false, badge: 0 },
    { key: 'enterResults', url: '/lab/results',   icon: FlaskConical,    end: false, badge: 0 },
    { key: 'alerts',       url: '/lab/alerts',    icon: Bell,            end: false, badge: unread },
    { key: 'profile',      url: '/lab/profile',   icon: UserCircle,      end: false, badge: 0 },
  ];

  return (
    <Sidebar
      collapsible="icon"
      side={dir === 'rtl' ? 'right' : 'left'}
      className="border-border bg-card ltr:border-r ltr:shadow-[1px_0_0_0_hsl(var(--border))] rtl:border-l rtl:shadow-[-1px_0_0_0_hsl(var(--border))]"
    >
      <SidebarHeader className={collapsed ? "h-14 flex items-center justify-center border-b border-border p-0" : "h-14 flex items-center px-4 border-b border-border"}>
        {!collapsed ? (
          <div className="flex items-center gap-3 w-full">
            <BrandLogo size="sm" />
            <span className="text-sm font-semibold text-foreground tracking-tight">DiagInfect</span>
          </div>
        ) : (
          <BrandLogo size="sm" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild className={collapsed ? "justify-center" : ""}>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className={[
                        'flex items-center w-full text-sm font-medium rounded-lg',
                        'text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150',
                        collapsed ? "justify-center h-8 w-8 px-0" : "h-9 px-3"
                      ].join(' ')}
                      activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <div className="relative shrink-0 flex items-center justify-center">
                        <item.icon className="h-4 w-4" />
                        {item.badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-semibold">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </div>
                      {!collapsed && <span className="ml-2.5">{t(`sidebar.${item.key}`)}</span>}
                      {!collapsed && item.badge > 0 && (
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
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
                  <span className="text-xs text-muted-foreground">{t('roles.labTech')}</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-44 rounded-xl">
            <DropdownMenuItem onClick={() => navigate('/lab/profile')} className="text-sm rounded-lg">
              <UserCircle className="mr-2 h-4 w-4" /> {t('sidebar.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive text-sm rounded-lg" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> {t('actions.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function LabLayout() {
  const { dir } = useLanguage();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir={dir}>
        <LabSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0 bg-card shadow-sm">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-all duration-150" />
            <LanguageToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
