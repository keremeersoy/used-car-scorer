import { BackupError, parseBackup, toBackup } from '../src/storage/backup';
import { createListingStore } from '../src/storage/listings';
import { listing, NOW } from './helpers';

test('a backup restores exactly what was saved', () => {
  const listings = [listing({ id: '1' }), listing({ id: '2', price: null, heavyDamage: null })];
  expect(parseBackup(toBackup(listings, NOW))).toEqual({ listings, rejected: [] });
});

const file = (change: Record<string, unknown>) =>
  JSON.stringify({ app: 'usedCarScorer', version: 1, listings: [{ ...listing(), ...change }] });

test.each([
  ['text that is not JSON', 'junk'],
  ['another file', '{"hello": 1}'],
  ['a newer version', JSON.stringify({ app: 'usedCarScorer', version: 2, listings: [] })],
])('rejects %s as a whole', (_, text) => {
  expect(() => parseBackup(text)).toThrow(BackupError);
});

test.each([
  ['id', { id: ' ' }],
  ['id', { id: '__proto__' }],
  ['price', { price: '1000' }],
  ['km', { km: -1 }],
  ['parts', { parts: { roof: 'fine' } }],
  ['savedAt', { savedAt: 'yesterday' }],
  ['savedAt', { savedAt: '1' }],
  ['savedAt', { savedAt: '9999-01-02T00:00:00Z' }],
  ['updatedAt', { updatedAt: '9999-01-02T00:00:00Z' }],
  ['year', { year: 2108 }],
  ['editedFields', { editedFields: undefined }],
])('leaves out an entry with a bad %s and says which', (field, change) => {
  const result = parseBackup(file(change));
  expect(result.listings).toEqual([]);
  expect(result.rejected).toMatchObject([{ position: 1, field }]);
});

test('good entries load even when others are broken', () => {
  const entries = [listing({ id: 'a' }), 'junk', { ...listing({ id: 'b' }), km: -1 }];
  const result = parseBackup(
    JSON.stringify({ app: 'usedCarScorer', version: 1, listings: entries }),
  );
  expect(result.listings.map((l) => l.id)).toEqual(['a']);
  expect(result.rejected).toEqual([
    { position: 2, id: null, field: null },
    { position: 3, id: 'b', field: 'km' },
  ]);
});

test('fields the app does not know are dropped', () => {
  expect(parseBackup(file({ extra: '<script>' })).listings[0]).not.toHaveProperty('extra');
});

const memoryStore = (clock: () => Date = () => new Date()) => {
  const data: Record<string, unknown> = {};
  return createListingStore(
    {
      get: async (key) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
      set: async (items) => void Object.assign(data, structuredClone(items)),
    },
    undefined,
    clock,
  );
};

test('a correction that keeps the page date still restores onto an older copy', async () => {
  const entry = listing({ id: '1', km: 1, savedAt: '2026-11-01T00:00:00.000Z' });
  const there = memoryStore(() => new Date('2026-11-20T00:00:00Z'));
  await there.save({ ...entry, km: 2 }); // corrected on another machine, same savedAt
  const here = memoryStore(() => new Date('2026-11-10T00:00:00Z'));
  await here.save(entry);
  const backup = parseBackup(toBackup(await there.getAll(), NOW), NOW);
  expect(await here.restore(backup.listings)).toEqual({ added: 0, updated: 1, skipped: 0 });
  expect((await here.getAll())[0]).toMatchObject({ km: 2, updatedAt: '2026-11-20T00:00:00.000Z' });
});

test('an older backup does not undo a later correction', async () => {
  const entry = listing({ id: '1', km: 1, savedAt: '2026-11-01T00:00:00.000Z' });
  const store = memoryStore(() => new Date('2026-11-10T00:00:00Z'));
  await store.save({ ...entry, km: 2 });
  // A backup made before updatedAt existed has only the page date.
  expect(await store.restore([entry])).toEqual({ added: 0, updated: 0, skipped: 1 });
  expect((await store.getAll())[0]!.km).toBe(2);
});

test('restoring never replaces a newer saved entry', async () => {
  const store = memoryStore(() => new Date('2026-11-01T00:00:00Z'));
  await store.restore([listing({ id: 'kept', km: 1, savedAt: '2026-11-20T00:00:00Z' })]);
  await store.restore([listing({ id: 'old', km: 1, savedAt: '2026-11-01T00:00:00Z' })]);
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
  const store = memoryStore();
  const result = await store.restore([
    listing({ id: '9', km: 1, savedAt: '2026-11-01T00:00:00Z' }),
    listing({ id: '9 ', km: 2, savedAt: '2026-11-02T00:00:00Z' }),
  ]);
  expect(result).toEqual({ added: 1, updated: 0, skipped: 1 });
  expect((await store.getAll()).map((l) => l.km)).toEqual([2]);
});

test('notes are backed up, and older backups without them still load', () => {
  const noted = listing({ note: 'Satıcı ile konuştum' });
  expect(parseBackup(toBackup([noted], NOW), NOW).listings).toEqual([noted]);
  expect(parseBackup(file({ note: undefined }), NOW).listings).toHaveLength(1);
  expect(parseBackup(file({ note: 5 }), NOW).rejected).toMatchObject([{ field: 'note' }]);
});
