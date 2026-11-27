import type { Listing, Observation, Scorable } from '../types';
import type { Config } from './config';
import { type ConditionClass, market } from './market';
import type { PriceBand, SectionResult } from './types';

export type Reference =
  | { value: number; source: 'manual'; count: null }
  | { value: number; source: 'median'; count: number; condition: ConditionClass; lowData: boolean }
  | { value: null; found: number; why: 'few' | 'heavy' | 'parts' };

export function findReference(
  target: Scorable,
  saved: Listing[],
  now: Date,
  cfg: Config,
  seen: Observation[] = [],
): Reference {
  if (target.referencePrice !== null && target.referencePrice > 0) {
    return { value: target.referencePrice, source: 'manual', count: null };
  }
  const { own, groups } = market(target, saved, seen, now, cfg);
  if (own === null) {
    return { value: null, found: 0, why: target.heavyDamage === true ? 'heavy' : 'parts' };
  }
  const { count, median } = groups[own];
  if (median === null || count < cfg.price.lowComparables) {
    return { value: null, found: count, why: 'few' };
  }
  const lowData = count < cfg.price.minComparables;
  return { value: median, source: 'median', count, condition: own, lowData };
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
  seen: Observation[] = [],
): SectionResult {
  const max = cfg.weights.price;
  const { price } = target;
  // Without its own price there is nothing to compare, which is not a lack of references.
  if (price === null || price <= 0) return { points: null, max, reasons: [], warnings: [] };

  const reference = findReference(target, saved, now, cfg, seen);
  if (reference.value === null) {
    return {
      points: null,
      max,
      reasons: [{ code: 'noReference', found: reference.found, why: reference.why }],
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
        ...(reference.source === 'median' && {
          condition: reference.condition,
          lowData: reference.lowData,
        }),
      },
    ],
    warnings: [],
  };
}
