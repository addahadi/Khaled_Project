import axios, { AxiosError } from 'axios';

/**
 * Base URL is just /api — Vite proxies it to http://localhost:3001 in dev.
 * In production set VITE_API_URL=/api (same origin) or full URL.
 */
const API_BASE = (import.meta as any).env.VITE_API_URL ?? '/api';

const apiClient = axios.create({
  baseURL:         API_BASE,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Inject access token ───────────────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Proactive token refresh ───────────────────────────────────────────────────
// Silently refreshes the access token before it expires so the user never
// experiences an unexpected logout.

let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Decode JWT payload without verification (browser-side, just reading exp). */
function decodeTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

/** Call the refresh endpoint and store the new access token. */
async function doRefresh(): Promise<string | null> {
  try {
    const res = await axios.post(
      `${API_BASE}/auth/refresh`, {}, { withCredentials: true },
    );
    const token = (res.data as { data: { accessToken: string } }).data.accessToken;
    sessionStorage.setItem('accessToken', token);
    scheduleProactiveRefresh(token);
    return token;
  } catch {
    return null;
  }
}

/** Schedule a refresh when 80% of the token's remaining lifetime has passed. */
function scheduleProactiveRefresh(token: string) {
  if (proactiveTimer) clearTimeout(proactiveTimer);
  const exp = decodeTokenExp(token);
  if (!exp) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const remaining = exp - nowSec;           // seconds until expiry
  if (remaining <= 0) return;

  // Refresh at 80% of lifetime (e.g. 48 min for a 1h token)
  const refreshIn = Math.max(remaining * 0.8, 30) * 1000; // at least 30s
  proactiveTimer = setTimeout(() => { doRefresh(); }, refreshIn);
}

// Kick off proactive schedule if there's already a token in storage
const existingToken = sessionStorage.getItem('accessToken');
if (existingToken) scheduleProactiveRefresh(existingToken);

// Also refresh when tab becomes visible again after being hidden
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const token = sessionStorage.getItem('accessToken');
  if (!token) return;

  const exp = decodeTokenExp(token);
  if (!exp) return;
  const remaining = exp - Math.floor(Date.now() / 1000);

  // If token is expired or close to expiry (< 2 min), refresh immediately
  if (remaining < 120) doRefresh();
});

// ── Silent refresh on 401 (fallback) ─────────────────────────────────────────
let refreshing: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    if (axios.isCancel(error)) return Promise.reject({ isCancelled: true });

    const original = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios
            .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
            .then((res) => {
              const token = (res.data as { data: { accessToken: string } }).data.accessToken;
              sessionStorage.setItem('accessToken', token);
              scheduleProactiveRefresh(token);
              return token;
            })
            .finally(() => { refreshing = null; });
        }
        const newToken = await refreshing;
        if (original) {
          original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` } as any;
        }
        return apiClient(original!);
      } catch {
        sessionStorage.removeItem('accessToken');
        if (proactiveTimer) clearTimeout(proactiveTimer);
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error.response?.data || { messageKey: 'ERROR_UNAUTHORIZED' });
      }
    }

    return Promise.reject(
      error.response?.data || { messageKey: 'ERROR_NETWORK_FAILURE' }
    );
  }
);

export { scheduleProactiveRefresh };
export default apiClient;
