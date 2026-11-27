// Reads a sahibinden listing detail page. Every selector here was taken from pages the owner
// saved by hand. Only DOM APIs that work on a detached document are used.
import { config } from '../scoring/config';
import type { PartStatus } from '../types';
import { parseWholeNumber, parseYear, type ParsedNumber } from '../ui/parse';
import { description } from './description';
import { unrecognised, type ExtractResult } from './types';

/** Our part key for each class name in the page's paint diagram. */
const PART_CLASSES: Record<string, string> = {
  roof: 'roof',
  'front-hood': 'hood',
  'rear-hood': 'trunk',
  'front-bumper': 'frontBumper',
  'rear-bumper': 'rearBumper',
  'front-left-mudguard': 'leftFrontFender',
  'front-right-mudguard': 'rightFrontFender',
  'rear-left-mudguard': 'leftRearFender',
  'rear-right-mudguard': 'rightRearFender',
  'front-left-door': 'leftFrontDoor',
  'front-right-door': 'rightFrontDoor',
  'rear-left-door': 'leftRearDoor',
  'rear-right-door': 'rightRearDoor',
};

/** A part counts as anything, original included, only when the diagram says so. */
const STATUS_CLASSES: Record<string, PartStatus> = {
  'original-new': 'original',
  'local-painted-new': 'localPaint',
  'painted-new': 'painted',
  'changed-new': 'replaced',
};

const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() || null;

const number = (parsed: ParsedNumber) => (parsed.ok ? parsed.value : null);

/** The label and value pairs of the box beside the photos. */
function details(doc: Document): Map<string, string> {
  const found = new Map<string, string>();
  for (const label of doc.querySelectorAll('.classifiedInfo dt')) {
    const name = clean(label.textContent);
    const value = clean(label.nextElementSibling?.textContent);
    if (name && value) found.set(name, value);
  }
  return found;
}

function price(doc: Document): { value: number | null; foreign: boolean } {
  // The heading also holds the price history widget, so only its own text is the price.
  const heading = doc.querySelector('.classifiedPriceValue');
  const own = clean(
    [...(heading?.childNodes ?? [])]
      .filter((node) => node.nodeType === 3 /* text */)
      .map((node) => node.textContent)
      .join(' '),
  );
  const text = own ?? clean(doc.querySelector('#favoriteClassifiedPrice')?.getAttribute('value'));
  if (!text) return { value: null, foreign: false };
  if (/USD|EUR|GBP|[$€£]/.test(text)) return { value: null, foreign: true };
  if (!/TL$/.test(text)) return { value: null, foreign: false };
  const value = number(parseWholeNumber(text));
  return { value: value === 0 ? null : value, foreign: false };
}

const allUnknown = (): Record<string, PartStatus> =>
  Object.fromEntries(config.damage.parts.map(({ key }) => [key, 'unknown']));

function parts(doc: Document): Record<string, PartStatus> {
  const result = allUnknown();
  for (const element of doc.querySelectorAll('.car-parts > div')) {
    const classes = [...element.classList];
    const part = classes.map((name) => PART_CLASSES[name]).find(Boolean);
    const status = classes.map((name) => STATUS_CLASSES[name]).find(Boolean);
    if (part && status) result[part] = status;
  }
  return result;
}

export function extract(doc: Document, url: string): ExtractResult {
  const info = details(doc);
  const id = clean(doc.querySelector('#classifiedId')?.textContent);
  const cost = price(doc);
  const year = number(parseYear(info.get('Yıl') ?? ''));
  const km = number(parseWholeNumber(info.get('KM') ?? ''));
  const heavy = info.get('Ağır Hasar Kayıtlı');

  // A bot check or another kind of page must not pass for an empty but readable listing.
  if (id === null || (cost.value === null && year === null && km === null)) {
    const empty = unrecognised(url);
    return { ...empty, read: { ...empty.read, parts: allUnknown() } };
  }

  return {
    recognised: true,
    notices: cost.foreign ? ['foreignCurrency'] : [],
    read: {
      id,
      url,
      title: clean(doc.querySelector('.classifiedDetailTitle h1')?.textContent),
      price: cost.value,
      brand: info.get('Marka') ?? null,
      series: info.get('Seri') ?? null,
      model: info.get('Model') ?? null,
      year,
      km,
      fuel: info.get('Yakıt / Motor Tipi') ?? null,
      gearbox: info.get('Vites') ?? null,
      engine: info.get('Motor Hacmi') ?? null,
      heavyDamage: heavy === 'Evet' ? true : heavy === 'Hayır' ? false : null,
      damageRecordTL: null, // not a field on the page; never guessed from the description
      parts: parts(doc),
      description: description(doc),
    },
  };
}
