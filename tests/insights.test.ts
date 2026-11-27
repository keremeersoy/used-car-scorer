import { scoreListing } from '../src/scoring/score';
import type { Listing } from '../src/types';
import { findings, missingInfo, verdict } from '../src/ui/panel/insights';
import { listing, NOW, testCfg } from './helpers';

const read = (o: Partial<Listing> = {}) => {
  const entry = listing(o);
  const result = scoreListing(entry, [], NOW, testCfg);
  return {
    verdict: verdict(result, testCfg),
    findings: findings(entry, result, (key) => key, testCfg),
    missing: missingInfo(entry, testCfg),
  };
};

test('the verdict follows the score', () => {
  expect(read({ referencePrice: 1_000_000 }).verdict).toBe('good');
  expect(read({ km: 200_000, damageRecordTL: null, description: 'Acil.' }).verdict).toBe('careful');
  expect(read({ km: 400_000, parts: {}, description: 'Pert. Acil.' }).verdict).toBe('risky');
});

test('heavy damage is risky whatever the score; a missing figure is incomplete', () => {
  expect(read({ heavyDamage: true, referencePrice: 1_000_000 }).verdict).toBe('risky');
  expect(read({ km: null }).verdict).toBe('incomplete');
});

test('problems come first, worst first, and say what is wrong', () => {
  const { findings: found } = read({
    parts: { ...listing().parts, p1: 'replaced', p2: 'painted', p3: 'painted' },
    km: 250_000,
    description: 'Pert kaydı var.',
  });
  expect(found.map((f) => f.tone)).toEqual(
    [...found.map((f) => f.tone)].sort(
      (a, b) => ['bad', 'warn', 'good'].indexOf(a) - ['bad', 'warn', 'good'].indexOf(b),
    ),
  );
  expect(found[0]).toMatchObject({ tone: 'bad', text: 'Değişen parça: p1', cost: 6 });
  expect(found).toContainEqual({ tone: 'warn', text: '2 boyalı parça: p2, p3', cost: 6 });
  expect(found.some((f) => f.text.includes('pert') && f.detail === 'Pert kaydı var')).toBe(true);
});

test('a clean car lists its good points', () => {
  const good = read()
    .findings.filter((f) => f.tone === 'good')
    .map((f) => f.text);
  expect(good).toEqual(
    expect.arrayContaining(['Boyalı veya değişen parça yok', 'Ağır hasar kaydı yok']),
  );
});

test('unknown values are listed as missing, never praised', () => {
  const result = read({ parts: {}, damageRecordTL: null, heavyDamage: null, description: null });
  expect(result.missing).toEqual([
    '8 parçanın boya durumu',
    'Hasar kaydı (tramer) tutarı',
    'Ağır hasar kaydı durumu',
    'Açıklama',
  ]);
  expect(result.findings.filter((f) => f.tone === 'good').map((f) => f.text)).not.toContain(
    'Boyalı veya değişen parça yok',
  );
});
