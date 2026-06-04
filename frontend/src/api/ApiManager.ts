import apiClient from './apiClient';
import { queryClient } from './queryClientSetup';
import { dictionary, getCurrentLanguage } from './translations';
import type { ZodSchema } from 'zod';

type Lang = keyof typeof dictionary;

interface ExecuteOptions {
  queryKey: string[];
  endpoint: string;
  responseSchema?: ZodSchema;
  /** Override the default staleTime for this query. Cached data younger than
   *  this value (in ms) will be served immediately without a network request. */
  staleTime?: number;
  onStart?: () => void;
  onSuccess?: (data: unknown) => void;
  onError?: (err: { message: string }) => void;
  onFinal?: () => void;
}

interface MutationOptions {
  mutationFn: (config?: Record<string, unknown>) => Promise<unknown>;
  invalidateKeys?: string[][];
  optimisticConfig?: { queryKey: string[]; newData: unknown } | null;
  onProgress?: (pct: number) => void;
  onStart?: () => void;
  onSuccess?: (data: unknown, localizedMessage: string) => void;
  onError?: (err: { message: string; fields?: Record<string, string> | null }) => void;
  onFinal?: () => void;
}

/**
 * Per-key in-flight promise map.  Prevents concurrent duplicate fetches from
 * triggering multiple onStart/onFinal cycles when the same key is requested
 * more than once before the previous promise resolves.
 */
const inflight = new Map<string, Promise<unknown>>();

class ApiManager {
  /** Fire-and-forget GET with React Query caching */
  static execute({ queryKey, endpoint, responseSchema, staleTime, onStart, onSuccess, onError, onFinal }: ExecuteOptions) {
    // If the cache already has fresh data, serve it immediately without loading state
    const queryState = queryClient.getQueryState(queryKey);
    const cachedData = queryClient.getQueryData(queryKey);
    const effectiveStaleTime = staleTime
      ?? (queryClient.getDefaultOptions().queries?.staleTime as number ?? 0);
    const isFresh =
      cachedData !== undefined &&
      queryState?.dataUpdatedAt &&
      !queryState.isInvalidated &&
      Date.now() - queryState.dataUpdatedAt < effectiveStaleTime;

    if (isFresh) {
      const raw = (cachedData as { data: unknown }).data ?? cachedData;
      if (responseSchema) {
        const parsed = responseSchema.safeParse(raw);
        if (!parsed.success) {
          const lang: Lang = getCurrentLanguage() as Lang;
          const msg = dictionary[lang]['ERROR_VALIDATION_FAILED'] ?? dictionary[lang]['ERROR_DEFAULT'];
          if (onError) onError({ message: msg });
          if (onFinal) onFinal();
          return;
        }
        if (onSuccess) onSuccess(parsed.data);
      } else {
        if (onSuccess) onSuccess(raw);
      }
      if (onFinal) onFinal();
      return;
    }

    const key = queryKey.join('|');

    // If an identical fetch is already in flight, piggyback on it rather than
    // firing a second network request (and a second onStart/onFinal pair).
    if (inflight.has(key)) {
      inflight.get(key)!
        .then((response) => {
          const raw = (response as { data: unknown }).data ?? response;
          if (responseSchema) {
            const parsed = responseSchema.safeParse(raw);
            if (!parsed.success) {
              const lang: Lang = getCurrentLanguage() as Lang;
              const msg = dictionary[lang]['ERROR_VALIDATION_FAILED'] ?? dictionary[lang]['ERROR_DEFAULT'];
              if (onError) onError({ message: msg });
            } else {
              if (onSuccess) onSuccess(parsed.data);
            }
          } else {
            if (onSuccess) onSuccess(raw);
          }
        })
        .catch((err: { isCancelled?: boolean; messageKey?: string }) => {
          if (err?.isCancelled) return;
          const lang: Lang = getCurrentLanguage() as Lang;
          const msg = dictionary[lang][err?.messageKey ?? 'ERROR_DEFAULT'] ?? dictionary[lang]['ERROR_DEFAULT'];
          if (onError) onError({ message: msg });
        })
        .finally(() => { if (onFinal) onFinal(); });
      return;
    }

    if (onStart) onStart();

    const promise = queryClient.fetchQuery({
      queryKey,
      queryFn: ({ signal }) => apiClient.get(endpoint, { signal }),
    });

    inflight.set(key, promise);

    promise
      .then((response) => {
        const raw = (response as { data: unknown }).data ?? response;
        if (responseSchema) {
          const parsed = responseSchema.safeParse(raw);
          if (!parsed.success) {
            const lang: Lang = getCurrentLanguage() as Lang;
            const msg = dictionary[lang]['ERROR_VALIDATION_FAILED'] ?? dictionary[lang]['ERROR_DEFAULT'];
            if (onError) onError({ message: msg });
            return;
          }
          if (onSuccess) onSuccess(parsed.data);
        } else {
          if (onSuccess) onSuccess(raw);
        }
      })
      .catch((err: { isCancelled?: boolean; messageKey?: string }) => {
        if (err?.isCancelled) return;
        const lang: Lang = getCurrentLanguage() as Lang;
        const msg = dictionary[lang][err?.messageKey ?? 'ERROR_DEFAULT'] ?? dictionary[lang]['ERROR_DEFAULT'];
        if (onError) onError({ message: msg });
      })
      .finally(() => {
        inflight.delete(key);
        if (onFinal) onFinal();
      });
  }

  /** POST / PATCH / DELETE with optional optimistic update + cache invalidation */
  static executeMutation({
    mutationFn,
    invalidateKeys = [],
    optimisticConfig = null,
    onProgress,
    onStart,
    onSuccess,
    onError,
    onFinal,
  }: MutationOptions) {
    if (onStart) onStart();

    let prev: unknown = undefined;
    if (optimisticConfig) {
      prev = queryClient.getQueryData(optimisticConfig.queryKey);
      queryClient.setQueryData(optimisticConfig.queryKey, optimisticConfig.newData);
    }

    const config = onProgress
      ? {
          onUploadProgress: (e: { loaded: number; total?: number }) =>
            onProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
        }
      : undefined;

    (mutationFn(config) as Promise<{ messageKey?: string; data?: unknown }>)
      .then((res) => {
        const lang: Lang = getCurrentLanguage() as Lang;
        const msg = dictionary[lang][res?.messageKey ?? 'SUCCESS_DEFAULT'] ?? dictionary[lang]['SUCCESS_DEFAULT'];
        invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
        if (onSuccess) onSuccess(res?.data ?? res, msg);
      })
      .catch((err: { isCancelled?: boolean; messageKey?: string; fields?: Record<string, string> }) => {
        if (optimisticConfig && prev !== undefined) queryClient.setQueryData(optimisticConfig.queryKey, prev);
        const lang: Lang = getCurrentLanguage() as Lang;
        const msg = dictionary[lang][err?.messageKey ?? 'ERROR_DEFAULT'] ?? dictionary[lang]['ERROR_DEFAULT'];
        let fields: Record<string, string> | null = null;
        if (err?.fields) {
          fields = {};
          Object.entries(err.fields).forEach(([k, v]) => {
            fields![k] = dictionary[lang][v] ?? v;
          });
        }
        if (onError) onError({ message: msg, fields });
      })
      .finally(() => { if (onFinal) onFinal(); });
  }
}

export default ApiManager;
