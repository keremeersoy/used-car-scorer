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

export function createListingStore(area: StorageArea) {
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
    const result = queue.then(async () => {
      const stored = await read();
      apply(stored.listings);
      await area.set({ [STORE_KEY]: stored });
    });
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
    async save(listing: Listing): Promise<void> {
      const id = listing.id.trim();
      // '__proto__' as a key would replace the object's prototype instead of adding an entry.
      if (id === '' || id === '__proto__') throw new Error('A listing number is required to save');
      await change((listings) => {
        listings[id] = { ...listing, id };
      });
    },
    async remove(id: string): Promise<void> {
      await change((listings) => {
        delete listings[id];
      });
    },
  };
}
