import type { Listing, Scorable } from '../types';
import type { Config } from './config';
import type { PriceBand, SectionResult } from './types';

export type Reference =
  | { value: number; source: 'manual' | 'median'; count: number | null }
  | { value: null; found: number };

const DAY_MS = 24 * 60 * 60 * 1000;
// Series is matched so that equal model names in different series do not mix.
const MATCH_FIELDS = ['brand', 'series', 'model', 'engine', 'fuel', 'gearbox'] as const;

const normalise = (value: string | null) => value?.trim().toLocaleLowerCase('tr-TR') ?? '';

function isComparable(target: Scorable, other: Listing, now: Date, cfg: Config): boolean {
  if (other.id === target.id || other.heavyDamage === true) return false;
  if (other.price === null || other.price <= 0) return false;
  if (target.year === null || other.year === null) return false;
  if (Math.abs(other.year - target.year) > cfg.price.yearSpread) return false;
  if (now.getTime() - Date.parse(other.savedAt) > cfg.price.maxAgeDays * DAY_MS) return false;
  return MATCH_FIELDS.every((field) => {
    const wanted = normalise(target[field]);
    return wanted !== '' && wanted === normalise(other[field]); // a blank value never matches
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function findReference(
  target: Scorable,
  saved: Listing[],
  now: Date,
  cfg: Config,
): Reference {
  if (target.referencePrice !== null && target.referencePrice > 0) {
    return { value: target.referencePrice, source: 'manual', count: null };
  }
  const prices = saved
    .filter((other) => isComparable(target, other, now, cfg))
    .map((other) => other.price!);
  if (prices.length < cfg.price.minComparables) return { value: null, found: prices.length };
  return { value: median(prices), source: 'median', count: prices.length };
}

function bandFor(diff: number, cfg: Config): PriceBand {
  if (diff <= cfg.price.cheapAt) return 'veryCheap';
  if (diff < cfg.price.goodBelow) return 'good';
  if (diff <= cfg.price.normalUpTo) return 'normal';
  if (diff <= cfg.price.highUpTo) return 'high';
  return 'expensive';
}

export function scorePrice(
  target: Scorable,
  saved: Listing[],
  now: Date,
  cfg: Config,
): SectionResult {
  const max = cfg.weights.price;
  const { price } = target;
  // Without its own price there is nothing to compare, which is not a lack of references.
  if (price === null || price <= 0) return { points: null, max, reasons: [], warnings: [] };

  const reference = findReference(target, saved, now, cfg);
  if (reference.value === null) {
    return {
      points: null,
      max,
      reasons: [{ code: 'noReference', found: reference.found }],
      warnings: ['noReference'],
    };
  }

  const diff = (price - reference.value) / reference.value;
  const band = bandFor(diff, cfg);
  return {
    points: cfg.price.points[band],
    max,
    reasons: [
      {
        code: 'priceBand',
        band,
        diff,
        reference: reference.value,
        source: reference.source,
        count: reference.count,
      },
    ],
    warnings: [],
  };
}
