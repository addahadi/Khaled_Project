import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

const NAV_LINKS = [
  { key: 'features', to: '/#features' },
  { key: 'pricing',  to: '/#pricing'  },
  { key: 'about',    to: '/about'     },
];

const dashboardByRole: Record<UserRole, string> = {
  DOCTOR:   '/doctor/dashboard',
  LAB_TECH: '/lab/dashboard',
  MANAGER:  '/manager/dashboard',
};

export default function PublicNavbar() {
  const { t } = useTranslation('common');
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  const [open,      setOpen]      = useState(false);
  const [scrolled,  setScrolled]  = useState(false);

  /* Turn solid once user scrolls past the hero threshold */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* On non-hero pages (About, etc.) always show solid navbar */
  const isHeroPage = pathname === '/';
  const solid = scrolled || !isHeroPage || open;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        solid
          ? 'bg-card/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <div className="flex h-14 items-center justify-between">

          {/* Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <BrandLogo size="sm" />
            <span className={`text-base font-semibold tracking-tight transition-colors ${
              solid ? 'text-foreground' : 'text-white'
            }`}>
              DiagInfect
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(l => {
              const active = pathname === l.to || (l.to !== '/' && pathname.startsWith(l.to.split('#')[0]));
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                    active
                      ? solid
                        ? 'bg-primary/10 text-primary'
                        : 'bg-white/15 text-white'
                      : solid
                        ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {t(`nav.${l.key}`)}
                </Link>
              );
            })}
          </nav>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageToggle variant={solid ? 'default' : 'transparent'} />
            <div className="w-px h-4 bg-border mx-1" />
            {isAuthenticated && user ? (
              <Button asChild size="sm">
                <Link to={dashboardByRole[user.role]}>{t('nav.goToDashboard')}</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                    solid
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {t('nav.signIn')}
                </Link>
                <Button asChild size="sm" className={!solid ? 'bg-white text-[#0d1829] hover:bg-white/90 shadow-sm' : ''}>
                  <Link to="/register-organization">{t('nav.getStarted')}</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className={`md:hidden flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${
              solid ? 'text-foreground hover:bg-muted' : 'text-white hover:bg-white/10'
            }`}
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-card border-t border-border">
          {NAV_LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center h-12 px-5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border-b border-border transition-colors"
              onClick={() => setOpen(false)}
            >
              {t(`nav.${l.key}`)}
            </Link>
          ))}
          <div className="p-4 flex flex-col gap-2">
            {isAuthenticated && user ? (
              <Button asChild>
                <Link to={dashboardByRole[user.role]} onClick={() => setOpen(false)}>
                  {t('nav.goToDashboard')}
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to="/login" onClick={() => setOpen(false)}>{t('nav.signIn')}</Link>
                </Button>
                <Button asChild>
                  <Link to="/register-organization" onClick={() => setOpen(false)}>{t('nav.getStartedFree')}</Link>
                </Button>
              </>
            )}
            <div className="pt-2 flex justify-center">
              <LanguageToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
