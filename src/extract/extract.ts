import { unrecognised, type ExtractResult } from './types';

/**
 * PLACEHOLDER until plan Task 9. Selectors may only come from listing pages saved by the owner,
 * so until those exist every page is reported as unreadable and the form is filled by hand.
 */
export function extract(_doc: Document, url: string): ExtractResult {
  return unrecognised(url);
}
