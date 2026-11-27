import type { ListingData } from '../types';
import type { Config } from './config';
import type { SectionResult } from './types';

export function scoreKm(listing: ListingData, now: Date, cfg: Config): SectionResult {
  const max = cfg.weights.km;
  const { km, year } = listing;
  if (km === null || year === null) return { points: null, max, reasons: [], warnings: [] };

  const age = now.getFullYear() - year;
  const perYear = km / Math.max(1, age);
  const band = cfg.km.bands.find(([upTo]) => perYear <= upTo);
  const points = band ? band[1] : cfg.km.above;
  const suspiciouslyLow = perYear < cfg.km.lowPerYear && age > cfg.km.lowAgeOver;

  return {
    points,
    max,
    reasons: [{ code: 'kmPerYear', value: perYear, points }],
    warnings: suspiciouslyLow ? ['checkKm'] : [],
  };
}
