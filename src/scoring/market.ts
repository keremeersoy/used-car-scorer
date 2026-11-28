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
  remembered: number; // other listings that were looked at or saved
  leftOut: Partial<Record<LeftOut, number>>;
  /** Fields blank on this car without which nothing can match. */
  unread: (typeof NEEDED)[number][];
}

/** The first reason a remembered car cannot be compared with. */
export type LeftOut =
  | 'otherModel'
  | 'otherPackage'
  | 'otherDrive'
  | 'year'
  | 'km'
  | 'heavy'
  | 'parts'
  | 'old'
  | 'noPrice';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEEDED = ['brand', 'series', 'model', 'fuel', 'gearbox', 'year', 'km'] as const;

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

function whyLeftOut(target: Scorable, other: Observation, now: Date, cfg: Config): LeftOut | null {
  const rules = cfg.price;
  const differs = (field: 'brand' | 'series' | 'model' | 'fuel' | 'gearbox') => {
    const wanted = normalise(target[field]);
    return wanted === '' || wanted !== normalise(other[field]); // a blank value never matches
  };
  const apart = (one: number | null, two: number | null, limit: number) =>
    one === null || two === null || Math.abs(one - two) > limit;

  // Series is matched so that equal model names in different series do not mix. The model name
  // carries the package.
  if (differs('brand') || differs('series')) return 'otherModel';
  if (differs('model')) return 'otherPackage';
  if (differs('fuel') || differs('gearbox')) return 'otherDrive';
  if (apart(target.year, other.year, rules.yearSpread)) return 'year';
  if (apart(target.km, other.km, rules.kmSpread)) return 'km';
  if (other.heavyDamage === true) return 'heavy';
  if (conditionOf(other.parts, cfg) === null) return 'parts';
  const age = now.getTime() - Date.parse(other.seenAt);
  // Written this way so that an unreadable date (NaN) is left out too.
  if (!(age <= rules.maxAgeDays * DAY_MS)) return 'old';
  if (other.price === null || other.price <= 0) return 'noPrice';
  return null;
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
  const others = combine(saved, seen).filter((other) => other.id !== target.id);
  const leftOut: Market['leftOut'] = {};
  const peers: Peer[] = [];
  for (const other of others) {
    const why = whyLeftOut(target, other, now, cfg);
    if (why) leftOut[why] = (leftOut[why] ?? 0) + 1;
    else peers.push({ ...other, condition: conditionOf(other.parts, cfg)! });
  }
  peers.sort((a, b) => a.price! - b.price!);

  const group = (condition: ConditionClass) => {
    const prices = peers.filter((p) => p.condition === condition).map((p) => p.price!);
    return { count: prices.length, median: prices.length > 0 ? median(prices) : null };
  };

  return {
    // A heavily damaged car does not belong with any group.
    own: target.heavyDamage === true ? null : conditionOf(target.parts, cfg),
    groups: { clean: group('clean'), painted: group('painted'), replaced: group('replaced') },
    peers,
    remembered: others.length,
    leftOut,
    unread: NEEDED.filter((field) => target[field] === null || target[field] === ''),
  };
}
