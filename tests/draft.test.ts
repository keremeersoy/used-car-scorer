import {
  draftFromPage,
  draftFromSaved,
  editField,
  editPart,
  emptyDraft,
  takePageValue,
  toListing,
} from '../src/draft/draft';
import { listing, NOW, page } from './helpers';

const saved = listing({
  damageRecordTL: 5_000,
  price: 950_000,
  engine: '1.6',
  referencePrice: 990_000,
  editedFields: ['damageRecordTL', 'parts.p1'],
  parts: { ...listing().parts, p1: 'painted' },
});

test('typed values survive a re-read and show the page value', () => {
  const draft = draftFromPage(page({ damageRecordTL: 7_000, price: 900_000 }), saved);
  expect(draft.listing.damageRecordTL).toBe(5_000);
  expect(draft.listing.parts.p1).toBe('painted');
  expect(draft.pageValues).toEqual({ damageRecordTL: 7_000, 'parts.p1': 'original' });
  expect(draft.listing.price).toBe(900_000);
});

test('a value the page no longer states keeps the saved one', () => {
  const read = page({ engine: null, damageRecordTL: null, parts: { p2: 'unknown' } });
  const draft = draftFromPage(read, saved);
  expect(draft.listing.engine).toBe('1.6');
  expect(draft.listing.parts.p2).toBe('original');
  expect(draft.listing.referencePrice).toBe(990_000);
  expect(draft.pageValues).toEqual({});
});

test('a field the owner cleared stays cleared', () => {
  const draft = draftFromPage(page({ km: 5 }), listing({ km: null, editedFields: ['km'] }));
  expect(draft.listing.km).toBeNull();
});

test('a first read takes the page as it is', () => {
  const draft = draftFromPage({ ...page({ engine: null }), id: null }, undefined);
  expect(draft.listing).toMatchObject({
    id: '',
    engine: null,
    referencePrice: null,
    editedFields: [],
  });
  expect(draft).toMatchObject({ savedAt: null, fromPage: true, dirty: false });
});

test('taking the page value forgets the edit', () => {
  const read = draftFromPage(page({ damageRecordTL: 7_000 }), saved);
  const draft = takePageValue(read, 'damageRecordTL');
  expect(draft.listing.damageRecordTL).toBe(7_000);
  expect(draft.listing.editedFields).toEqual(['parts.p1']);
  expect(draft.dirty).toBe(true);
  expect(takePageValue(draft, 'parts.p1').listing.parts.p1).toBe('original');
});

test('savedAt refreshes only for page reads', () => {
  const old = listing({ savedAt: '2026-01-01T00:00:00.000Z' });
  expect(toListing(editField(draftFromSaved(old), 'km', 1), NOW).savedAt).toBe(old.savedAt);
  expect(toListing(draftFromPage(page({}), old), NOW).savedAt).toBe(NOW.toISOString());
  expect(toListing(emptyDraft('u'), NOW).savedAt).toBe(NOW.toISOString());
});

test('editing marks the draft dirty once per key and leaves the original alone', () => {
  const empty = emptyDraft('u');
  const draft = editPart(editPart(empty, 'roof', 'painted'), 'roof', 'replaced');
  expect(draft.listing.editedFields).toEqual(['parts.roof']);
  expect(draft.listing.parts.roof).toBe('replaced');
  expect(draft.dirty).toBe(true);
  expect(empty.listing.parts).toEqual({});
  expect(empty.dirty).toBe(false);
});
