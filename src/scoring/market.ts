// The cars a price can fairly be compared with: the same kind, seen recently, grouped by the
// state of their body.
import type { Listing, Observation, PartStatus, Scorable } from '../types';
import type { Config } from './config';

export type ConditionClass = 'clean' | 'painted' | 'replaced';
export const CONDITIONS: ConditionClass[] = ['clean', 'painted', 'replaced'];

export type Peer = Observation & { condition: ConditionClass };

export interface Market {
  /** The group of the car being looked at; null when it cannot be grouped. */
  own: ConditionClass | null;
  groups: Record<ConditionClass, { count: number; median: number | null }>;
  peers: Peer[]; // cheapest first
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Series is matched so that equal model names in different series do not mix. The model name
// carries the package.
const MATCH_FIELDS = ['brand', 'series', 'model', 'fuel', 'gearbox'] as const;

const normalise = (value: string | null) => value?.trim().toLocaleLowerCase('tr-TR') ?? '';

/** Null while any panel is unknown: a missing value never counts as clean. */
export function conditionOf(parts: Record<string, PartStatus>, cfg: Config): ConditionClass | null {
  const states = cfg.damage.parts.map(({ key }) => parts[key] ?? 'unknown');
  if (states.length === 0 || states.includes('unknown')) return null;
  if (states.includes('replaced')) return 'replaced';
  const painted = states.filter((s) => s === 'painted' || s === 'localPaint').length;
  return painted > cfg.price.cleanMaxPainted ? 'painted' : 'clean';
}

/**
 * Saved listings and listings only looked at, one per number. A saved entry holds the owner's
 * corrections, so it wins, except that a later sight has the newer price.
 */
function combine(saved: Listing[], seen: Observation[]): Observation[] {
  const byId = new Map(seen.map((item) => [item.id, item]));
  for (const entry of saved) {
    const sight = byId.get(entry.id);
    const later = sight && Date.parse(sight.seenAt) > Date.parse(entry.savedAt);
    byId.set(entry.id, {
      ...entry,
      price: later ? sight.price : entry.price,
      seenAt: later ? sight.seenAt : entry.savedAt,
    });
  }
  return [...byId.values()];
}

function isSimilar(target: Scorable, other: Observation, now: Date, cfg: Config): boolean {
  const rules = cfg.price;
  if (other.id === target.id || other.heavyDamage === true) return false;
  if (other.price === null || other.price <= 0) return false;
  if (target.year === null || other.year === null) return false;
  if (Math.abs(other.year - target.year) > rules.yearSpread) return false;
  if (target.km === null || other.km === null) return false;
  if (Math.abs(other.km - target.km) > rules.kmSpread) return false;
  const age = now.getTime() - Date.parse(other.seenAt);
  // Written this way so that an unreadable date (NaN) is left out too.
  if (!(age <= rules.maxAgeDays * DAY_MS)) return false;
  return MATCH_FIELDS.every((field) => {
    const wanted = normalise(target[field]);
    return wanted !== '' && wanted === normalise(other[field]); // a blank value never matches
  });
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function market(
  target: Scorable,
  saved: Listing[],
  seen: Observation[],
  now: Date,
  cfg: Config,
): Market {
  const peers = combine(saved, seen)
    .filter((other) => isSimilar(target, other, now, cfg))
    .flatMap((other) => {
      const condition = conditionOf(other.parts, cfg);
      return condition ? [{ ...other, condition }] : [];
    })
    .sort((a, b) => a.price! - b.price!);

  const group = (condition: ConditionClass) => {
    const prices = peers.filter((p) => p.condition === condition).map((p) => p.price!);
    return { count: prices.length, median: prices.length > 0 ? median(prices) : null };
  };

  return {
    // A heavily damaged car does not belong with any group.
    own: target.heavyDamage === true ? null : conditionOf(target.parts, cfg),
    groups: { clean: group('clean'), painted: group('painted'), replaced: group('replaced') },
    peers,
  };
}
