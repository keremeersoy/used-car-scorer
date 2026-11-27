import { config } from '../src/scoring/config';
import { scoreDamage } from '../src/scoring/damage';
import type { Listing, PartStatus } from '../src/types';
import { listing, testCfg } from './helpers';

const clean = listing().parts;
const score = (o: Partial<Listing>) => scoreDamage(listing(o), testCfg);
const withParts = (p: Record<string, PartStatus>) => score({ parts: { ...clean, ...p } }).points;
const replaced = (n: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i + 1}`, 'replaced' as const]));

test('part penalties', () => {
  expect(score({}).points).toBe(35);
  expect(withParts({ p1: 'localPaint' })).toBe(34);
  expect(withParts({ p1: 'painted' })).toBe(32);
  expect(withParts({ p1: 'replaced' })).toBe(29);
});

test('roof extra applies to painted or replaced only', () => {
  expect(withParts({ roof: 'localPaint' })).toBe(34);
  expect(withParts({ roof: 'painted' })).toBe(26);
  expect(withParts({ roof: 'replaced' })).toBe(23);
});

test('damage record scales to 10 points at 10% of price', () => {
  expect(score({ damageRecordTL: 50_000 }).points).toBe(30);
  expect(score({ damageRecordTL: 100_000 }).points).toBe(25);
  expect(score({ damageRecordTL: 300_000 }).points).toBe(25);
  expect(score({ damageRecordTL: 33_333 }).points).toBeCloseTo(31.6667, 3);
});

test('unknown record and heavy damage cost 5 each, with warnings', () => {
  expect(score({ damageRecordTL: null }).points).toBe(30);
  expect(score({ heavyDamage: null }).points).toBe(30);
  const both = score({ damageRecordTL: null, heavyDamage: null });
  expect(both.points).toBe(25);
  expect(both.warnings).toEqual(expect.arrayContaining(['recordUnknown', 'heavyUnknown']));
});

test('heavy damage is zero', () => {
  expect(score({ heavyDamage: true })).toMatchObject({ points: 0, warnings: ['heavyDamage'] });
});

test('floor, then cap at 15 when parts are incomplete', () => {
  expect(withParts(replaced(7))).toBe(0);
  expect(withParts({ p1: 'unknown' })).toBe(15);
  expect(score({ parts: { roof: 'original' } }).points).toBe(15);
  expect(withParts({ ...replaced(3), p7: 'unknown' })).toBe(15);
  expect(withParts({ ...replaced(5), p7: 'unknown' })).toBe(5);
  expect(score({ parts: {} }).warnings).toContain('unknownParts');
});

test('an empty configured part list never counts as complete', () => {
  const cfg = { ...config, damage: { ...config.damage, parts: [] } };
  expect(scoreDamage(listing(), cfg).points).toBe(15);
});

test('blank price blocks damage only when the record needs it', () => {
  expect(score({ price: null, damageRecordTL: 5_000 }).points).toBeNull();
  expect(score({ price: null, damageRecordTL: 0 }).points).toBe(35);
  expect(score({ price: null, damageRecordTL: null }).points).toBe(30);
  expect(score({ price: null, damageRecordTL: 5_000, heavyDamage: true }).points).toBe(0);
});
