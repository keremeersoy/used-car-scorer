import { type Config, config } from '../../scoring/config';
import { scoreListing } from '../../scoring/score';
import type { ScoreResult, SectionKey } from '../../scoring/types';
import type { Listing, Observation, PartStatus } from '../../types';
import { type Level, verdict } from '../panel/insights';
import {
  compareLabels,
  fieldLabels,
  formatMoney,
  formatNumber,
  heavyDamageLabels,
  partStatusLabels,
  sectionLabels,
  strings,
  warningText,
} from '../strings';

export interface Column {
  id: string;
  title: string;
  url: string;
  total: number | null;
  isBest: boolean;
  excluded: SectionKey[]; // left out, so this total is rescaled
  level: Level;
  parts: Listing['parts'];
}

export interface Row {
  label: string;
  cells: string[];
  best: boolean[]; // the cars that win this row, when it has a winner
}

const BLANK = '—';
const SECTIONS: SectionKey[] = ['damage', 'price', 'km', 'description'];

const text = (value: string | null) => value ?? BLANK;

function sectionCell(result: ScoreResult, key: SectionKey): string {
  const section = result.sections[key];
  if (section.points !== null) return `${formatNumber(section.points)} / ${section.max}`;
  return section.warnings.includes('noReference') ? strings.insufficient : BLANK;
}

function referenceCell(listing: Listing, result: ScoreResult): string {
  const used = result.sections.price.reasons.find((reason) => reason.code === 'priceBand');
  if (used) {
    const source = used.source === 'manual' ? 'elle' : `${used.count} ilan`;
    return `${formatMoney(used.reference)} (${source})`;
  }
  return listing.referencePrice ? formatMoney(listing.referencePrice) : BLANK;
}

function partsCell(listing: Listing, status: PartStatus, cfg: Config): string {
  const { parts } = cfg.damage;
  const labelOf = (key: string) => parts.find((part) => part.key === key)?.label ?? key;
  const matching = Object.entries(listing.parts)
    .filter(([, value]) => value === status)
    .map(([key]) => labelOf(key));
  const incomplete =
    parts.length === 0 || parts.some(({ key }) => (listing.parts[key] ?? 'unknown') === 'unknown');
  if (matching.length === 0) return incomplete ? partStatusLabels.unknown : strings.none;
  return matching.join(', ') + (incomplete ? ` (${strings.incomplete})` : '');
}

export function buildComparison(
  ids: string[],
  saved: Listing[],
  now: Date,
  cfg: Config = config,
  seen: Observation[] = [],
): { columns: Column[]; rows: Row[]; missing: string[] } {
  const listings = ids.flatMap((id) => saved.find((listing) => listing.id === id) ?? []);
  const missing = ids.filter((id) => !listings.some((listing) => listing.id === id));
  // Every saved listing feeds the median, not only the compared ones.
  const results = listings.map((listing) => scoreListing(listing, saved, now, cfg, seen));
  const totals = results.flatMap((result) => result.total ?? []);
  const best = totals.length > 0 ? Math.max(...totals) : null;

  const columns = listings.map((listing, index): Column => {
    const result = results[index]!;
    return {
      id: listing.id,
      title: listing.title ?? strings.untitled,
      url: listing.url,
      total: result.total,
      isBest: result.total !== null && result.total === best,
      excluded: SECTIONS.filter((key) => result.sections[key].points === null),
      level: verdict(result, cfg),
      parts: listing.parts,
    };
  });

  const row = (
    label: string,
    cell: (listing: Listing, result: ScoreResult) => string,
    compare?: { value: (listing: Listing, result: ScoreResult) => number | null; lower?: boolean },
  ): Row => {
    const values = listings.map((l, index) => compare?.value(l, results[index]!) ?? null);
    const known = values.filter((value) => value !== null);
    const winner = compare?.lower ? Math.min(...known) : Math.max(...known);
    // A row where every car is equal has nothing to point out.
    const decided = known.length > 1 && new Set(known).size > 1;
    return {
      label,
      cells: listings.map((l, index) => cell(l, results[index]!)),
      best: values.map((value) => decided && value === winner),
    };
  };

  const rows: Row[] = [
    row(
      compareLabels.total,
      (_, result) => (result.total === null ? BLANK : `${result.total} / 100`),
      {
        value: (_, result) => result.total,
      },
    ),
    ...SECTIONS.map((key) =>
      row(compareLabels.section(sectionLabels[key]), (_, result) => sectionCell(result, key), {
        value: (_, result) => result.sections[key].points,
      }),
    ),
    row(fieldLabels.note, (l) => l.note || BLANK),
    row(fieldLabels.price, (l) => (l.price === null ? BLANK : formatMoney(l.price)), {
      value: (l) => l.price,
      lower: true,
    }),
    row(fieldLabels.referencePrice, referenceCell),
    row(fieldLabels.year, (l) => (l.year === null ? BLANK : String(l.year))),
    row(fieldLabels.km, (l) => (l.km === null ? BLANK : formatNumber(l.km, 0)), {
      value: (l) => l.km,
      lower: true,
    }),
    row(compareLabels.kmPerYear, (_, result) => {
      const reason = result.sections.km.reasons.find((r) => r.code === 'kmPerYear');
      return reason ? formatNumber(reason.value, 0) : BLANK;
    }),
    row(fieldLabels.fuel, (l) => text(l.fuel)),
    row(fieldLabels.gearbox, (l) => text(l.gearbox)),
    row(fieldLabels.engine, (l) => text(l.engine)),
    row(compareLabels.localPaint, (l) => partsCell(l, 'localPaint', cfg)),
    row(compareLabels.painted, (l) => partsCell(l, 'painted', cfg)),
    row(compareLabels.replaced, (l) => partsCell(l, 'replaced', cfg)),
    row(fieldLabels.damageRecordTL, (l) => {
      if (l.damageRecordTL === null) return BLANK;
      return l.damageRecordTL === 0 ? strings.noRecord : formatMoney(l.damageRecordTL);
    }),
    row(fieldLabels.heavyDamage, (l) => {
      if (l.heavyDamage === null) return BLANK;
      return l.heavyDamage ? heavyDamageLabels.yes : heavyDamageLabels.no;
    }),
    row(compareLabels.warnings, (_, result) =>
      result.warnings.length === 0 ? strings.none : result.warnings.map(warningText).join(' · '),
    ),
  ];

  return { columns, rows, missing };
}
