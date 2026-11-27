import { conditionOf, market } from '../src/scoring/market';
import { findReference, scorePrice } from '../src/scoring/price';
import type { Listing, PartStatus } from '../src/types';
import { listing, NOW, observation, testCfg } from './helpers';

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

const parts = (o: Record<string, PartStatus> = {}) => ({ ...listing().parts, ...o });
const painted = parts({ p1: 'painted', p2: 'localPaint' });
const replaced = parts({ p1: 'replaced' });

test.each<[ReturnType<typeof conditionOf>, Record<string, PartStatus>]>([
  ['clean', parts()],
  ['clean', parts({ p1: 'painted' })],
  ['painted', painted],
  ['replaced', replaced],
  ['replaced', parts({ p1: 'replaced', p2: 'painted', p3: 'painted' })],
  [null, parts({ p1: 'unknown' })],
  [null, {}],
])('condition %s', (condition, state) => {
  expect(conditionOf(state, testCfg)).toBe(condition);
});

test('median of five; even count averages the middle two', () => {
  expect(findReference(listing(), pool(five), NOW, testCfg)).toEqual({
    value: 1_000_000,
    source: 'median',
    count: 5,
    condition: 'clean',
    lowData: false,
  });
  expect(findReference(listing(), pool([...five, 1_300_000]), NOW, testCfg)).toMatchObject({
    value: 1_050_000,
    count: 6,
  });
});

test('three or four are scored with a low data mark', () => {
  expect(findReference(listing(), pool(five.slice(0, 3)), NOW, testCfg)).toMatchObject({
    value: 900_000,
    count: 3,
    lowData: true,
  });
});

test('two are not enough', () => {
  const result = scorePrice(listing(), pool(five.slice(0, 2)), NOW, testCfg);
  expect(result).toMatchObject({
    points: null,
    warnings: ['noReference'],
    reasons: [{ code: 'noReference', found: 2, why: 'few' }],
  });
});

test('a car is compared only with cars in the same condition', () => {
  const others = [
    ...pool(five),
    ...pool([500_000, 600_000, 700_000], { parts: replaced }).map((l) => ({
      ...l,
      id: `r${l.id}`,
    })),
  ];
  expect(findReference(listing(), others, NOW, testCfg)).toMatchObject({ value: 1_000_000 });
  expect(findReference(listing({ parts: replaced }), others, NOW, testCfg)).toMatchObject({
    value: 600_000,
    condition: 'replaced',
  });
  expect(findReference(listing({ parts: painted }), others, NOW, testCfg)).toMatchObject({
    value: null,
    found: 0,
  });
});

test.each<[string, Partial<Listing>]>([
  ['heavy', { heavyDamage: true }],
  ['parts', { parts: parts({ p1: 'unknown' }) }],
])('a car that cannot be grouped (%s) is not compared, unless a reference is typed', (why, o) => {
  expect(findReference(listing(o), pool(five), NOW, testCfg)).toMatchObject({ value: null, why });
  expect(
    findReference(listing({ ...o, referencePrice: 1 }), pool(five), NOW, testCfg),
  ).toMatchObject({ source: 'manual' });
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
  ['fuel', { fuel: 'x' }],
  ['gearbox', { gearbox: 'x' }],
  ['year 2 apart', { year: 2022 }],
  ['km too far', { km: 100_001 }],
  ['km unknown', { km: null }],
  ['older than 30 days', { savedAt: '2026-10-27T12:00:00Z' }],
  ['no price', { price: null }],
  ['heavy damage', { heavyDamage: true }],
  ['unknown part', { parts: parts({ p1: 'unknown' }) }],
  ['unreadable date', { savedAt: 'broken' }],
])('excludes a different %s', (_, o) => {
  const saved = [...pool(five.slice(0, 2)), listing({ id: 'odd', ...o })];
  expect(findReference(listing(), saved, NOW, testCfg)).toMatchObject({ value: null, found: 2 });
});

test('includes year ±1, 40,000 km apart, exactly 30 days, other engines and Turkish case', () => {
  const target = listing({ model: 'İkinci' });
  const saved = pool(five, {
    model: ' ikinci ',
    year: 2021,
    km: 100_000,
    engine: 'başka',
    savedAt: '2026-10-28T12:00:00Z',
  });
  expect(findReference(target, [...saved, target], NOW, testCfg)).toMatchObject({ count: 5 });
});

test('blank match fields never match', () => {
  expect(
    findReference(listing({ fuel: null }), pool(five, { fuel: null }), NOW, testCfg),
  ).toMatchObject({ value: null, found: 0 });
});

test('listings only looked at count too', () => {
  const seen = five.map((price, i) => observation({ id: `v${i}`, price }));
  expect(findReference(listing(), [], NOW, testCfg, seen)).toMatchObject({
    value: 1_000_000,
    count: 5,
  });
});

test('a listing both saved and seen counts once, with corrections and the newer price', () => {
  const saved = [listing({ id: 'v0', price: 100, savedAt: '2026-11-01T00:00:00Z' })];
  const seen = [
    observation({ id: 'v0', price: 200, parts: replaced, savedAt: '2026-11-20T00:00:00Z' }),
    observation({ id: 'v1', price: 300 }),
    observation({ id: 'v2', price: 400 }),
  ];
  expect(findReference(listing(), saved, NOW, testCfg, seen)).toMatchObject({
    value: 300, // 200 (seen later, owner's clean parts kept), 300, 400
    count: 3,
  });
});

test('the overview shows every condition group', () => {
  const seen = [
    ...[10, 20].map((price) => observation({ id: `c${price}`, price })),
    observation({ id: 'r1', price: 5, parts: replaced }),
  ];
  const overview = market(listing(), [], seen, NOW, testCfg);
  expect(overview.own).toBe('clean');
  expect(overview.groups).toEqual({
    clean: { count: 2, median: 15 },
    painted: { count: 0, median: null },
    replaced: { count: 1, median: 5 },
  });
  expect(overview.peers.map((p) => p.id)).toEqual(['r1', 'c10', 'c20']); // cheapest first
});

test('blank price gives no price score and no insufficient-data warning', () => {
  expect(scorePrice(listing({ price: null }), pool(five), NOW, testCfg)).toMatchObject({
    points: null,
    warnings: [],
  });
});
