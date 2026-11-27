import { useCallback, useEffect, useState } from 'react';
import {
  createListingStore, STORE_KEY, StorageDataError, type RestoreResult,
} from '../storage/listings';
import type { Listing } from '../types';
import { strings } from './strings';

const store = createListingStore(
  {
    get: (key) => chrome.storage.local.get(key),
    set: (items) => chrome.storage.local.set(items),
  },
  async (task) => await navigator.locks.request(STORE_KEY, task),
);

const describe = (error: unknown, failed: string) =>
  error instanceof StorageDataError
    ? strings.storageUnreadable
    : `${failed} ${error instanceof Error ? error.message : String(error)}`;

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  /** The latest saved listings, or null (and a shown error) when they cannot be read. */
  const load = useCallback(async (): Promise<Listing[] | null> => {
    try {
      return await store.getAll();
    } catch (cause) {
      setError(describe(cause, strings.storageReadFailed));
      return null;
    }
  }, []);

  const reload = useCallback(async () => {
    const saved = await load();
    if (!saved) return;
    setListings(saved);
    setLoaded(true);
    setError(null);
  }, [load]);

  useEffect(() => {
    void reload();
    const onChanged = (changes: Record<string, unknown>) => {
      if (STORE_KEY in changes) void reload();
    };
    chrome.storage.local.onChanged.addListener(onChanged);
    return () => chrome.storage.local.onChanged.removeListener(onChanged);
  }, [reload]);

  const write = useCallback(
    async (operation: () => Promise<void>) => {
      try {
        await operation();
      } catch (cause) {
        setError(describe(cause, strings.storageFailed));
        throw cause;
      }
      await reload();
    },
    [reload],
  );

  const save = useCallback((listing: Listing) => write(() => store.save(listing)), [write]);
  const remove = useCallback((id: string) => write(() => store.remove(id)), [write]);

  const restore = useCallback(
    async (entries: Listing[]) => {
      let result: RestoreResult = { added: 0, updated: 0, skipped: 0 };
      await write(async () => {
        result = await store.restore(entries);
      });
      return result;
    },
    [write],
  );

  return { listings, loaded, error, load, save, remove, restore };
}
