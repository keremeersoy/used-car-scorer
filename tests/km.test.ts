import { scoreKm } from '../src/scoring/km';
import { listing, NOW, testCfg } from './helpers';

// Age 10 in 2026.
test.each([
  [100_000, 25], [100_010, 21], [150_000, 21], [150_010, 16], [200_000, 16],
  [200_010, 9], [300_000, 9], [300_010, 3],
])('%i km over 10 years', (km, points) => {
  expect(scoreKm(listing({ year: 2016, km }), NOW, testCfg).points).toBe(points);
});

test.each([2026, 2027])('model year %i divides by 1', (year) => {
  expect(scoreKm(listing({ year, km: 12_000 }), NOW, testCfg).points).toBe(21);
});

test('very low km warns only on cars older than 3 years', () => {
  const warns = (year: number, km: number) =>
    scoreKm(listing({ year, km }), NOW, testCfg).warnings.includes('checkKm');
  expect(warns(2022, 11_999)).toBe(true);
  expect(warns(2022, 12_000)).toBe(false);
  expect(warns(2023, 100)).toBe(false);
});

test('zero km is a value; blank km or year is not scored', () => {
  expect(scoreKm(listing({ km: 0 }), NOW, testCfg).points).toBe(25);
  expect(scoreKm(listing({ km: null }), NOW, testCfg).points).toBeNull();
  expect(scoreKm(listing({ year: null }), NOW, testCfg).points).toBeNull();
});
