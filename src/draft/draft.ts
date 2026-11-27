import type { Listing, ListingData, PageRead, PartStatus } from '../types';

export type FieldKey = Exclude<keyof ListingData, 'parts'> | 'id' | 'referencePrice' | 'note';
export type EditKey = FieldKey | `parts.${string}`;

/** A listing being reviewed. Every function here returns a new draft. */
export interface Draft {
  listing: Omit<Listing, 'savedAt'>;
  savedAt: string | null;
  /** The saved entry this draft started from; saving may replace only that one. */
  base: Listing | null;
  fromPage: boolean;
  /** What the page states where the draft keeps something else. */
  pageValues: Partial<Record<EditKey, unknown>>;
  dirty: boolean;
}

const DATA_FIELDS = [
  'title',
  'price',
  'brand',
  'series',
  'model',
  'year',
  'km',
  'fuel',
  'gearbox',
  'engine',
  'heavyDamage',
  'damageRecordTL',
  'description',
] as const satisfies readonly Exclude<keyof ListingData, 'parts'>[];

const PART_PREFIX = 'parts.';

const blank = (url: string): Draft['listing'] => ({
  id: '',
  url,
  title: null,
  price: null,
  brand: null,
  series: null,
  model: null,
  year: null,
  km: null,
  fuel: null,
  gearbox: null,
  engine: null,
  heavyDamage: null,
  damageRecordTL: null,
  parts: {},
  description: null,
  referencePrice: null,
  note: null,
  editedFields: [],
});

export function emptyDraft(url: string): Draft {
  const listing = blank(url);
  return { listing, savedAt: null, base: null, fromPage: false, pageValues: {}, dirty: false };
}

export function draftFromSaved(saved: Listing): Draft {
  const { savedAt, ...listing } = saved;
  return {
    listing: structuredClone(listing),
    savedAt,
    base: saved,
    fromPage: false,
    pageValues: {},
    dirty: false,
  };
}

/** Typed values win over the page; otherwise a stated page value wins over the saved one. */
export function draftFromPage(page: PageRead, saved: Listing | undefined): Draft {
  const edited = new Set(saved?.editedFields);
  const pageValues: Draft['pageValues'] = {};
  const merge = <T>(key: EditKey, stated: T | null, kept: T | null): T | null => {
    if (!edited.has(key)) return stated ?? kept;
    if (stated !== null && stated !== kept) pageValues[key] = stated;
    return kept;
  };

  const listing = blank(page.url);
  listing.id = page.id ?? saved?.id ?? '';
  // Never on the page, so they always come from the saved entry.
  listing.referencePrice = saved?.referencePrice ?? null;
  listing.note = saved?.note ?? null;
  listing.editedFields = [...edited];

  const target = listing as unknown as Record<string, unknown>;
  for (const field of DATA_FIELDS) {
    target[field] = merge<unknown>(field, page[field], saved?.[field] ?? null);
  }

  const known = (status: PartStatus | undefined) =>
    status === undefined || status === 'unknown' ? null : status;
  const partKeys = new Set([...Object.keys(page.parts), ...Object.keys(saved?.parts ?? {})]);
  // A part the owner set back to unknown still has to stay unknown.
  for (const key of edited) {
    if (key.startsWith(PART_PREFIX)) partKeys.add(key.slice(PART_PREFIX.length));
  }
  for (const part of partKeys) {
    const status = merge(`parts.${part}`, known(page.parts[part]), known(saved?.parts[part]));
    listing.parts[part] = status ?? 'unknown';
  }

  return {
    listing,
    savedAt: saved?.savedAt ?? null,
    base: saved ?? null,
    fromPage: true,
    pageValues,
    dirty: false,
  };
}

const markEdited = (fields: string[], key: EditKey) =>
  fields.includes(key) ? fields : [...fields, key];

export function editField<K extends FieldKey>(draft: Draft, key: K, value: Listing[K]): Draft {
  const listing = { ...draft.listing, [key]: value };
  listing.editedFields = markEdited(draft.listing.editedFields, key);
  return { ...draft, listing, dirty: true };
}

export function editPart(draft: Draft, part: string, status: PartStatus): Draft {
  const listing = {
    ...draft.listing,
    parts: { ...draft.listing.parts, [part]: status },
    editedFields: markEdited(draft.listing.editedFields, `parts.${part}`),
  };
  return { ...draft, listing, dirty: true };
}

/** Replaces a kept value with the page's one and forgets that it was typed. */
export function takePageValue(draft: Draft, key: EditKey): Draft {
  if (!(key in draft.pageValues)) return draft;
  const { [key]: value, ...pageValues } = draft.pageValues;
  const listing = {
    ...draft.listing,
    parts: { ...draft.listing.parts },
    editedFields: draft.listing.editedFields.filter((field) => field !== key),
  };
  if (key.startsWith(PART_PREFIX)) {
    listing.parts[key.slice(PART_PREFIX.length)] = value as PartStatus;
  } else {
    (listing as unknown as Record<string, unknown>)[key] = value;
  }
  return { ...draft, listing, pageValues, dirty: true };
}

export function toListing(draft: Draft, now: Date): Listing {
  // Only a page read shows that the price is current, so only it refreshes the date.
  const savedAt = draft.fromPage || draft.savedAt === null ? now.toISOString() : draft.savedAt;
  return { ...draft.listing, savedAt };
}
