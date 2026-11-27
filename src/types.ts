export type PartStatus = 'original' | 'localPaint' | 'painted' | 'replaced' | 'unknown';

/** What is known about a car. A missing value is null or 'unknown', never a guess. */
export interface ListingData {
  title: string | null;
  price: number | null; // TL
  brand: string | null;
  series: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  gearbox: string | null;
  engine: string | null;
  heavyDamage: boolean | null;
  damageRecordTL: number | null; // 0 means the listing states there is no record
  parts: Record<string, PartStatus>;
  description: string | null;
}

export interface Listing extends ListingData {
  id: string; // listing number
  url: string;
  savedAt: string; // ISO date
  referencePrice: number | null; // entered by hand
  editedFields: string[];
}

/** The result of reading a listing page. */
export interface PageRead extends ListingData {
  id: string | null;
  url: string;
}

export type Scorable = ListingData & { id: string; referencePrice: number | null };
