import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const WARN_BEFORE_MS = 5 * 60 * 1000; // warn 5 min before expiry

function getTokenExp(): number | null {
  const token = sessionStorage.getItem('accessToken');
  if (!token) return null;
  try {
    // Base64url → Base64 → JSON
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function SessionTimeoutModal() {
  const { logout, isAuthenticated } = useAuth();
  const [open,      setOpen]      = useState(false);
  const [countdown, setCountdown] = useState(300);

  const warnTimer    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownInt = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = () => {
    if (warnTimer.current)    { clearTimeout(warnTimer.current);    warnTimer.current    = null; }
    if (countdownInt.current) { clearInterval(countdownInt.current); countdownInt.current = null; }
  };

  const beginCountdown = useCallback((expiresAt: number) => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    setCountdown(remaining);
    setOpen(true);
    countdownInt.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInt.current!);
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [logout]);

  const schedule = useCallback(() => {
    clearAllTimers();
    const exp = getTokenExp();
    if (!exp) return;
    const msUntilWarn = exp - Date.now() - WARN_BEFORE_MS;
    if (msUntilWarn <= 0) {
      beginCountdown(exp);
    } else {
      warnTimer.current = setTimeout(() => beginCountdown(exp), msUntilWarn);
    }
  }, [beginCountdown]);

  useEffect(() => {
    if (!isAuthenticated) { clearAllTimers(); setOpen(false); return; }
    schedule();
    return clearAllTimers;
  }, [isAuthenticated, schedule]);

  const handleStayLoggedIn = async () => {
    try {
      const res = await axios.post(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      );
      const token = (res.data as { data: { accessToken: string } })?.data?.accessToken;
      if (token) sessionStorage.setItem('accessToken', token);
      clearAllTimers();
      setOpen(false);
      // Re-schedule with new token
      setTimeout(schedule, 100);
    } catch {
      logout();
    }
  };

  const handleLogout = () => {
    clearAllTimers();
    setOpen(false);
    logout();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
            Session expiring soon
          </DialogTitle>
          <DialogDescription>
            Your session will expire in{' '}
            <strong className="tabular-nums">{fmt(countdown)}</strong>.
            Any unsaved changes may be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out now
          </Button>
          <Button className="gap-2" onClick={handleStayLoggedIn}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Stay logged in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
