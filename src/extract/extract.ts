import type { ExtractResult } from './types';

/**
 * PLACEHOLDER until plan Task 9. Selectors may only come from listing pages saved by the owner,
 * so until those exist every page is reported as unreadable and the form is filled by hand.
 */
export function extract(_doc: Document, url: string): ExtractResult {
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
