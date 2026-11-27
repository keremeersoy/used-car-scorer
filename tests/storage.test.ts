import { createListingStore, STORE_KEY, StorageDataError } from '../src/storage/listings';
import { listing } from './helpers';

/** In-memory stand-in for chrome.storage: asynchronous, and it copies values like the real one. */
function fakeArea(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = structuredClone(initial);
  return {
    data,
    get: async (key: string): Promise<Record<string, unknown>> =>
      key in data ? { [key]: structuredClone(data[key]) } : {},
    set: async (items: Record<string, unknown>): Promise<void> => {
      Object.assign(data, structuredClone(items));
    },
  };
}

test('same id updates, newest first, remove deletes', async () => {
  const store = createListingStore(fakeArea());
  await store.save(listing({ id: '1', savedAt: '2026-11-01T00:00:00Z' }));
  await store.save(listing({ id: '2', savedAt: '2026-11-02T00:00:00Z' }));
  await store.save(listing({ id: ' 1 ', price: 900_000, savedAt: '2026-11-03T00:00:00Z' }));
  expect((await store.getAll()).map((l) => [l.id, l.price]))
    .toEqual([['1', 900_000], ['2', 1_000_000]]);
  await store.remove('1');
  expect((await store.getAll()).map((l) => l.id)).toEqual(['2']);
});

test('concurrent saves keep both', async () => {
  const store = createListingStore(fakeArea());
  await Promise.all([store.save(listing({ id: 'a' })), store.save(listing({ id: 'b' }))]);
  expect(await store.getAll()).toHaveLength(2);
});

test('a blank id is rejected', async () => {
  await expect(createListingStore(fakeArea()).save(listing({ id: '  ' }))).rejects.toThrow();
});

test.each([
  { version: 2, listings: {} },
  { version: 1, listings: null },
  { version: 1, listings: { 1: { id: '1' } } },
  'junk',
])('unreadable data %j is reported and left untouched', async (bad) => {
  const area = fakeArea({ [STORE_KEY]: bad });
  const store = createListingStore(area);
  await expect(store.getAll()).rejects.toThrow(StorageDataError);
  await expect(store.save(listing())).rejects.toThrow(StorageDataError);
  await expect(store.remove('1')).rejects.toThrow(StorageDataError);
  expect(area.data[STORE_KEY]).toEqual(bad);
});

test('a failed write rejects and does not block later writes', async () => {
  const area = fakeArea();
  const set = area.set;
  area.set = async () => {
    area.set = set;
    throw new Error('quota');
  };
  const store = createListingStore(area);
  await expect(store.save(listing({ id: 'a' }))).rejects.toThrow('quota');
  await store.save(listing({ id: 'b' }));
  expect(await store.getAll()).toHaveLength(1);
});
