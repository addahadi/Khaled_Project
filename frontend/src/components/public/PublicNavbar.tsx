import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import { BrandLogo } from '@/components/ui/BrandLogo';

const NAV_LINKS = [
 { label: 'Solutions', to: '/#features' },
 { label: 'Pricing',  to: '/#pricing'  },
 { label: 'About',  to: '/about'  },
];

const dashboardByRole: Record<UserRole, string> = {
 DOCTOR:  '/doctor/dashboard',
 LAB_TECH: '/lab/dashboard',
 MANAGER:  '/manager/dashboard',
};

export default function PublicNavbar() {
 const { isAuthenticated, user } = useAuth();
 const { pathname } = useLocation();
 const [open, setOpen] = useState(false);

 return (
 <>
 {/* IBM Carbon utility bar — slim gray ribbon */}
 <div className="hidden md:flex h-8 items-center bg-muted border-b border-border">
 <div className="mx-auto w-full max-w-[1584px] px-4 sm:px-8 flex items-center justify-end gap-6">
 <span className="text-[11px] text-muted-foreground tracking-[0.32px]">
 Ibn Khaldoun University · Tiaret, Algeria
 </span>
 <Link
 to="/about"
 className="text-[11px] text-muted-foreground hover:text-foreground tracking-[0.32px] transition-colors"
 >
 About
 </Link>
 </div>
 </div>

 {/* IBM Carbon top-nav — 48px, white, 1px hairline bottom */}
 <header className="sticky top-0 z-50 bg-background border-b border-border shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)]">
 <div className="mx-auto w-full max-w-[1584px] px-4 sm:px-8">
 <div className="flex h-12 items-center justify-between">

 {/* Wordmark */}
 <Link to="/" className="flex items-center gap-3">
 <BrandLogo size="sm" />
 <span className="text-base font-normal tracking-tight text-foreground">
 DiagInfect
 </span>
 </Link>

 {/* Desktop nav */}
 <nav className="hidden md:flex items-center" aria-label="Main navigation">
 {NAV_LINKS.map(l => (
 <Link
 key={l.to}
 to={l.to}
 className={[
 "flex items-center h-12 px-4 text-sm tracking-[0.16px] border-b-2 transition-colors",
 pathname === l.to || (l.to !== '/' && pathname.startsWith(l.to.split('#')[0]))
 ? "border-primary text-foreground"
 : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
 ].join(" ")}
 >
 {l.label}
 </Link>
 ))}
 </nav>

 {/* CTAs */}
 <div className="hidden md:flex items-center gap-0">
 {isAuthenticated && user ? (
 <Button asChild size="sm">
 <Link to={dashboardByRole[user.role]}>Go to dashboard</Link>
 </Button>
 ) : (
 <>
 <Link
 to="/login"
 className="flex items-center h-12 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors tracking-[0.16px]"
 >
 Sign in
 </Link>
 <Button asChild size="sm">
 <Link to="/register-organization">Get started</Link>
 </Button>
 </>
 )}
 </div>

 {/* Mobile toggle */}
 <button
 className="md:hidden flex items-center justify-center h-12 w-12 text-foreground hover:bg-muted transition-colors"
 onClick={() => setOpen(o => !o)}
 aria-label={open ? 'Close menu' : 'Open menu'}
 >
 {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
 </button>
 </div>
 </div>

 {/* Mobile menu */}
 {open && (
 <div className="md:hidden border-t border-border bg-background">
 {NAV_LINKS.map(l => (
 <Link
 key={l.to}
 to={l.to}
 className="flex items-center h-12 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted border-b border-border tracking-[0.16px] transition-colors"
 onClick={() => setOpen(false)}
 >
 {l.label}
 </Link>
 ))}
 <div className="p-4 flex flex-col gap-2 border-b border-border">
 {isAuthenticated && user ? (
 <Button asChild>
 <Link to={dashboardByRole[user.role]} onClick={() => setOpen(false)}>
 Go to dashboard
 </Link>
 </Button>
 ) : (
 <>
 <Button variant="outline" asChild>
 <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
 </Button>
 <Button asChild>
 <Link to="/register-organization" onClick={() => setOpen(false)}>Get started</Link>
 </Button>
 </>
 )}
 </div>
 </div>
 )}
 </header>
 </>
 );
}
