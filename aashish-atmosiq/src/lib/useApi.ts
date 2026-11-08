import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

/** Fetch an API path once (and on retry). Pass `null` to defer the request. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e instanceof ApiError ? e.message : 'Failed to load data.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, retry };
}
