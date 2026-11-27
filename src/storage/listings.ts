import type { Listing } from '../types';

export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export const STORE_KEY = 'usedCarScorer';

interface Stored {
  version: 1;
  listings: Record<string, Listing>;
}

/** Saved data that cannot be understood. It is reported and never overwritten. */
export class StorageDataError extends Error {
  override name = 'StorageDataError';
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isListing = (value: unknown): value is Listing =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.savedAt === 'string' &&
  isObject(value.parts) &&
  Array.isArray(value.editedFields);

/** The saved entry is not the one the caller meant to replace. Nothing was written. */
export class ConflictError extends Error {
  override name = 'ConflictError';
}

// The browser does not keep key order, so keys are sorted before comparing. updatedAt is left out:
// it says when an entry was written, not what is in it.
const canonical = (value: unknown) =>
  JSON.stringify(value, (key, v) => {
    if (key === 'updatedAt') return undefined;
    return isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v;
  });

/** When the entry last changed. A correction keeps savedAt, so that alone is not enough. */
const changedAt = (listing: Listing) => Date.parse(listing.updatedAt ?? listing.savedAt);

export interface RestoreResult {
  added: number;
  updated: number;
  skipped: number; // the saved entry was as new or newer
}

/** Runs a task while no other holder of the lock runs. */
export type Lock = <T>(task: () => Promise<T>) => Promise<T>;

export function createListingStore(
  area: StorageArea,
  lock: Lock = (task) => task(),
  now: () => Date = () => new Date(),
) {
  const read = async (): Promise<Stored> => {
    const raw = (await area.get(STORE_KEY))[STORE_KEY];
    if (raw === undefined) return { version: 1, listings: {} };
    if (
      !isObject(raw) ||
      raw.version !== 1 ||
      !isObject(raw.listings) ||
      !Object.values(raw.listings).every(isListing)
    ) {
      throw new StorageDataError('Saved listings are in an unreadable format');
    }
    return raw as unknown as Stored;
  };

  // Writes run one after another, so two read-modify-write cycles cannot interleave.
  let queue: Promise<unknown> = Promise.resolve();
  const change = (apply: (listings: Stored['listings']) => void): Promise<void> => {
    // The lock does the same across panels in different windows.
    const result = queue.then(() =>
      lock(async () => {
        const stored = await read();
        apply(stored.listings);
        await area.set({ [STORE_KEY]: stored });
      }),
    );
    queue = result.catch(() => undefined); // a failed write must not block later ones
    return result;
  };

  return {
    /** Newest first. */
    async getAll(): Promise<Listing[]> {
      const { listings } = await read();
      return Object.values(listings).sort(
        (a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt),
      );
    },
    /** With `replacing`, writes only if the saved entry still is that one (null: none). */
    async save(listing: Listing, expected?: { replacing: Listing | null }): Promise<void> {
      const id = listing.id.trim();
      // '__proto__' as a key would replace the object's prototype instead of adding an entry.
      if (id === '' || id === '__proto__') throw new Error('A listing number is required to save');
      await change((listings) => {
        // Checked inside the write, so nothing can change between the check and the write.
        const current = Object.hasOwn(listings, id) ? listings[id] : null;
        if (expected && canonical(current) !== canonical(expected.replacing)) {
          throw new ConflictError('The saved entry changed');
        }
        listings[id] = { ...listing, id, updatedAt: now().toISOString() };
      });
    },
    /** Adds entries from a backup. A saved entry is replaced only by a newer one. */
    async restore(entries: Listing[]): Promise<RestoreResult> {
      const result: RestoreResult = { added: 0, updated: 0, skipped: 0 };
      await change((listings) => {
        // Of entries with the same number in one file, only the newest counts.
        const newest = new Map<string, Listing>();
        for (const entry of entries) {
          const id = entry.id.trim();
          const other = newest.get(id);
          if (other) result.skipped++;
          if (!other || changedAt(entry) > changedAt(other)) {
            newest.set(id, entry);
          }
        }
        for (const [id, entry] of newest) {
          const existing = Object.hasOwn(listings, id) ? listings[id] : undefined;
          if (existing && !(changedAt(entry) > changedAt(existing))) {
            result.skipped++;
            continue;
          }
          if (existing) result.updated++;
          else result.added++;
          listings[id] = { ...entry, id };
        }
      });
      return result;
    },
    async remove(id: string): Promise<void> {
      await change((listings) => {
        delete listings[id];
      });
    },
  };
}
