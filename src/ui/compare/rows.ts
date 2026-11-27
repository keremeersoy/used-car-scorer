import { type Config, config } from '../../scoring/config';
import { scoreListing } from '../../scoring/score';
import type { ScoreResult, SectionKey } from '../../scoring/types';
import type { Listing, PartStatus } from '../../types';
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
}

export interface Row {
  label: string;
  cells: string[];
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
): { columns: Column[]; rows: Row[]; missing: string[] } {
  const listings = ids.flatMap((id) => saved.find((listing) => listing.id === id) ?? []);
  const missing = ids.filter((id) => !listings.some((listing) => listing.id === id));
  // Every saved listing feeds the median, not only the compared ones.
  const results = listings.map((listing) => scoreListing(listing, saved, now, cfg));
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
    };
  });

  const row = (label: string, cell: (listing: Listing, result: ScoreResult) => string): Row => ({
    label,
    cells: listings.map((listing, index) => cell(listing, results[index]!)),
  });

  const rows: Row[] = [
    row(compareLabels.total, (_, result) =>
      result.total === null ? BLANK : `${result.total} / 100`,
    ),
    ...SECTIONS.map((key) => row(sectionLabels[key], (_, result) => sectionCell(result, key))),
    row(fieldLabels.price, (l) => (l.price === null ? BLANK : formatMoney(l.price))),
    row(fieldLabels.referencePrice, referenceCell),
    row(fieldLabels.year, (l) => (l.year === null ? BLANK : String(l.year))),
    row(fieldLabels.km, (l) => (l.km === null ? BLANK : formatNumber(l.km, 0))),
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
