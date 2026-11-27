// All Turkish copy lives here.
import { config } from '../scoring/config';
import type { ConditionClass } from '../scoring/market';
import type { PriceBand, Reason, SectionKey, Warning } from '../scoring/types';
import type { Rejected } from '../storage/backup';
import type { Listing, PartStatus } from '../types';
import type { Notice } from './panel/panelState';

export const strings = {
  tabListing: 'İlan',
  autoRead: 'Otomatik oku',
  autoReadEnable: 'Otomatik okumayı aç',
  autoReadOnHint: 'Açtığın ilanlar kendiliğinden okunuyor. Kapatmak için tıkla.',
  heavyNote: 'Ağır hasar kayıtlı.',
  referenceHint: 'Boşsa baktığın ve kaydettiğin benzer ilanlardan hesaplanır.',
  autoReadConsent: 'Chrome sahibinden.com için izin soracak. İstediğin zaman kapatabilirsin.',
  emptyTitle: 'Bir ilan sayfası aç',
  emptyManual: 'Sonra Chrome araç çubuğundaki eklenti simgesine tıkla.',
  emptyAuto: 'Açtığın ilan burada kendiliğinden puanlanacak.',
  watchOut: 'Dikkat etmen gerekenler',
  nothingToWatch: 'Dikkat çeken bir sorun bulunmadı.',
  goodSides: 'İyi yanları',
  missingTitle: 'Henüz bilinmiyor',
  extraTitle: 'Satıcıdan öğrendiklerin',
  extraHint: 'İlanda yazmayan bilgileri ekle, puan hemen güncellensin.',
  marketTitle: 'Fiyat kıyası',
  thisCar: '(bu araç)',
  peers: 'Emsaller',
  marketHint: 'Aynı paketten başka ilanları açtıkça burada birikir.',
  poolTitle: 'Fiyat kıyası havuzu',
  poolHint:
    'Baktığın ilanların fiyatı ve kaporta durumu 30 gün boyunca yalnızca bu tarayıcıda hatırlanır.',
  poolCount: 'Hatırlanan ilan:',
  poolClear: 'Havuzu temizle',
  poolClearConfirm: 'Evet, temizle',
  bodyTitle: 'Kaporta',
  noteHint: 'Sadece sende kalır. Satıcıyla konuştukların, pazarlık, randevu…',
  bodyHint: 'Durumunu değiştirmek için bir parçayı seç.',
  breakdownTitle: 'Puan dökümü',
  breakdownHint: 'Nedenlerini görmek için bir satırı aç.',
  readThisTab: 'Açık sekmeyi oku',
  allFields: 'Tüm ilan bilgileri',
  noRecordAction: 'Kayıt yok',
  select: 'Karşılaştırmaya ekle',
  chooseTwo: 'Karşılaştırmak için en az iki ilan seç.',
  backupTitle: 'Yedekleme',
  tabSaved: 'Kayıtlılar',
  save: 'Kaydet',
  saved: 'Kaydedildi',
  update: 'Güncelle',
  savedBadge: 'Kayıtlı',
  reread: 'Tekrar oku',
  compare: 'Karşılaştır',
  remove: 'Sil',
  open: 'Aç',
  cancel: 'Vazgeç',
  referencePrice: 'Referans fiyat',
  insufficient: 'yetersiz veri',
  clickIconToRead: 'İlanı okumak için eklenti simgesine tıklayın',
  fillByHand: 'Alanları elle doldurabilirsiniz.',
  unsaved: 'Kaydedilmemiş değişiklikler var',
  discard: 'Vazgeç ve değiştir',
  stay: 'Burada kal',
  overwrite: 'Bu ilan numarasındaki kayıt farklı veya değişmiş. Üzerine yazılsın mı?',
  overwriteConfirm: 'Üzerine yaz',
  needId: 'Kaydetmek için ilan numarası gerekli.',
  fixInvalid: 'Kaydetmek için geçersiz alanları düzeltin.',
  askingPrice: 'Fiyatlar satış fiyatı değil, ilanda istenen fiyatlardır.',
  invalidNumber: 'Geçersiz sayı',
  pageSays: 'Sayfada:',
  usePage: 'Sayfadakini al',
  missingForTotal: 'Toplam puan için eksik:',
  noSaved: 'Henüz kayıtlı ilan yok.',
  confirmDelete: 'Silinsin mi?',
  confirmDeleteYes: 'Evet, sil',
  untitled: 'Başlıksız ilan',
  fields: 'Alanlar',
  parts: 'Boya ve değişen',
  damageRecordHint: 'Boş: bilinmiyor · 0: kayıt yok',
  storageUnreadable: 'Kayıtlı veriler okunamadı. Veriler değiştirilmedi.',
  storageFailed: 'Kayıt işlemi başarısız oldu. Tekrar deneyin.',
  storageReadFailed: 'Kayıtlı veriler okunamadı. Tekrar deneyin.',
  compareNothing: 'Karşılaştırılacak kayıtlı ilan bulunamadı.',
  openListing: 'İlanı aç',
  leftOut: 'Puana katılmayan:',
  noDeductions: 'Kesinti yok: boyalı ya da değişen parça ve hasar kaydı yok.',
  noPhrases: 'Uyarı ifadesi bulunmadı.',
  none: 'Yok',
  notFound: 'Kayıtlarda bulunamayan ilanlar:',
  exportBackup: 'Yedek al',
  restoreBackup: 'Yedekten yükle',
  backupUnreadable: 'Yedek dosyası okunamadı. Hiçbir kayıt değişmedi.',
  backupTooLarge: 'Dosya çok büyük. Hiçbir kayıt değişmedi.',
  noRecord: 'Kayıt yok',
  incomplete: 'bilgi eksik',
} as const;

export const fieldLabels = {
  id: 'İlan no',
  title: 'Başlık',
  price: 'Fiyat (TL)',
  referencePrice: 'Referans fiyat',
  brand: 'Marka',
  series: 'Seri',
  model: 'Model',
  year: 'Yıl',
  km: 'Km',
  fuel: 'Yakıt',
  gearbox: 'Vites',
  engine: 'Motor',
  heavyDamage: 'Ağır hasar kaydı',
  damageRecordTL: 'Hasar kaydı / tramer (TL)',
  description: 'Açıklama',
  note: 'Notun',
} as const;

export const compareLabels = {
  total: 'Puan',
  section: (name: string) => `${name} puanı`,
  kmPerYear: 'Yıllık km',
  localPaint: 'Lokal boyalı parçalar',
  painted: 'Boyalı parçalar',
  replaced: 'Değişen parçalar',
  warnings: 'Uyarılar',
} as const;

export const partStatusLabels: Record<PartStatus, string> = {
  original: 'Orijinal',
  localPaint: 'Lokal boyalı',
  painted: 'Boyalı',
  replaced: 'Değişen',
  unknown: 'Bilinmiyor',
};

export const heavyDamageLabels = { yes: 'Evet', no: 'Hayır', unknown: 'Bilinmiyor' } as const;

export const sectionLabels: Record<SectionKey, string> = {
  damage: 'Hasar',
  price: 'Fiyat',
  km: 'Km',
  description: 'Açıklama',
};

const bandLabels: Record<PriceBand, string> = {
  veryCheap: 'Çok ucuz, nedenini kontrol et',
  good: 'İyi fiyat',
  normal: 'Normal',
  high: 'Biraz pahalı',
  expensive: 'Pahalı',
};

export const noticeText: Record<Notice, string> = {
  unreadable: 'İlan okunamadı',
  notSahibinden: 'Bu sayfa sahibinden.com değil',
  noAccess: 'Eklenti simgesine tıklayın',
  foreignCurrency: 'Fiyat TL değil. TL karşılığını elle yazın.',
  priceUnreadable: 'Fiyat okunamadı. Fiyatı elle yazın.',
};

export const formatNumber = (value: number, digits = 1) =>
  value.toLocaleString('tr-TR', { maximumFractionDigits: digits });

export const restoreSummary = (added: number, updated: number, skipped: number) =>
  `Yedek yüklendi: ${added} eklendi, ${updated} güncellendi, ${skipped} atlandı.`;

const backupFieldLabels: Partial<Record<keyof Listing, string>> = {
  ...fieldLabels,
  url: 'Adres',
  savedAt: 'Kayıt tarihi',
  updatedAt: 'Güncelleme tarihi',
  parts: 'Boya ve değişen',
  editedFields: 'Düzenleme listesi',
};

const REJECTED_SHOWN = 5;

export function rejectedSummary(rejected: Rejected[]): string {
  if (rejected.length === 0) return '';
  const named = rejected.slice(0, REJECTED_SHOWN).map(({ position, id, field }) => {
    const name = id ? `#${id}` : `${position}. kayıt`;
    return `${name} (${field ? backupFieldLabels[field] : 'biçim'})`;
  });
  const rest = rejected.length - named.length;
  const more = rest > 0 ? ` ve ${rest} tane daha` : '';
  return `${rejected.length} kayıt bozuk olduğu için alınmadı: ${named.join(', ')}${more}.`;
}

export const formatMoney = (value: number) => `${formatNumber(value, 0)} TL`;

export function reasonText(reason: Reason, partLabel: (key: string) => string): string {
  switch (reason.code) {
    case 'heavyDamage':
      return 'Ağır hasar kaydı var: hasar bölümü 0 puan';
    case 'part':
      return `${partLabel(reason.part)}: ${partStatusLabels[reason.status]} (−${formatNumber(reason.points)})`;
    case 'roofExtra':
      return `Tavan boyalı veya değişen: ek −${formatNumber(reason.points)}`;
    case 'record':
      return `Hasar kaydı ${formatMoney(reason.amount)}: −${formatNumber(reason.points)} puan`;
    case 'recordUnknown':
      return `Hasar kaydı tutarı bilinmiyor: −${formatNumber(reason.points)} puan`;
    case 'heavyUnknown':
      return `Ağır hasar durumu bilinmiyor: −${formatNumber(reason.points)} puan`;
    case 'partsCap':
      return `Parça bilgisi eksik: hasar puanı en fazla ${reason.cap}`;
    case 'priceBand': {
      const sign = reason.diff > 0 ? '+' : reason.diff < 0 ? '−' : '';
      const percent = formatNumber(Math.abs(reason.diff) * 100);
      const group = reason.condition
        ? `${conditionLabels[reason.condition].toLocaleLowerCase('tr-TR')} `
        : '';
      const source =
        reason.source === 'manual'
          ? 'elle girildi'
          : `${reason.count} ilanın ortanca fiyatı, ${group}araçlar${reason.lowData ? ', az veriyle' : ''}`;
      return `${bandLabels[reason.band]}: referansa göre ${sign}%${percent} (${formatMoney(reason.reference)}, ${source})`;
    }
    case 'noReference':
      return `${strings.insufficient}: ${noReferenceText(reason, null)}`;
    case 'kmPerYear':
      return `Yılda ortalama ${formatNumber(reason.value, 0)} km`;
    case 'phrase': {
      const outcome = reason.negated
        ? 'olumsuz ifade, sayılmadı'
        : reason.points > 0
          ? `−${reason.points} puan`
          : 'tekrar, yeniden sayılmadı';
      return `“${reason.phrase}” (${outcome}): ${reason.sentence}`;
    }
  }
}

export function warningText(warning: Warning): string {
  switch (warning) {
    case 'unknownParts':
      return 'Boya ve değişen bilgisi eksik';
    case 'recordUnknown':
      return 'Hasar kaydı tutarı bilinmiyor';
    case 'heavyUnknown':
      return 'Ağır hasar durumu bilinmiyor';
    case 'heavyDamage':
      return 'AĞIR HASAR KAYITLI';
    case 'checkKm':
      return 'Kilometreyi kontrol edin';
    case 'descriptionMissing':
      return 'Açıklama yok: puana katılmadı';
    case 'noReference':
      return `Fiyat için ${strings.insufficient}`;
  }
}

export const verdictText = {
  good: { title: 'İyi aday', note: 'Belirgin bir sorun görünmüyor.' },
  careful: { title: 'Dikkatli bak', note: 'Almadan önce aşağıdakileri kontrol et.' },
  risky: { title: 'Riskli', note: 'Ciddi sorunlar var.' },
  incomplete: { title: 'Bilgi eksik', note: 'Fiyat, yıl ve km girilince puan çıkar.' },
} as const;

const counted = (count: number, what: string, names: string) =>
  count === 1
    ? `${what.charAt(0).toLocaleUpperCase('tr-TR')}${what.slice(1)} parça: ${names}`
    : `${count} ${what} parça: ${names}`;

export const findingText = {
  heavyDamage: 'Ağır hasar kaydı var',
  replaced: (names: string[]) => counted(names.length, 'değişen', names.join(', ')),
  painted: (names: string[]) => counted(names.length, 'boyalı', names.join(', ')),
  localPaint: (names: string[]) => counted(names.length, 'lokal boyalı', names.join(', ')),
  record: (amount: number) => `Hasar kaydı (tramer): ${formatMoney(amount)}`,
  veryCheap: (percent: number) =>
    `Referanstan %${formatNumber(percent, 0)} ucuz: nedenini satıcıya sor`,
  cheap: (percent: number) => `İyi fiyat: referanstan %${formatNumber(percent, 0)} ucuz`,
  expensive: (percent: number) => `Referanstan %${formatNumber(percent, 0)} pahalı`,
  kmVeryHigh: (perYear: number) => `Km çok yüksek: yılda ${formatNumber(perYear, 0)} km`,
  kmHigh: (perYear: number) => `Km yüksek: yılda ${formatNumber(perYear, 0)} km`,
  kmLow: (perYear: number) => `Km düşük: yılda ${formatNumber(perYear, 0)} km`,
  kmSuspicious: 'Km yaşına göre çok düşük: doğrula',
  phrase: (phrase: string) => `Açıklamada “${phrase}” geçiyor`,
  noParts: 'Boyalı veya değişen parça yok',
  noHeavyDamage: 'Ağır hasar kaydı yok',
  noRecord: 'Hasar kaydı yok',
};

export const missingText = {
  price: 'Fiyat',
  year: 'Yıl',
  km: 'Km',
  parts: (count: number) => `${count} parçanın boya durumu`,
  record: 'Hasar kaydı (tramer) tutarı',
  heavyDamage: 'Ağır hasar kaydı durumu',
  description: 'Açıklama',
};

/** The facts shown under a title: only the ones that are known. */
export function factList(car: Pick<Listing, 'year' | 'km' | 'fuel' | 'gearbox'>): string[] {
  return [
    car.year === null ? null : `${car.year} model`,
    car.km === null ? null : `${formatNumber(car.km, 0)} km`,
    car.fuel,
    car.gearbox,
  ].filter((fact): fact is string => Boolean(fact));
}

export const conditionLabels: Record<ConditionClass, string> = {
  clean: 'Temiz',
  painted: 'Boyalı',
  replaced: 'Değişenli',
};

type PriceReason = Extract<Reason, { code: 'priceBand' | 'noReference' }>;

function noReferenceText(
  reason: Extract<Reason, { code: 'noReference' }>,
  own: ConditionClass | null,
): string {
  if (reason.why === 'heavy') return 'ağır hasarlı araç emsallerle kıyaslanmaz';
  if (reason.why === 'parts') return 'boya bilgisi eksik olduğu için gruplanamıyor';
  const group = own ? `${conditionLabels[own]} grubunda ` : '';
  return `${group}yalnızca ${reason.found} benzer araç var, en az ${config.price.lowComparables} gerekli`;
}

/** The price comparison in one or two sentences. */
export function marketText(reason: PriceReason, own: ConditionClass | null): string {
  if (reason.code === 'noReference') {
    const text = noReferenceText(reason, own);
    return `${text.charAt(0).toLocaleUpperCase('tr-TR')}${text.slice(1)}.`;
  }
  const sign = reason.diff > 0 ? '+' : reason.diff < 0 ? '−' : '';
  const band = `${bandLabels[reason.band]} (${sign}%${formatNumber(Math.abs(reason.diff) * 100)}).`;
  const amount = formatMoney(reason.reference);
  if (reason.source === 'manual') return `${band} Elle girdiğin referans: ${amount}.`;
  const group = reason.condition ? `${conditionLabels[reason.condition]} ` : '';
  const caution = reason.lowData ? ' Bu sonuç az veriyle çıktı.' : '';
  return `${band} ${group}${reason.count} benzer aracın ortancası ${amount}.${caution}`;
}
