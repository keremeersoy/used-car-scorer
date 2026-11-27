import { parseWholeNumber } from '../src/ui/parse';

test.each<[string, number | null]>([
  ['', null], ['  ', null], ['0', 0], ['1250000', 1_250_000], ['1.250.000', 1_250_000],
  ['1 250 000', 1_250_000], ['85.000 km', 85_000], ['750.000 TL', 750_000],
])('%j', (text, value) => expect(parseWholeNumber(text)).toEqual({ ok: true, value }));

test.each(['abc', '12,5', '-5', '1.5', '12.50', '1..000'])('rejects %j', (text) =>
  expect(parseWholeNumber(text)).toEqual({ ok: false }));
