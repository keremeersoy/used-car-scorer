// Turns a score into what the owner needs to know: a verdict, what to watch, what is unknown.
import type { Config } from '../../scoring/config';
import type { Reason, ScoreResult } from '../../scoring/types';
import type { ListingData, PartStatus } from '../../types';
import { findingText, missingText } from '../strings';

export type Level = 'good' | 'careful' | 'risky' | 'incomplete';
export type Tone = 'bad' | 'warn' | 'good';

export interface Finding {
  tone: Tone;
  text: string;
  detail?: string;
  cost?: number; // points taken off
}

export function verdict(result: ScoreResult, cfg: Config): Level {
  // Heavy damage outweighs every other number.
  if (result.warnings.includes('heavyDamage')) return 'risky';
  if (result.total === null) return 'incomplete';
  if (result.total >= cfg.verdict.good) return 'good';
  return result.total >= cfg.verdict.careful ? 'careful' : 'risky';
}

const unknownParts = (listing: ListingData, cfg: Config) =>
  cfg.damage.parts.filter(({ key }) => (listing.parts[key] ?? 'unknown') === 'unknown').length;

type Of<Code extends Reason['code']> = Extract<Reason, { code: Code }>;

function partFindings(
  listing: ListingData,
  result: ScoreResult,
  partLabel: (key: string) => string,
): Finding[] {
  const reasons = result.sections.damage.reasons;
  const roofExtra = reasons.find((r): r is Of<'roofExtra'> => r.code === 'roofExtra')?.points ?? 0;
  const groups: [Exclude<PartStatus, 'original' | 'unknown'>, Tone][] = [
    ['replaced', 'bad'],
    ['painted', 'warn'],
    ['localPaint', 'warn'],
  ];
  return groups.flatMap(([status, tone]) => {
    const keys = Object.keys(listing.parts).filter((key) => listing.parts[key] === status);
    if (keys.length === 0) return [];
    let cost = reasons
      .filter((r): r is Of<'part'> => r.code === 'part' && r.status === status)
      .reduce((sum, r) => sum + r.points, 0);
    if (status !== 'localPaint' && keys.includes('roof')) cost += roofExtra;
    return [{ tone, text: findingText[status](keys.map(partLabel)), cost }];
  });
}

export function findings(
  listing: ListingData,
  result: ScoreResult,
  partLabel: (key: string) => string,
  cfg: Config,
): Finding[] {
  const found: Finding[] = [];
  if (listing.heavyDamage === true) found.push({ tone: 'bad', text: findingText.heavyDamage });
  found.push(...partFindings(listing, result, partLabel));

  for (const reason of result.sections.damage.reasons) {
    if (reason.code === 'record') {
      found.push({ tone: 'warn', text: findingText.record(reason.amount), cost: reason.points });
    }
  }

  for (const reason of result.sections.price.reasons) {
    if (reason.code !== 'priceBand') continue;
    const percent = Math.abs(reason.diff) * 100;
    const cost = result.sections.price.max - (result.sections.price.points ?? 0);
    if (reason.band === 'veryCheap') {
      found.push({ tone: 'warn', text: findingText.veryCheap(percent), cost });
    } else if (reason.band === 'good') {
      found.push({ tone: 'good', text: findingText.cheap(percent) });
    } else if (reason.band !== 'normal') {
      const tone = reason.band === 'expensive' ? 'bad' : 'warn';
      found.push({ tone, text: findingText.expensive(percent), cost });
    }
  }

  const { points, max, reasons } = result.sections.km;
  const perYear = reasons.find((r): r is Of<'kmPerYear'> => r.code === 'kmPerYear')?.value;
  if (points !== null && perYear !== undefined) {
    // The two lowest bands are problems, the two highest are good points.
    const [high, veryHigh] = [cfg.km.bands.at(-1)![1], cfg.km.above];
    const low = cfg.km.bands[1]![1];
    const cost = max - points;
    if (points <= veryHigh) {
      found.push({ tone: 'bad', text: findingText.kmVeryHigh(perYear), cost });
    } else if (points <= high) {
      found.push({ tone: 'warn', text: findingText.kmHigh(perYear), cost });
    } else if (result.sections.km.warnings.includes('checkKm')) {
      found.push({ tone: 'warn', text: findingText.kmSuspicious });
    } else if (points >= low) {
      found.push({ tone: 'good', text: findingText.kmLow(perYear) });
    }
  }

  for (const reason of result.sections.description.reasons) {
    if (reason.code === 'phrase' && reason.points > 0) {
      found.push({
        tone: 'warn',
        text: findingText.phrase(reason.phrase),
        detail: reason.sentence,
        cost: reason.points,
      });
    }
  }

  const clean = Object.values(listing.parts).every((s) => s === 'original' || s === 'unknown');
  if (clean && unknownParts(listing, cfg) === 0) {
    found.push({ tone: 'good', text: findingText.noParts });
  }
  if (listing.heavyDamage === false) {
    found.push({ tone: 'good', text: findingText.noHeavyDamage });
  }
  if (listing.damageRecordTL === 0) found.push({ tone: 'good', text: findingText.noRecord });

  const order: Tone[] = ['bad', 'warn', 'good'];
  return found.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));
}

/** What is not known yet. None of it is ever counted as clean. */
export function missingInfo(listing: ListingData, cfg: Config): string[] {
  const missing: string[] = [];
  if (!listing.price) missing.push(missingText.price);
  if (listing.year === null) missing.push(missingText.year);
  if (listing.km === null) missing.push(missingText.km);
  const parts = unknownParts(listing, cfg);
  if (parts > 0) missing.push(missingText.parts(parts));
  if (listing.damageRecordTL === null) missing.push(missingText.record);
  if (listing.heavyDamage === null) missing.push(missingText.heavyDamage);
  if (!listing.description?.trim()) missing.push(missingText.description);
  return missing;
}
