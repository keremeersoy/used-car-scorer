import { parsePrice, parseWholeNumber, parseYear } from '../src/ui/parse';

test.each<[string, number | null]>([
  ['', null], ['  ', null], ['0', 0], ['1250000', 1_250_000], ['1.250.000', 1_250_000],
  ['1 250 000', 1_250_000], ['85.000 km', 85_000], ['750.000 TL', 750_000],
])('%j', (text, value) => expect(parseWholeNumber(text)).toEqual({ ok: true, value }));

test.each(['abc', '12,5', '-5', '1.5', '12.50', '1..000'])('rejects %j', (text) =>
  expect(parseWholeNumber(text)).toEqual({ ok: false }));

test('a price of zero counts as blank', () => {
  expect(parsePrice('0')).toEqual({ ok: true, value: null });
  expect(parsePrice('900.000')).toEqual({ ok: true, value: 900_000 });
});

test('a year is blank or exactly four digits', () => {
  expect(parseYear(' ')).toEqual({ ok: true, value: null });
  expect(parseYear('2018')).toEqual({ ok: true, value: 2018 });
  for (const text of ['18', '2.018', '20180', 'abcd']) expect(parseYear(text)).toEqual({ ok: false });
});

test('a model year must be plausible', () => {
  expect(parseYear('1900', 2027)).toEqual({ ok: true, value: 1900 });
  expect(parseYear('2027', 2027)).toEqual({ ok: true, value: 2027 });
  for (const text of ['1899', '2028', '2108', '0000']) {
    expect(parseYear(text, 2027)).toEqual({ ok: false });
  }
});
