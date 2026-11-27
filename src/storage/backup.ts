// Export and restore of the saved listings. A backup file is untrusted input: every field is
// checked and only known fields are kept.
import type { Listing, PartStatus } from '../types';

export class BackupError extends Error {
  override name = 'BackupError';
}

const APP = 'usedCarScorer';
const PART_STATUSES = new Set<unknown>(['original', 'localPaint', 'painted', 'replaced', 'unknown']);

type Check = (value: unknown) => boolean;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text: Check = (v) => typeof v === 'string';
const optionalText: Check = (v) => v === null || typeof v === 'string';
const optionalNumber: Check = (v) =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

// Listing every key makes the compiler insist that a new field is checked here too.
const FIELDS: Record<keyof Listing, Check> = {
  id: (v) => typeof v === 'string' && v.trim() !== '' && v.trim() !== '__proto__',
  url: text,
  savedAt: (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)),
  title: optionalText,
  price: optionalNumber,
  brand: optionalText,
  series: optionalText,
  model: optionalText,
  year: optionalNumber,
  km: optionalNumber,
  fuel: optionalText,
  gearbox: optionalText,
  engine: optionalText,
  heavyDamage: (v) => v === null || typeof v === 'boolean',
  damageRecordTL: optionalNumber,
  parts: (v) =>
    isObject(v) &&
    Object.entries(v).every(([key, status]) => key !== '__proto__' && PART_STATUSES.has(status as PartStatus)),
  description: optionalText,
  referencePrice: optionalNumber,
  editedFields: (v) => Array.isArray(v) && v.every(text),
};

export function toBackup(listings: Listing[], now: Date): string {
  return JSON.stringify(
    { app: APP, version: 1, exportedAt: now.toISOString(), listings },
    null,
    2,
  );
}

function toListing(value: unknown): Listing {
  if (!isObject(value)) throw new BackupError('An entry is not a listing');
  const entries = Object.entries(FIELDS).map(([field, valid]) => {
    if (!valid(value[field])) throw new BackupError(`Invalid field: ${field}`);
    return [field, value[field]] as const;
  });
  return Object.fromEntries(entries) as unknown as Listing;
}

export function parseBackup(content: string): Listing[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new BackupError('The file is not valid JSON');
  }
  if (!isObject(data) || data.app !== APP || data.version !== 1 || !Array.isArray(data.listings)) {
    throw new BackupError('The file is not a backup of this app');
  }
  return data.listings.map(toListing);
}
