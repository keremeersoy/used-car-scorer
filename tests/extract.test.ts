import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { description } from '../src/extract/description';
import { extract } from '../src/extract/extract';
import { config } from '../src/scoring/config';

const parse = (html: string) => new JSDOM(html).window.document;

// The saved pages are git-ignored because they are the owner's copies of real listings.
const dir = join(__dirname, '../fixtures');
const pages = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.html')) : [];
if (!pages.length) console.warn('SKIPPED: fixtures/ is empty, the extractor is not verified');

const load = (file: string) => ({
  html: readFileSync(join(dir, file), 'utf8'),
  expected: JSON.parse(readFileSync(join(dir, file.replace(/html$/, 'expected.json')), 'utf8')),
});

describe.skipIf(!pages.length)('saved pages', () => {
  test.each(pages)('%s', (file) => {
    const { html, expected } = load(file);
    const result = extract(parse(html), expected.url);
    const { description, ...read } = result.read;
    expect({ ...result, read }).toEqual(expected.result);
    expect(description?.split('\n')).toEqual(expect.arrayContaining(expected.descriptionLines));
  });

  test('every part on the pages is in the configured list', () => {
    const keys = config.damage.parts.map((part) => part.key);
    for (const file of pages) {
      expect(keys).toEqual(
        expect.arrayContaining(Object.keys(load(file).expected.result.read.parts)),
      );
    }
  });

  // Variations of a real page, to cover states the saved ones do not show.
  const variant = (change: (doc: Document) => void) => {
    const { html, expected } = load(pages[0]!);
    const doc = parse(html);
    change(doc);
    return extract(doc, expected.url);
  };

  test.each(['25.000 USD', '25.000 €'])('a price of %s stays blank and says why', (price) => {
    const result = variant((doc) => {
      doc.querySelector('.classifiedPriceValue')!.textContent = price;
      doc.querySelector('#favoriteClassifiedPrice')!.setAttribute('value', price);
    });
    expect(result.read.price).toBeNull();
    expect(result.notices).toEqual(['foreignCurrency']);
  });

  test('without the diagram every part is unknown', () => {
    const { parts } = variant((doc) => doc.querySelector('.car-parts')!.remove()).read;
    expect(Object.keys(parts)).toHaveLength(config.damage.parts.length);
    expect(new Set(Object.values(parts))).toEqual(new Set(['unknown']));
  });

  test('a part is read only from a status the reader knows', () => {
    const { parts } = variant((doc) => {
      doc.querySelector('.car-parts .roof')!.className = 'roof something-new';
      doc.querySelector('.car-parts .front-hood')!.className = 'front-hood';
      doc.querySelector('.car-parts .rear-hood')!.className = 'rear-hood local-painted-new';
    }).read;
    expect([parts.roof, parts.hood, parts.trunk]).toEqual(['unknown', 'unknown', 'localPaint']);
  });

  test.each(['', 'Belirtilmemiş'])('heavy damage "%s" is unknown, not "no"', (text) => {
    const result = variant((doc) => {
      const label = [...doc.querySelectorAll('dt')].find(
        (dt) => dt.textContent!.trim() === 'Ağır Hasar Kayıtlı',
      )!;
      label.nextElementSibling!.textContent = text;
    });
    expect(result.read.heavyDamage).toBeNull();
  });
});

test('line breaks come from the markup, not from the file layout', () => {
  const doc = parse(`<div id="classifiedDescription"><p>pert
    yok<br>acil&nbsp;satılık</p><p>temiz <b>araç</b></p></div>`);
  expect(description(doc)).toBe('pert yok\nacil satılık\ntemiz araç');
});

test('a bot check or unrelated page yields nothing, never clean values', () => {
  const result = extract(
    parse('<html><body>Güvenlik kontrolü</body></html>'),
    'https://www.sahibinden.com/x',
  );
  expect(result.recognised).toBe(false);
  const { url, parts, ...fields } = result.read;
  expect(url).toBe('https://www.sahibinden.com/x');
  expect(Object.values(fields).every((value) => value === null)).toBe(true);
  expect(Object.values(parts).every((status) => status === 'unknown')).toBe(true);
});

// The page is untrusted input: its text and class names must not reach object internals.
const minimal = (id: string, partClasses: string) =>
  parse(`<div class="classifiedInfo"><h3 class="classifiedPriceValue">1.000 TL</h3>
    <dl><dd id="classifiedId">${id}</dd></dl></div>
    <div class="car-parts"><div class="${partClasses}"></div></div>`);

test.each(['__proto__', 'constructor', '12a', ''])('listing number %j is not accepted', (id) => {
  expect(extract(minimal(id, 'roof original-new'), 'u').recognised).toBe(false);
});

test.each(['constructor original-new', 'roof constructor', '__proto__ toString'])(
  'diagram classes "%s" add nothing',
  (classes) => {
    const { recognised, read } = extract(minimal('123', classes), 'u');
    expect(recognised).toBe(true);
    expect(Object.keys(read.parts)).toEqual(config.damage.parts.map((part) => part.key));
    expect(new Set(Object.values(read.parts))).toEqual(new Set(['unknown']));
  },
);

const priced = (price: string) =>
  extract(
    parse(`<div class="classifiedInfo">${price}
    <dl><dt>KM</dt><dd>1.000</dd><dd id="classifiedId">5</dd></dl></div>`),
    'u',
  );

test.each([
  '<h3 class="classifiedPriceValue">1.250.000 ₺</h3>',
  '<h3 class="classifiedPriceValue"><span>1.250.000 TL</span></h3>',
  '',
])('a price that cannot be read says so: %j', (markup) => {
  const result = priced(markup);
  expect(result.read.price).toBeNull();
  expect(result.notices).toEqual(['priceUnreadable']);
});

test('a readable price raises no notice', () => {
  expect(priced('<h3 class="classifiedPriceValue">1.250.000 TL</h3>').notices).toEqual([]);
});
