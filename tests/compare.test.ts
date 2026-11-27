import { buildComparison } from '../src/ui/compare/rows';
import { compareUrl, parseIds } from '../src/ui/compare/url';
import { listing, NOW, testCfg } from './helpers';

test('ids survive the round trip', () => {
  expect(parseIds(new URL(compareUrl(['1', 'a,b']), 'https://x/').search)).toEqual(['1', 'a,b']);
});

const saved = [
  listing({ id: 'a', referencePrice: 1_000_000 }),
  listing({ id: 'b', km: 250_000 }),
  listing({ id: 'c', km: null }),
];

test('columns follow the ids, skip deleted ones, mark the best and the left-out sections', () => {
  const { columns, rows, missing } = buildComparison(['b', 'gone', 'a', 'c'], saved, NOW, testCfg);
  expect(missing).toEqual(['gone']);
  expect(columns.map((c) => [c.id, c.isBest])).toEqual([
    ['b', false],
    ['a', true],
    ['c', false],
  ]);
  expect(columns[0]!.excluded).toEqual(['price']);
  expect(columns[2]!.total).toBeNull();
  expect(rows.every((row) => row.cells.length === 3)).toBe(true);
});

test('ties are all best', () => {
  const two = [listing({ id: 'a' }), listing({ id: 'b' })];
  expect(buildComparison(['a', 'b'], two, NOW, testCfg).columns.map((c) => c.isBest)).toEqual([
    true,
    true,
  ]);
});

test('unknown parts are never shown as none', () => {
  const cars = [
    listing({ id: 'clean' }),
    listing({ id: 'blank', parts: {} }),
    listing({ id: 'some', parts: { p1: 'replaced' } }),
  ];
  const { rows } = buildComparison(['clean', 'blank', 'some'], cars, NOW, testCfg);
  expect(rows.find((row) => row.label === 'Değişen parçalar')!.cells).toEqual([
    'Yok',
    'Bilinmiyor',
    'p1 (bilgi eksik)',
  ]);
});

test('blank values show a dash and a stated empty record says so', () => {
  const cars = [listing({ id: 'a', fuel: null, damageRecordTL: null }), listing({ id: 'b' })];
  const { rows } = buildComparison(['a', 'b'], cars, NOW, testCfg);
  const cells = (label: string) => rows.find((row) => row.label === label)!.cells;
  expect(cells('Yakıt')).toEqual(['—', 'Benzin']);
  expect(cells('Hasar kaydı / tramer (TL)')).toEqual(['—', 'Kayıt yok']);
});

test('each row marks its best car: higher points, lower price and km', () => {
  const cars = [listing({ id: 'a', price: 900_000, km: 90_000 }), listing({ id: 'b', km: 20_000 })];
  const { rows } = buildComparison(['a', 'b'], cars, NOW, testCfg);
  const best = (label: string) => rows.find((row) => row.label === label)!.best;
  expect(best('Fiyat (TL)')).toEqual([true, false]);
  expect(best('Km')).toEqual([false, true]);
  expect(best('Yakıt')).toEqual([false, false]);
});

test('each car shows its note', () => {
  const cars = [listing({ id: 'a', note: 'Lastikler yeni' }), listing({ id: 'b' })];
  const { rows } = buildComparison(['a', 'b'], cars, NOW, testCfg);
  expect(rows.find((row) => row.label === 'Notun')!.cells).toEqual(['Lastikler yeni', '—']);
});
