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
 SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
 SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
 { title: 'Dashboard',  url: '/manager/dashboard',  icon: LayoutDashboard },
 { title: 'Staff',  url: '/manager/staff',  icon: Users },
 { title: 'Departments',  url: '/manager/departments',  icon: Building2 },
 { title: 'Subscription', url: '/manager/subscription', icon: CreditCard },
 { title: 'Reports',  url: '/manager/reports',  icon: BarChart3 },
 { title: 'Profile',  url: '/manager/profile',  icon: UserCircle },
];

function ManagerSidebar() {
 const { state }  = useSidebar();
 const collapsed  = state === 'collapsed';
 const { user, logout } = useAuth();
 const navigate  = useNavigate();
 const initials  = user?.username?.slice(0, 2).toUpperCase() ?? 'MG';

 return (
 <Sidebar collapsible="icon" className="border-r border-border bg-background shadow-[2px_0_12px_-4px_rgba(0,0,0,0.08)]">
 <SidebarContent>
 <SidebarGroup>
 <SidebarGroupLabel className="h-12 flex items-center px-4 border-b border-border mb-0">
 {!collapsed ? (
 <div className="flex items-center gap-2.5">
 <div className="w-6 h-6 bg-primary flex items-center justify-center shrink-0">
 <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
 <rect x="8.5" y="1" width="3" height="18" fill="white" />
 <rect x="1" y="8.5" width="18" height="3" fill="white" />
 </svg>
 </div>
 <span className="text-sm font-normal text-foreground tracking-tight">DiagInfect</span>
 </div>
 ) : (
 <div className="w-6 h-6 bg-primary flex items-center justify-center">
 <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
 <rect x="8.5" y="1" width="3" height="18" fill="white" />
 <rect x="1" y="8.5" width="18" height="3" fill="white" />
 </svg>
 </div>
 )}
 </SidebarGroupLabel>

 <SidebarGroupContent className="pt-2">
 <SidebarMenu>
 {NAV_ITEMS.map((item) => (
 <SidebarMenuItem key={item.title}>
 <SidebarMenuButton asChild className="h-10 px-0">
 <NavLink
 to={item.url}
 end={item.url === '/manager/dashboard'}
 className={[
 "flex items-center w-full h-10 px-3 mx-1 text-sm tracking-[0.16px] rounded-md",
                        "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
 ].join(" ")}
 activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
 >
 <item.icon className="h-4 w-4 shrink-0" />
 {!collapsed && <span className="ml-3">{item.title}</span>}
 </NavLink>
 </SidebarMenuButton>
 </SidebarMenuItem>
 ))}
 </SidebarMenu>
 </SidebarGroupContent>
 </SidebarGroup>
 </SidebarContent>

 <SidebarFooter className="border-t border-border">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-left">
 <div className="w-8 h-8 bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-normal">
 {initials}
 </div>
 {!collapsed && (
 <div className="flex flex-col min-w-0">
 <span className="text-sm text-foreground truncate tracking-[0.16px]">
 {user?.username}
 </span>
 <span className="text-xs text-muted-foreground tracking-[0.32px]">Hospital manager</span>
 </div>
 )}
 </button>
 </DropdownMenuTrigger>
 <DropdownMenuContent side="right" align="end" className="w-44">
 <DropdownMenuItem onClick={() => navigate('/manager/profile')}
 className="text-sm tracking-[0.16px]">
 <UserCircle className="mr-2 h-4 w-4" /> Profile
 </DropdownMenuItem>
 <DropdownMenuItem className="text-destructive text-sm tracking-[0.16px]" onClick={logout}>
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
 <header className="h-12 flex items-center border-b border-border px-4 shrink-0 bg-background shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)]">
 <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
 </header>
 <main className="flex-1 overflow-auto bg-muted/50 p-6">
 <Outlet />
 </main>
 </div>
 </div>
 </SidebarProvider>
 );
}
