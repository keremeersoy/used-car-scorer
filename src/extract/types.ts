import type { PageRead } from '../types';

export type ExtractNotice = 'foreignCurrency';

export interface ExtractResult {
  read: PageRead;
  recognised: boolean; // false: the page could not be read as a listing
  notices: ExtractNotice[];
}

/** A page nothing could be read from: every value stays unknown. */
export function unrecognised(url: string): ExtractResult {
  return {
    read: {
      id: null,
      url,
      title: null,
      price: null,
      brand: null,
      series: null,
      model: null,
      year: null,
      km: null,
      fuel: null,
      gearbox: null,
      engine: null,
      heavyDamage: null,
      damageRecordTL: null,
      parts: {},
      description: null,
    },
    recognised: false,
    notices: [],
  };
}
