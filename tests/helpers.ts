import { type Config, config } from '../src/scoring/config';
import type { Listing, Observation, PageRead, PartStatus } from '../src/types';

export const NOW = new Date('2026-11-27T12:00:00Z');

const partKeys = ['roof', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

/** The real config with a small invented part list, so tests do not depend on the site's parts. */
export const testCfg: Config = {
  ...config,
  damage: { ...config.damage, parts: partKeys.map((key) => ({ key, label: key })) },
};

/** A clean, complete listing; override only what the test is about. */
export function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: '1',
    url: 'https://www.sahibinden.com/ilan/test-1',
    savedAt: NOW.toISOString(),
    title: 'Test ilanı',
    price: 1_000_000,
    brand: 'Marka',
    series: 'Seri',
    model: 'Model',
    year: 2020,
    km: 60_000,
    fuel: 'Benzin',
    gearbox: 'Manuel',
    engine: '1.6',
    heavyDamage: false,
    damageRecordTL: 0,
    parts: Object.fromEntries(partKeys.map((key) => [key, 'original' as PartStatus])),
    description: 'Temiz araç.',
    referencePrice: null,
    note: null,
    editedFields: [],
    ...overrides,
  };
}

/** The same listing as a page read would report it. */
export function page(overrides: Partial<Listing> = {}): PageRead {
  const {
    savedAt: _savedAt,
    referencePrice: _reference,
    note: _note,
    editedFields: _edited,
    ...read
  } = listing(overrides);
  return read;
}

/** The same listing as it is remembered after only being looked at. */
export function observation(overrides: Partial<Listing> = {}): Observation {
  const car = listing(overrides);
  const { id, url, title, brand, series, model, year, km, fuel, gearbox, price } = car;
  const { heavyDamage, parts, savedAt: seenAt } = car;
  return {
    id,
    url,
    title,
    brand,
    series,
    model,
    year,
    km,
    fuel,
    gearbox,
    price,
    heavyDamage,
    parts,
    seenAt,
  };
}
