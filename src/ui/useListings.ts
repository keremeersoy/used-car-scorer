import { useCallback, useEffect, useState } from 'react';
import { createListingStore, STORE_KEY, StorageDataError } from '../storage/listings';
import type { Listing } from '../types';
import { strings } from './strings';

const store = createListingStore({
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
});

/** The latest saved listings. Storage errors are reported by the hook, not here. */
export const loadSaved = (): Promise<Listing[]> => store.getAll().catch(() => []);

const describe = (error: unknown) =>
  error instanceof StorageDataError
    ? strings.storageUnreadable
    : `${strings.storageFailed} ${error instanceof Error ? error.message : String(error)}`;

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setListings(await store.getAll());
      setError(null);
    } catch (cause) {
      setError(describe(cause));
    }
  }, []);

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
        setError(describe(cause));
        throw cause;
      }
      await reload();
    },
    [reload],
  );

  const save = useCallback((listing: Listing) => write(() => store.save(listing)), [write]);
  const remove = useCallback((id: string) => write(() => store.remove(id)), [write]);

  return { listings, error, save, remove };
}
