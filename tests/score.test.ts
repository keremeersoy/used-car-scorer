import { scoreListing } from '../src/scoring/score';
import type { MissingField } from '../src/scoring/types';
import type { Listing } from '../src/types';
import { listing, NOW, testCfg } from './helpers';

const run = (o: Partial<Listing>) => scoreListing(listing(o), [], NOW, testCfg);

test('rescales when price is left out', () => {
  const result = run({ year: 2020, km: 78_000, damageRecordTL: null, description: 'Acil.' });
  const { damage, price, km, description } = result.sections;
  expect([damage.points, price.points, km.points, description.points]).toEqual([30, null, 21, 7]);
  expect(result.total).toBe(83);
});

test('all four sections', () => {
  expect(run({ referencePrice: 1_000_000 }).total).toBe(92); // 35 + 22 + 25 + 10
});

test('rescales when the description is left out', () => {
  expect(run({ referencePrice: 1_000_000, description: null }).total).toBe(91); // 82 / 90
});

test.each<[MissingField, Partial<Listing>]>([
  ['price', { price: null }], ['price', { price: 0 }], ['km', { km: null }], ['year', { year: null }],
])('no total without %s', (field, o) => {
  const result = run(o);
  expect(result.total).toBeNull();
  expect(result.missing).toEqual([field]);
  expect(result.sections.description.points).toBe(10);
});

test('heavy damage zeroes only damage and surfaces the warning', () => {
  const result = run({ heavyDamage: true, referencePrice: 1_000_000 });
  expect(result.total).toBe(57);
  expect(result.warnings).toContain('heavyDamage');
});
