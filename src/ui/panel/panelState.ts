import { draftFromPage, draftFromSaved, emptyDraft, type Draft } from '../../draft/draft';
import type { ExtractNotice, ExtractResult } from '../../extract/types';
import type { Listing } from '../../types';

type PageResult = { kind: 'page' } & ExtractResult;
export type ReadResult = PageResult | { kind: 'notSahibinden' } | { kind: 'noAccess' };
export type Incoming = PageResult | { kind: 'saved'; listing: Listing };
export type Notice = 'unreadable' | 'notSahibinden' | 'noAccess' | ExtractNotice;

export interface PanelState {
  draft: Draft | null;
  /** Waiting because the draft has unsaved edits. Turned into a draft only when shown. */
  pending: Incoming | null;
  notices: Notice[];
  /** Increases whenever the draft is replaced, so the form can start over. */
  revision: number;
}

export const initialState: PanelState = { draft: null, pending: null, notices: [], revision: 0 };

const findById = (saved: Listing[], id: string | null) => saved.find((l) => l.id === id);

function show(state: PanelState, incoming: Incoming, saved: Listing[]): PanelState {
  let draft: Draft;
  let notices: Notice[] = [];
  if (incoming.kind === 'saved') {
    draft = draftFromSaved(findById(saved, incoming.listing.id) ?? incoming.listing);
  } else if (!incoming.recognised) {
    draft = emptyDraft(incoming.read.url);
    notices = ['unreadable', ...incoming.notices];
  } else {
    draft = draftFromPage(incoming.read, findById(saved, incoming.read.id));
    notices = [...incoming.notices];
  }
  return { draft, pending: null, notices, revision: state.revision + 1 };
}

export function receive(
  state: PanelState,
  result: ReadResult | Incoming,
  saved: Listing[],
): PanelState {
  if (result.kind === 'notSahibinden' || result.kind === 'noAccess') {
    return { ...state, notices: [result.kind] };
  }
  if (state.draft?.dirty) return { ...state, pending: result, notices: [] };
  return show(state, result, saved);
}

export function discardAndReplace(state: PanelState, saved: Listing[]): PanelState {
  return state.pending ? show(state, state.pending, saved) : state;
}

export function keepCurrent(state: PanelState): PanelState {
  return { ...state, pending: null };
}

/** `saved` already includes the entry that was just written. */
export function afterSave(state: PanelState, saved: Listing[]): PanelState {
  if (state.pending) return show(state, state.pending, saved);
  if (!state.draft) return state;
  const entry = findById(saved, state.draft.listing.id.trim());
  const draft = {
    ...state.draft,
    dirty: false,
    savedAt: entry?.savedAt ?? state.draft.savedAt,
    base: entry ?? state.draft.base,
  };
  return { ...state, draft };
}

/**
 * The draft was edited while it was being written. Those edits are still unsaved, but the entry
 * it came from is now the one just written, so saving again replaces nothing unexpected.
 */
export function savedWhileEditing(
  state: PanelState,
  saved: Listing[],
  writtenId: string,
): PanelState {
  const entry = findById(saved, writtenId);
  if (!entry || state.draft?.listing.id.trim() !== writtenId) return state;
  return { ...state, draft: { ...state.draft, savedAt: entry.savedAt, base: entry } };
}

/** The saved entry that saving this draft is allowed to replace, if any. */
export function expectedEntry(draft: Draft): Listing | null {
  return draft.base && draft.base.id === draft.listing.id.trim() ? draft.base : null;
}
