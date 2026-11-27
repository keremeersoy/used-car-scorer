// Every scoring number and phrase list lives in this file.
import type { PriceBand, SectionKey } from './types';

export interface PartDef {
  key: string;
  label: string; // Turkish, shown in the UI
}

export interface Config {
  weights: Record<SectionKey, number>;
  damage: {
    penalty: Record<'localPaint' | 'painted' | 'replaced', number>;
    roofExtra: number; // on top of the part penalty, for a painted or replaced roof
    recordMax: number;
    recordFullRatio: number; // record / price at which the full penalty applies
    unknownRecord: number;
    unknownHeavy: number;
    incompleteCap: number; // ceiling when any expected part is unknown
    parts: PartDef[]; // the expected parts; an empty list never counts as complete
    roofPart: string;
  };
  price: {
    cheapAt: number; // diff <= this: very cheap
    goodBelow: number; // diff < this: good
    normalUpTo: number; // diff <= this: normal
    highUpTo: number; // diff <= this: high, above it: expensive
    points: Record<PriceBand, number>;
    minComparables: number;
    maxAgeDays: number;
    yearSpread: number;
  };
  km: {
    bands: [perYearUpTo: number, points: number][];
    above: number;
    lowPerYear: number;
    lowAgeOver: number; // the low-km warning applies to cars older than this
  };
  description: {
    penalty: number;
    phrases: string[];
    negators: string[];
  };
}

export const config: Config = {
  weights: { damage: 35, price: 30, km: 25, description: 10 },
  damage: {
    penalty: { localPaint: 1, painted: 3, replaced: 6 },
    roofExtra: 6,
    recordMax: 10,
    recordFullRatio: 0.1,
    unknownRecord: 5,
    unknownHeavy: 5,
    incompleteCap: 15,
    // PROVISIONAL: the usual body panels, so the form can be filled by hand.
    // Plan Task 9 checks keys and labels against the saved listing pages.
    parts: [
      { key: 'roof', label: 'Tavan' },
      { key: 'hood', label: 'Motor kaputu' },
      { key: 'trunk', label: 'Bagaj kapağı' },
      { key: 'frontBumper', label: 'Ön tampon' },
      { key: 'rearBumper', label: 'Arka tampon' },
      { key: 'leftFrontFender', label: 'Sol ön çamurluk' },
      { key: 'rightFrontFender', label: 'Sağ ön çamurluk' },
      { key: 'leftRearFender', label: 'Sol arka çamurluk' },
      { key: 'rightRearFender', label: 'Sağ arka çamurluk' },
      { key: 'leftFrontDoor', label: 'Sol ön kapı' },
      { key: 'rightFrontDoor', label: 'Sağ ön kapı' },
      { key: 'leftRearDoor', label: 'Sol arka kapı' },
      { key: 'rightRearDoor', label: 'Sağ arka kapı' },
    ],
    roofPart: 'roof',
  },
  price: {
    cheapAt: -0.1,
    goodBelow: -0.03,
    normalUpTo: 0.03,
    highUpTo: 0.1,
    points: { veryCheap: 25, good: 30, normal: 22, high: 12, expensive: 5 },
    minComparables: 5,
    maxAgeDays: 30,
    yearSpread: 1,
  },
  km: {
    bands: [
      [10_000, 25],
      [15_000, 21],
      [20_000, 16],
      [30_000, 9],
    ],
    above: 3,
    lowPerYear: 3_000,
    lowAgeOver: 3,
  },
  description: {
    penalty: 3,
    phrases: ['ağır hasar', 'pert', 'airbag', 'şasi', 'motor arızalı', 'acil'],
    negators: ['yok', 'yoktur', 'değil', 'değildir', 'bulunmamaktadır', 'bulunmuyor'],
  },
};
