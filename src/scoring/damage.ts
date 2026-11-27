import type { ListingData } from '../types';
import type { Config } from './config';
import type { Reason, SectionResult, Warning } from './types';

export function scoreDamage(listing: ListingData, cfg: Config): SectionResult {
  const max = cfg.weights.damage;
  const rules = cfg.damage;
  if (listing.heavyDamage === true) {
    return { points: 0, max, reasons: [{ code: 'heavyDamage' }], warnings: ['heavyDamage'] };
  }

  const reasons: Reason[] = [];
  const warnings: Warning[] = [];
  let points = max;
  const deduct = (reason: Reason & { points: number }) => {
    points -= reason.points;
    reasons.push(reason);
  };

  for (const [part, status] of Object.entries(listing.parts)) {
    if (status === 'original' || status === 'unknown') continue;
    deduct({ code: 'part', part, status, points: rules.penalty[status] });
  }

  const roof = listing.parts[rules.roofPart];
  if (roof === 'painted' || roof === 'replaced') {
    deduct({ code: 'roofExtra', points: rules.roofExtra });
  }

  const record = listing.damageRecordTL;
  const price = listing.price !== null && listing.price > 0 ? listing.price : null;
  // A stated amount can only be weighed against a price.
  let needsPrice = false;
  if (record === null) {
    deduct({ code: 'recordUnknown', points: rules.unknownRecord });
    warnings.push('recordUnknown');
  } else if (record > 0) {
    if (price === null) {
      needsPrice = true;
    } else {
      const share = Math.min(1, record / price / rules.recordFullRatio);
      deduct({ code: 'record', amount: record, points: rules.recordMax * share });
    }
  }

  if (listing.heavyDamage === null) {
    deduct({ code: 'heavyUnknown', points: rules.unknownHeavy });
    warnings.push('heavyUnknown');
  }

  points = Math.max(0, points);

  const incomplete =
    rules.parts.length === 0 ||
    rules.parts.some(({ key }) => (listing.parts[key] ?? 'unknown') === 'unknown');
  if (incomplete) {
    points = Math.min(points, rules.incompleteCap);
    reasons.push({ code: 'partsCap', cap: rules.incompleteCap });
    warnings.push('unknownParts');
  }

  return { points: needsPrice ? null : points, max, reasons, warnings };
}
