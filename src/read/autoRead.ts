import { isSahibindenUrl } from './readTab';

/** The optional access automatic reading needs; the owner grants and revokes it in the panel. */
export const SITE_ACCESS = { origins: ['https://*.sahibinden.com/*'] };

const LISTING_PATH = /^\/ilan\/(?:[^/]*-)?\d+\/detay\/?$/;

/** Only a listing's own page is read automatically, never search results or other pages. */
export function isListingUrl(url: string): boolean {
  return isSahibindenUrl(url) && LISTING_PATH.test(new URL(url).pathname);
}
