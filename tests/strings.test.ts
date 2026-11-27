import { config } from '../src/scoring/config';
import type { PriceBand } from '../src/scoring/types';
import { reasonText, warningText } from '../src/ui/strings';

const price = (band: PriceBand) =>
  reasonText(
    { code: 'priceBand', band, diff: 0, reference: 1, source: 'manual', count: null },
    String,
  );

test('fixed price labels', () => {
  expect(price('veryCheap')).toContain('Çok ucuz, nedenini kontrol et');
  expect(price('good')).toContain('İyi fiyat');
});

test('a median names its sample size; no reference says so', () => {
  expect(
    reasonText(
      { code: 'priceBand', band: 'normal', diff: 0, reference: 1_000_000, source: 'median', count: 6 },
      String,
    ),
  ).toContain('6 ilan');
  expect(reasonText({ code: 'noReference', found: 2 }, String)).toContain('yetersiz veri');
});

test('a description match quotes its sentence and marks negation', () => {
  const text = reasonText(
    { code: 'phrase', phrase: 'pert', sentence: 'Pert yoktur', negated: true, points: 0 },
    String,
  );
  expect(text).toContain('Pert yoktur');
  expect(text).toContain('sayılmadı');
});

test('points show at most one decimal, in Turkish format', () => {
  expect(reasonText({ code: 'record', amount: 33_333, points: 3.3333 }, String))
    .toBe('Hasar kaydı 33.333 TL: −3,3 puan');
});

test('the low km warning uses the agreed wording', () => {
  expect(warningText('checkKm')).toBe('Kilometreyi kontrol edin');
});

test('the part list covers the roof and has no duplicate keys', () => {
  const keys = config.damage.parts.map((part) => part.key);
  expect(keys).toContain(config.damage.roofPart);
  expect(new Set(keys).size).toBe(keys.length);
});
