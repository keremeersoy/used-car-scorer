import type { Listing, Scorable } from '../types';
import { config, type Config } from './config';
import { scoreDamage } from './damage';
import { scoreDescription } from './description';
import { scoreKm } from './km';
import { scorePrice } from './price';
import type { MissingField, ScoreResult } from './types';

export function scoreListing(
  target: Scorable,
  saved: Listing[],
  now: Date,
  cfg: Config = config,
): ScoreResult {
  const sections: ScoreResult['sections'] = {
    damage: scoreDamage(target, cfg),
    price: scorePrice(target, saved, now, cfg),
    km: scoreKm(target, now, cfg),
    description: scoreDescription(target.description, cfg),
  };

  const missing: MissingField[] = [];
  if (target.price === null || target.price <= 0) missing.push('price');
  if (target.km === null) missing.push('km');
  if (target.year === null) missing.push('year');

  const all = Object.values(sections);
  let total: number | null = null;
  if (missing.length === 0) {
    // A section that cannot be scored is left out and the rest is rescaled to 100.
    const included = all.filter((section) => section.points !== null);
    const earned = included.reduce((sum, section) => sum + section.points!, 0);
    const possible = included.reduce((sum, section) => sum + section.max, 0);
    total = Math.round((earned / possible) * 100);
  }

  const warnings = [...new Set(all.flatMap((section) => section.warnings))];
  return { total, sections, missing, warnings };
}
