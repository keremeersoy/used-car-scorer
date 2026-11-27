import { useCallback, useEffect, useState } from 'react';
import { createSeenStore, SEEN_KEY } from '../storage/seen';
import type { Observation } from '../types';

const store = createSeenStore(
  {
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items),
  },
  async (task) => await navigator.locks.request(SEEN_KEY, task),
);

/** The listings remembered for price comparison. Failing to remember one never gets in the way. */
export function useSeen() {
  const [seen, setSeen] = useState<Observation[]>([]);

  const reload = useCallback(async () => {
    setSeen(await store.getAll().catch(() => []));
  }, []);

  useEffect(() => {
    void reload();
    const onChanged = (changes: Record<string, unknown>) => {
      if (SEEN_KEY in changes) void reload();
    };
    chrome.storage.local.onChanged.addListener(onChanged);
    return () => chrome.storage.local.onChanged.removeListener(onChanged);
  }, [reload]);

  const change = useCallback(
    async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (cause) {
        console.error(cause);
      }
      await reload();
    },
    [reload],
  );

  const record = useCallback(
    (item: Observation) => change(() => store.record(item, new Date())),
    [change],
  );
  const clear = useCallback(() => change(() => store.clear()), [change]);

  return { seen, record, clear };
}
