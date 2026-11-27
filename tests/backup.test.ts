import { BackupError, parseBackup, toBackup } from '../src/storage/backup';
import { createListingStore } from '../src/storage/listings';
import { listing, NOW } from './helpers';

test('a backup restores exactly what was saved', () => {
  const listings = [listing({ id: '1' }), listing({ id: '2', price: null, heavyDamage: null })];
  expect(parseBackup(toBackup(listings, NOW))).toEqual(listings);
});

const file = (change: Record<string, unknown>) =>
  JSON.stringify({ app: 'usedCarScorer', version: 1, listings: [{ ...listing(), ...change }] });

test.each([
  ['text that is not JSON', 'junk'],
  ['another file', '{"hello": 1}'],
  ['a newer version', JSON.stringify({ app: 'usedCarScorer', version: 2, listings: [] })],
  ['a blank id', file({ id: ' ' })],
  ['a reserved id', file({ id: '__proto__' })],
  ['a price as text', file({ price: '1000' })],
  ['a negative km', file({ km: -1 })],
  ['an unknown part status', file({ parts: { roof: 'fine' } })],
  ['a broken date', file({ savedAt: 'yesterday' })],
  ['a date that is not ISO', file({ savedAt: '1' })],
  ['a date in the future', file({ savedAt: '9999-01-02T00:00:00Z' })],
  ['an impossible year', file({ year: 2108 })],
  ['a missing field', file({ editedFields: undefined })],
])('rejects %s', (_, text) => {
  expect(() => parseBackup(text)).toThrow(BackupError);
});

test('fields the app does not know are dropped', () => {
  expect(parseBackup(file({ extra: '<script>' }))[0]).not.toHaveProperty('extra');
});

test('restoring never replaces a newer saved entry', async () => {
  const data: Record<string, unknown> = {};
  const store = createListingStore({
    get: async (key) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
    set: async (items) => void Object.assign(data, structuredClone(items)),
  });
  await store.save(listing({ id: 'kept', km: 1, savedAt: '2026-11-20T00:00:00Z' }));
  await store.save(listing({ id: 'old', km: 1, savedAt: '2026-11-01T00:00:00Z' }));
  const result = await store.restore([
    listing({ id: 'kept', km: 2, savedAt: '2026-11-10T00:00:00Z' }),
    listing({ id: 'old', km: 2, savedAt: '2026-11-10T00:00:00Z' }),
    listing({ id: 'new', km: 2 }),
  ]);
  expect(result).toEqual({ added: 1, updated: 1, skipped: 1 });
  const km = Object.fromEntries((await store.getAll()).map((l) => [l.id, l.km]));
  expect(km).toEqual({ kept: 1, old: 2, new: 2 });
});

test('the same listing twice in a file is counted once, newest first', async () => {
  const data: Record<string, unknown> = {};
  const store = createListingStore({
    get: async (key) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
    set: async (items) => void Object.assign(data, structuredClone(items)),
  });
  const result = await store.restore([
    listing({ id: '9', km: 1, savedAt: '2026-11-01T00:00:00Z' }),
    listing({ id: '9 ', km: 2, savedAt: '2026-11-02T00:00:00Z' }),
  ]);
  expect(result).toEqual({ added: 1, updated: 0, skipped: 1 });
  expect((await store.getAll()).map((l) => l.km)).toEqual([2]);
});
