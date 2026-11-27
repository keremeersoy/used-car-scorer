// Listings the owner has looked at, kept only to compare prices. It is a cache: it can be
// cleared at any time, and unreadable data is simply replaced.
import { config } from '../scoring/config';
import type { Observation, PageRead } from '../types';
import type { Lock, StorageArea } from './listings';

export const SEEN_KEY = 'seenListings';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Stored {
  version: 1;
  items: Record<string, Observation>;
}

/** Only what comparing needs: no description and nothing about the seller. */
export function observationOf(read: PageRead, now: Date): Observation | null {
  const { id, url, title, brand, series, model, year, km, fuel, gearbox, price } = read;
  if (!id || !price) return null;
  const { heavyDamage, parts } = read;
  return {
    id,
    url,
    title,
    brand,
    series,
    model,
    year,
    km,
    fuel,
    gearbox,
    price,
    heavyDamage,
    parts,
    seenAt: now.toISOString(),
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isObservation = (value: unknown): value is Observation =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.seenAt === 'string' &&
  isObject(value.parts);

export function createSeenStore(
  area: StorageArea,
  lock: Lock = (task) => task(),
  limits = { maxAgeDays: config.price.maxAgeDays, limit: config.price.maxSeen },
) {
  const read = async (): Promise<Observation[]> => {
    const raw = (await area.get(SEEN_KEY))[SEEN_KEY];
    if (!isObject(raw) || raw.version !== 1 || !isObject(raw.items)) return [];
    return Object.values(raw.items).filter(isObservation);
  };
  const write = (items: Observation[]) => {
    const stored: Stored = {
      version: 1,
      items: Object.fromEntries(items.map((item) => [item.id, item])),
    };
    return area.set({ [SEEN_KEY]: stored });
  };

  let queue: Promise<unknown> = Promise.resolve();
  const serial = (task: () => Promise<void>): Promise<void> => {
    const result = queue.then(() => lock(task));
    queue = result.catch(() => undefined);
    return result;
  };

  return {
    getAll: read,
    record(item: Observation, now: Date): Promise<void> {
      return serial(async () => {
        const oldest = now.getTime() - limits.maxAgeDays * DAY_MS;
        const kept = (await read())
          .filter((other) => other.id !== item.id && Date.parse(other.seenAt) >= oldest)
          .concat(item)
          .sort((a, b) => Date.parse(b.seenAt) - Date.parse(a.seenAt))
          .slice(0, limits.limit);
        await write(kept);
      });
    },
    clear: (): Promise<void> => serial(() => write([])),
  };
}
