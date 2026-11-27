export type SectionKey = 'damage' | 'price' | 'km' | 'description';
export type PriceBand = 'veryCheap' | 'good' | 'normal' | 'high' | 'expensive';

/** `points` is what was taken off, except for kmPerYear where it is what was earned. */
export type Reason =
  | { code: 'heavyDamage' }
  | { code: 'part'; part: string; status: 'localPaint' | 'painted' | 'replaced'; points: number }
  | { code: 'roofExtra'; points: number }
  | { code: 'record'; amount: number; points: number }
  | { code: 'recordUnknown'; points: number }
  | { code: 'heavyUnknown'; points: number }
  | { code: 'partsCap'; cap: number }
  | {
      code: 'priceBand';
      band: PriceBand;
      diff: number;
      reference: number;
      source: 'manual' | 'median';
      count: number | null;
    }
  | { code: 'noReference'; found: number }
  | { code: 'kmPerYear'; value: number; points: number }
  | { code: 'phrase'; phrase: string; sentence: string; negated: boolean; points: number };

export type Warning =
  | 'unknownParts'
  | 'recordUnknown'
  | 'heavyUnknown'
  | 'heavyDamage'
  | 'checkKm'
  | 'descriptionMissing'
  | 'noReference';

export type MissingField = 'price' | 'km' | 'year';

export interface SectionResult {
  points: number | null; // null: the section cannot be scored
  max: number;
  reasons: Reason[];
  warnings: Warning[];
}

export interface ScoreResult {
  total: number | null;
  sections: Record<SectionKey, SectionResult>;
  missing: MissingField[];
  warnings: Warning[];
}
