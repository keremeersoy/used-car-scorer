import { createSeenStore, observationOf, SEEN_KEY } from '../src/storage/seen';
import { NOW, observation, page } from './helpers';

function fakeArea(initial: Record<string, unknown> = {}) {
  const data = structuredClone(initial);
  return {
    data,
    get: async (key: string): Promise<Record<string, unknown>> =>
      key in data ? { [key]: structuredClone(data[key]) } : {},
    set: async (items: Record<string, unknown>): Promise<void> => {
      Object.assign(data, structuredClone(items));
    },
  };
}

test('a page read becomes an observation only with a number and a price', () => {
  expect(observationOf(page({ price: 5 }), NOW)).toMatchObject({
    id: '1',
    price: 5,
    seenAt: NOW.toISOString(),
  });
  expect(observationOf(page({ price: null }), NOW)).toBeNull();
  expect(observationOf({ ...page(), id: null }, NOW)).toBeNull();
  expect(observationOf(page(), NOW)).not.toHaveProperty('description');
});

test('the latest sight of a listing replaces the earlier one', async () => {
  const store = createSeenStore(fakeArea());
  await store.record(observation({ id: 'a', price: 1 }), NOW);
  await store.record(observation({ id: 'a', price: 2 }), NOW);
  expect((await store.getAll()).map((o) => o.price)).toEqual([2]);
});

test('old sights are forgotten and only the newest are kept', async () => {
  const store = createSeenStore(fakeArea(), undefined, { maxAgeDays: 30, limit: 2 });
  await store.record(observation({ id: 'old', savedAt: '2026-10-01T00:00:00Z' }), NOW);
  for (const day of ['10', '11', '12']) {
    await store.record(observation({ id: day, savedAt: `2026-11-${day}T00:00:00Z` }), NOW);
  }
  expect((await store.getAll()).map((o) => o.id).sort()).toEqual(['11', '12']);
});

test('unreadable data is only a cache, so it is replaced', async () => {
  const area = fakeArea({ [SEEN_KEY]: 'junk' });
  const store = createSeenStore(area);
  expect(await store.getAll()).toEqual([]);
  await store.record(observation({ id: 'a' }), NOW);
  expect(await store.getAll()).toHaveLength(1);
});

test('the pool can be cleared', async () => {
  const store = createSeenStore(fakeArea());
  await store.record(observation({ id: 'a' }), NOW);
  await store.clear();
  expect(await store.getAll()).toEqual([]);
});
