import type { PageRead } from '../types';

export type ExtractNotice = 'foreignCurrency';

export interface ExtractResult {
  read: PageRead;
  recognised: boolean; // false: the page could not be read as a listing
  notices: ExtractNotice[];
}
