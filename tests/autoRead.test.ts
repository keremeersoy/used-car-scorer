import { isListingUrl } from '../src/read/autoRead';

test.each([
  'https://www.sahibinden.com/ilan/vasita-otomobil-marka-baslik-1234567890/detay',
  'https://sahibinden.com/ilan/1234567890/detay/',
])('a listing page is read automatically: %s', (url) => expect(isListingUrl(url)).toBe(true));

test.each([
  'https://www.sahibinden.com/otomobil',
  'https://www.sahibinden.com/ilan/vasita-otomobil/detay',
  'https://www.sahibinden.com/arama?q=/ilan/1234567890/detay',
  'https://sahibinden.com.evil.com/ilan/1234567890/detay',
  'not a url',
])('anything else is left alone: %s', (url) => expect(isListingUrl(url)).toBe(false));
