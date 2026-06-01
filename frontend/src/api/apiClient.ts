import axios, { AxiosError } from 'axios';

/**
 * Base URL is just /api — Vite proxies it to http://localhost:3001 in dev.
 * In production set VITE_API_URL=/api (same origin) or full URL.
 */
const apiClient = axios.create({
  baseURL:         (import.meta as any).env.VITE_API_URL ?? '/api',
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Inject access token ───────────────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Silent refresh on 401 ────────────────────────────────────────────────────
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
            .post('/api/auth/refresh', {}, { withCredentials: true })
            .then((res) => {
              const token = (res.data as { data: { accessToken: string } }).data.accessToken;
              sessionStorage.setItem('accessToken', token);
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
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error.response?.data || { messageKey: 'ERROR_UNAUTHORIZED' });
      }
    }

    return Promise.reject(
      error.response?.data || { messageKey: 'ERROR_NETWORK_FAILURE' }
    );
  }
);

export default apiClient;
