import {
  createContext, useContext, useEffect, useState,
  useCallback, useRef, type ReactNode,
} from 'react';
import apiClient, { scheduleProactiveRefresh } from '@/api/apiClient';
import i18n from '@/i18n';

export type UserRole = 'DOCTOR' | 'LAB_TECH' | 'MANAGER';

export interface AuthUser {
  user_id:        string;
  username:       string;
  email:          string;
  role:           UserRole;
  org_id:         string | null;
  preferred_lang: string;
}

interface AuthState {
  user:            AuthUser | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  /** Set the auth state after a successful login (called from onSuccess callbacks) */
  setAuthenticated: (user: AuthUser, accessToken: string) => void;
  logout:           () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Sync the user's preferred_lang from DB to i18n, localStorage, and <html> */
function syncLang(lang: string) {
  const validLang = lang === 'ar' ? 'ar' : 'en';
  localStorage.setItem('app_lang', validLang);
  document.documentElement.lang = validLang;
  document.documentElement.dir  = validLang === 'ar' ? 'rtl' : 'ltr';
  if (i18n.language !== validLang) i18n.changeLanguage(validLang);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:            null,
    isLoading:       true,
    isAuthenticated: false,
  });

  // On mount, fetch the current user profile.
  // If the access token is missing or expired, apiClient's interceptor will automatically
  // call /auth/refresh to restore the session, preventing race conditions.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const res = await apiClient.get('/auth/me') as {
          data: { user: AuthUser }
        };
        // The interceptor handles saving the accessToken if a refresh occurred.
        setState({ user: res.data.user, isLoading: false, isAuthenticated: true });
        // Sync language from user's DB preference
        syncLang(res.data.user.preferred_lang);
      } catch {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  // Force logout when apiClient interceptor fires auth:logout
  useEffect(() => {
    const handler = () => {
      sessionStorage.removeItem('accessToken');
      setState({ user: null, isLoading: false, isAuthenticated: false });
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const setAuthenticated = useCallback((user: AuthUser, accessToken: string) => {
    sessionStorage.setItem('accessToken', accessToken);
    scheduleProactiveRefresh(accessToken);
    setState({ user, isLoading: false, isAuthenticated: true });
    // Sync language from user's DB preference
    syncLang(user.preferred_lang);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('accessToken');
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
