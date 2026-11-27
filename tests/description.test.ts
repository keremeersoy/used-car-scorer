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
  // Other spellings of the same warning.
  ['Şaseden işlemli', 7],
  ['sase islemli', 7],
  ['agir hasar kayitli', 7],
  ['AGIR HASAR KAYITLI', 7],
  ['agir hasar kaydi yoktur', 10],
  ['pert degil', 10],
  ['sasi islem yoktur', 10],
  // Leaving out Turkish letters must not make ordinary words match.
  ['Şaşırtıcı derecede temiz', 10],
  // Two spellings of one warning are charged once.
  ['Şasi işlemli, şase kaynaklı', 7],
  ['Airbag açılmış egirbek değişmiş', 7],
  // Every match in a clause counts, not only the first.
  ['Pert değil pert', 7],
  ['Pert yok pert kaydı yoktur', 10],
  // A list of parts shares the words that clear it.
  ['ŞASE-PODYE-DİREKLER HATASIZ', 10],
  ['Şase podye airbag sorunsuzdur', 10],
  ['Şasi ve şase hatasız', 10],
  ['Şase podye işlem yoktur', 10],
  ['Şase işlemli podye hatasız', 7],
  ['Airbag açık şasi hatasız', 7],
  // Warnings joined by "ve" or "veya" share one negation.
  ['Pert veya ağır hasar kaydı yoktur', 10],
  ['Pert kaydı ve ağır hasar kaydı bulunmamaktadır', 10],
  ['Pert ya da ağır hasar yok', 10],
  ['Pert kayıtlı ve ağır hasar yok', 7],
  ['Pert ve acil satılık değil', 4],
  // A part list written with commas.
  ['Şasi, airbag ve podye hatasız', 10],
  ['Şase, podye, airbag sorunsuz', 10],
  ['Airbag, motor arızalı', 4],
  ['Airbag, boya yok', 7],
  // "airbag yok" may mean the car has none, so a part needs a word saying what is absent.
  ['Airbag yok', 7],
  ['Araçta airbag yoktur', 7],
  ['Airbag hiç yok', 7],
  ['Şasi hasarı yok', 10],
  ['Airbag değişimi yoktur', 10],
  // A shared negation never hides a fact stated about the first warning.
  ['Motor arızalı ve ağır hasar kaydı yoktur', 7],
  ['Ağır hasarlı ve acil değil', 7],
  ['Motor arızalı ve acil değil, pazarlık payı var', 7],
  ['Pertli ve acil değil', 7],
  ['Airbagli ve pert değil', 7],
  ['Araç ağır hasarlı ve pert değildir', 7],
  ['Ağır hasar kaydı ve motor arızalı değil', 7],
  // A negator that is itself denied or questioned clears nothing.
  ['Şasi hatasız değil', 7],
  ['Pert yok değil', 7],
  ['airbag ve sasi hatasiz degil', 4],
  ['Tavan, şasi, airbag hatasız değil', 4],
  ['Ağır hasar veya pert kaydı yok mu? Var', 4],
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
