import { JSDOM } from 'jsdom';
import { extract } from '../src/extract/extract';

const parse = (html: string) => new JSDOM(html).window.document;

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
