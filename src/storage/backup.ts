// Export and restore of the saved listings. A backup file is untrusted input: every field is
// checked and only known fields are kept.
import type { Listing, PartStatus } from '../types';

export class BackupError extends Error {
  override name = 'BackupError';
}

const APP = 'usedCarScorer';
const PART_STATUSES = new Set<unknown>([
  'original',
  'localPaint',
  'painted',
  'replaced',
  'unknown',
]);

type Check = (value: unknown) => boolean;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text: Check = (v) => typeof v === 'string';
const optionalText: Check = (v) => v === null || typeof v === 'string';
const optionalNumber: Check = (v) =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
const DAY_MS = 24 * 60 * 60 * 1000;
const OLDEST_YEAR = 1900;

// Listing every key makes the compiler insist that a new field is checked here too.
const fields = (now: Date): Record<keyof Listing, Check> => {
  // A date in the future would win every later restore and never leave the price median.
  const date: Check = (v) =>
    typeof v === 'string' && ISO_DATE.test(v) && Date.parse(v) <= now.getTime() + DAY_MS;

  return {
    id: (v) => typeof v === 'string' && v.trim() !== '' && v.trim() !== '__proto__',
    url: text,
    savedAt: date,
    updatedAt: (v) => v === undefined || date(v),
    title: optionalText,
    price: optionalNumber,
    brand: optionalText,
    series: optionalText,
    model: optionalText,
    year: (v) =>
      v === null ||
      (Number.isInteger(v) &&
        (v as number) >= OLDEST_YEAR &&
        (v as number) <= now.getFullYear() + 1),
    km: optionalNumber,
    fuel: optionalText,
    gearbox: optionalText,
    engine: optionalText,
    heavyDamage: (v) => v === null || typeof v === 'boolean',
    damageRecordTL: optionalNumber,
    parts: (v) =>
      isObject(v) &&
      Object.entries(v).every(
        ([key, status]) => key !== '__proto__' && PART_STATUSES.has(status as PartStatus),
      ),
    description: optionalText,
    referencePrice: optionalNumber,
    note: (v) => v === undefined || optionalText(v),
    editedFields: (v) => Array.isArray(v) && v.every(text),
  };
};

export function toBackup(listings: Listing[], now: Date): string {
  return JSON.stringify({ app: APP, version: 1, exportedAt: now.toISOString(), listings }, null, 2);
}

/** An entry that was left out, and the first thing wrong with it (null: not a listing at all). */
export interface Rejected {
  position: number; // 1-based, in the file
  id: string | null;
  field: keyof Listing | null;
}

export interface Backup {
  listings: Listing[];
  rejected: Rejected[];
}

function readEntry(
  value: unknown,
  position: number,
  checks: Record<keyof Listing, Check>,
): { listing: Listing } | { rejected: Rejected } {
  if (!isObject(value)) return { rejected: { position, id: null, field: null } };
  const names = Object.keys(checks) as (keyof Listing)[];
  const field = names.find((name) => !checks[name](value[name]));
  if (field) {
    // Shortened: it comes from the file and is only used to point at the entry.
    const id = typeof value.id === 'string' ? value.id.trim().slice(0, 30) || null : null;
    return { rejected: { position, id, field } };
  }
  const known = names.filter((name) => value[name] !== undefined);
  return {
    listing: Object.fromEntries(known.map((name) => [name, value[name]])) as unknown as Listing,
  };
}

/** Throws when the file is not a backup; a broken entry is only left out and reported. */
export function parseBackup(content: string, now = new Date()): Backup {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new BackupError('The file is not valid JSON');
  }
  if (!isObject(data) || data.app !== APP || data.version !== 1 || !Array.isArray(data.listings)) {
    throw new BackupError('The file is not a backup of this app');
  }
  const checks = fields(now);
  const backup: Backup = { listings: [], rejected: [] };
  data.listings.forEach((entry, index) => {
    const read = readEntry(entry, index + 1, checks);
    if ('listing' in read) backup.listings.push(read.listing);
    else backup.rejected.push(read.rejected);
  });
  return backup;
}
