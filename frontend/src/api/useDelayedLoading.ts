import { useState, useRef, useCallback } from 'react';

export const useDelayedLoading = (delayMs = 200) => {
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLoading = useCallback(() => {
    timerRef.current = setTimeout(() => setIsLoading(true), delayMs);
  }, [delayMs]);

  const stopLoading = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
  }, []);

  return { isLoading, startLoading, stopLoading };
};
