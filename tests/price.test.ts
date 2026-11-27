import { findReference, scorePrice } from '../src/scoring/price';
import type { Listing } from '../src/types';
import { listing, NOW, testCfg } from './helpers';

test.each([
  [900_000, 25],
  [900_001, 30],
  [969_999, 30],
  [970_000, 22],
  [1_030_000, 22],
  [1_030_001, 12],
  [1_100_000, 12],
  [1_100_001, 5],
])('price %i against 1,000,000', (price, points) => {
  const target = listing({ price, referencePrice: 1_000_000 });
  expect(scorePrice(target, [], NOW, testCfg).points).toBe(points);
});

const pool = (prices: number[], o: Partial<Listing> = {}) =>
  prices.map((price, i) => listing({ id: `s${i}`, price, ...o }));
const five = [800_000, 900_000, 1_000_000, 1_100_000, 1_200_000];

test('median of five; even count averages the middle two', () => {
  expect(findReference(listing(), pool(five), NOW, testCfg)).toEqual({
    value: 1_000_000,
    source: 'median',
    count: 5,
  });
  expect(findReference(listing(), pool([...five, 1_300_000]), NOW, testCfg)).toMatchObject({
    value: 1_050_000,
    count: 6,
  });
});

test('four are not enough', () => {
  const result = scorePrice(listing(), pool(five.slice(1)), NOW, testCfg);
  expect(result).toMatchObject({
    points: null,
    warnings: ['noReference'],
    reasons: [{ code: 'noReference', found: 4 }],
  });
});

test('manual reference wins; zero is ignored', () => {
  expect(
    findReference(listing({ referencePrice: 500_000 }), pool(five), NOW, testCfg),
  ).toMatchObject({ value: 500_000, source: 'manual' });
  expect(findReference(listing({ referencePrice: 0 }), pool(five), NOW, testCfg)).toMatchObject({
    source: 'median',
  });
});

test.each<[string, Partial<Listing>]>([
  ['brand', { brand: 'x' }],
  ['series', { series: 'x' }],
  ['model', { model: 'x' }],
  ['engine', { engine: 'x' }],
  ['fuel', { fuel: 'x' }],
  ['gearbox', { gearbox: 'x' }],
  ['year 2 apart', { year: 2022 }],
  ['older than 30 days', { savedAt: '2026-10-27T12:00:00Z' }],
  ['no price', { price: null }],
  ['heavy damage', { heavyDamage: true }],
  ['unreadable date', { savedAt: 'broken' }],
])('excludes a different %s', (_, o) => {
  const saved = [...pool(five.slice(1)), listing({ id: 'odd', ...o })];
  expect(findReference(listing(), saved, NOW, testCfg)).toMatchObject({ value: null, found: 4 });
});

test('includes year ±1, exactly 30 days, and Turkish case differences; excludes itself', () => {
  const target = listing({ model: 'İkinci' });
  const saved = pool(five, { model: ' ikinci ', year: 2021, savedAt: '2026-10-28T12:00:00Z' });
  expect(findReference(target, [...saved, target], NOW, testCfg)).toMatchObject({ count: 5 });
});

test('blank match fields never match', () => {
  expect(
    findReference(listing({ engine: null }), pool(five, { engine: null }), NOW, testCfg),
  ).toMatchObject({ value: null, found: 0 });
});

test('blank price gives no price score and no insufficient-data warning', () => {
  expect(scorePrice(listing({ price: null }), pool(five), NOW, testCfg)).toMatchObject({
    points: null,
    warnings: [],
  });
});
