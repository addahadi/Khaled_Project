import { useState, useRef, useCallback } from 'react';

/**
 * Shows a loading skeleton only if the request takes longer than `delayMs`.
 *
 * FIX: Added a `cancelledRef` flag so that if `stopLoading()` is called before
 * the deferred timer fires, the timer callback becomes a no-op instead of
 * setting `isLoading = true` after the data has already arrived.
 */
export const useDelayedLoading = (delayMs = 200) => {
  const [isLoading, setIsLoading] = useState(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const startLoading = useCallback(() => {
    cancelledRef.current = false;
    timerRef.current = setTimeout(() => {
      // Only show skeleton if stopLoading() hasn't already been called
      if (!cancelledRef.current) setIsLoading(true);
    }, delayMs);
  }, [delayMs]);

  const stopLoading = useCallback(() => {
    cancelledRef.current = true;          // prevent deferred setIsLoading(true)
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  return { isLoading, startLoading, stopLoading };
};
