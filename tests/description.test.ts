import { config } from '../src/scoring/config';
import { scoreDescription } from '../src/scoring/description';

const run = (text: string | null) => scoreDescription(text, config);

test.each<[string, number]>([
  ['Temiz araç.', 10],
  ['Aracın pert kaydı yoktur.', 10],
  ['Ekspertiz raporu mevcut.', 10],
  ['Acil satılık, acil!', 7],
  ['Pert kaydı yok, acil satılık', 7],
  ['Ağır hasarlı pert araç', 4],
  ['ağır hasar pert airbag şasi motor arızalı acil', 0],
  ['ACİL SATILIK', 7],
  ['ACIL SATILIK', 7],
  ['PERT KAYDI YOKTUR', 10],
  ['Yok böyle araba. Pert.', 7],
  // Spellings and wording sellers use.
  ['AIRBAGLER-HATASIZDIR', 10],
  ['Airbagler hatasız', 10],
  ['Airbag sorunsuz', 10],
  ['Airbagler sorunsuzdur', 10],
  ['Tavan egirbek tamir edildi', 7],
  ['Airbek patladı', 7],
  ['Acil satılık, sorunsuz araç', 7],
  // A negator that belongs to something else must not clear the warning.
  ['Pert kayıtlı motor sorunsuz', 7],
  ['Pert kayıtlıdır motoru hatasız', 7],
  ['Acil satılık sorunsuz araç', 7],
  ['ACİL SATILIK SORUNSUZ', 7],
  ['Acil sorunsuz', 7],
  ['Ağır hasar kayıtlı boya yok', 7],
  ['Ağır hasar kayıtlı sorunsuz', 7],
  ['Ağır hasar değişen yok', 7],
  ['Pert araç sorun yok', 7],
  ['Airbag açtı değişen yok', 7],
  ['Airbag orijinal değil', 7],
  // Real negations still clear it.
  ['Ağır hasar kaydı kesinlikle yoktur', 10],
  ['Pert kaydı bulunmamaktadır', 10],
  ['Ağır hasarlı değildir', 10],
  ['Airbag sorunu yok', 10],
  ['Şasi işlem yoktur', 10],
  ['Airbagler orijinal ve hatasız', 10],
])('%s → %i', (text, points) => expect(run(text).points).toBe(points));

test('every match shows its sentence, negated ones uncounted', () => {
  expect(run('1.6 motor, 85.000 km, pert kaydı yoktur. Temiz.').reasons).toEqual([
    {
      code: 'phrase',
      phrase: 'pert',
      sentence: '1.6 motor, 85.000 km, pert kaydı yoktur',
      negated: true,
      points: 0,
    },
  ]);
});

test('a repeated phrase is charged once', () => {
  expect(run('Acil. Acil.').reasons.map((r) => r.code === 'phrase' && r.points)).toEqual([3, 0]);
});

test.each([null, '', '   '])('blank description %j is left out', (text) => {
  expect(run(text)).toMatchObject({ points: null, warnings: ['descriptionMissing'] });
});
