import {
  ConflictError,
  createListingStore,
  STORE_KEY,
  StorageDataError,
} from '../src/storage/listings';
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
  expect((await store.getAll()).map((l) => [l.id, l.price])).toEqual([
    ['1', 900_000],
    ['2', 1_000_000],
  ]);
  await store.remove('1');
  expect((await store.getAll()).map((l) => l.id)).toEqual(['2']);
});

test('concurrent saves keep both', async () => {
  const store = createListingStore(fakeArea());
  await Promise.all([store.save(listing({ id: 'a' })), store.save(listing({ id: 'b' }))]);
  expect(await store.getAll()).toHaveLength(2);
});

test.each(['  ', '__proto__'])('the id %j is rejected', async (id) => {
  await expect(createListingStore(fakeArea()).save(listing({ id }))).rejects.toThrow();
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

test('two panels sharing a lock keep both saves', async () => {
  const area = fakeArea();
  let queue: Promise<unknown> = Promise.resolve();
  const lock = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  };
  await Promise.all([
    createListingStore(area, lock).save(listing({ id: 'a' })),
    createListingStore(area, lock).save(listing({ id: 'b' })),
  ]);
  expect(await createListingStore(area).getAll()).toHaveLength(2);
});

test('a save that expects an older entry is refused and changes nothing', async () => {
  const store = createListingStore(fakeArea());
  const first = listing({ km: 100 });
  await store.save(first, { replacing: null });
  await store.save({ ...first, km: 200 }, { replacing: first });
  await expect(store.save({ ...first, km: 300 }, { replacing: first })).rejects.toThrow(
    ConflictError,
  );
  await expect(store.save(first, { replacing: null })).rejects.toThrow(ConflictError);
  expect((await store.getAll())[0]!.km).toBe(200);
});

test('key order does not make an unchanged entry look changed', async () => {
  const store = createListingStore(fakeArea());
  const entry = listing();
  await store.save(entry);
  const reordered = Object.fromEntries(Object.entries(entry).reverse()) as unknown as typeof entry;
  await expect(store.save(entry, { replacing: reordered })).resolves.toBeUndefined();
});
