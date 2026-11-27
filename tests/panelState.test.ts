import { editField, toListing } from '../src/draft/draft';
import type { Listing } from '../src/types';
import {
  afterSave,
  discardAndReplace,
  expectedEntry,
  initialState,
  keepCurrent,
  receive,
  receiveAuto,
} from '../src/ui/panel/panelState';
import { listing, NOW, page } from './helpers';

const incoming = (o: Partial<Listing> = {}, recognised = true) => ({
  kind: 'page' as const,
  read: page(o),
  recognised,
  notices: [],
});

const dirty = () => {
  const state = receive(initialState, incoming(), []);
  return { ...state, draft: editField(state.draft!, 'damageRecordTL', 5_000) };
};

test('a read over unsaved edits waits', () => {
  const state = receive(dirty(), incoming({ id: '2' }), []);
  expect(state.draft!.listing.id).toBe('1');
  expect(state.pending).not.toBeNull();
  expect(discardAndReplace(state, []).draft!.listing.id).toBe('2');
  expect(keepCurrent(state)).toMatchObject({ pending: null, draft: state.draft });
});

test('a replaced draft gets a new revision', () => {
  const first = receive(initialState, incoming(), []);
  const second = receive(first, incoming({ id: '2' }), []);
  expect(second.revision).toBeGreaterThan(first.revision);
});

test('saving first, then re-reading the same listing, keeps the typed value', () => {
  const state = receive(dirty(), incoming(), []);
  const stored = [toListing(state.draft!, NOW)];
  expect(afterSave(state, stored).draft!.listing.damageRecordTL).toBe(5_000);
});

test('saving without a waiting read leaves the draft clean', () => {
  const state = dirty();
  const after = afterSave(state, [toListing(state.draft!, NOW)]);
  expect(after.draft).toMatchObject({ dirty: false, savedAt: NOW.toISOString() });
  expect(after.revision).toBe(state.revision);
});

test('a failed read keeps the draft and shows why', () => {
  const before = dirty();
  const state = receive(before, { kind: 'noAccess' }, []);
  expect(state.draft).toEqual(before.draft);
  expect(state.notices).toEqual(['noAccess']);
});

test('an unreadable page gives an empty form with its URL', () => {
  const state = receive(initialState, incoming({}, false), []);
  expect(state.notices).toContain('unreadable');
  expect(state.draft!.listing).toMatchObject({ id: '', price: null, url: page({}).url });
});

test('opening a saved listing also respects unsaved edits', () => {
  const state = receive(dirty(), { kind: 'saved', listing: listing({ id: '9' }) }, []);
  expect(state.pending).not.toBeNull();
});

test('a draft expects to replace only the entry it was started from', () => {
  const saved = [listing({ id: '7' })];
  const empty = receive(initialState, incoming({}, false), saved).draft!;
  expect(expectedEntry(editField(empty, 'id', '7'))).toBeNull();
  const reread = receive(initialState, incoming({ id: '7' }), saved).draft!;
  expect(expectedEntry(reread)).toEqual(saved[0]);
  expect(expectedEntry(editField(reread, 'id', '8'))).toBeNull();
});

const auto = (o: Partial<Listing> = {}) => incoming(o);

test('an automatic read of the shown listing replaces it only when the page says more', () => {
  const partial = receive(initialState, auto({ price: 900_000, parts: {} }), []);
  const same = receiveAuto(partial, auto({ price: 900_000, parts: {} }), []);
  expect(same).toBe(partial);
  const completed = receiveAuto(partial, auto({ price: 900_000 }), []);
  expect(completed.draft!.listing.parts.roof).toBe('original');
  const dropped = receiveAuto(completed, auto({ price: 850_000 }), []);
  expect(dropped.draft!.listing.price).toBe(850_000);
});

test('a saved listing read again with nothing new stays as it is', () => {
  const stored = [listing({ km: 5, editedFields: ['km'], note: 'x' })];
  const shown = receive(initialState, auto(), stored);
  expect(receiveAuto(shown, auto(), stored)).toBe(shown);
});
