// All Turkish copy lives here.
import { config } from '../scoring/config';
import type { PriceBand, Reason, SectionKey, Warning } from '../scoring/types';
import type { PartStatus } from '../types';
import type { Notice } from './panel/panelState';

export const strings = {
  tabListing: 'İlan',
  tabSaved: 'Kayıtlılar',
  save: 'Kaydet',
  saved: 'Kaydedildi',
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
  overwrite: 'Bu ilan numarası zaten kayıtlı. Üzerine yazılsın mı?',
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
  storageFailed: 'Kayıt işlemi başarısız oldu:',
  compareNothing: 'Karşılaştırılacak kayıtlı ilan bulunamadı.',
  openListing: 'İlanı aç',
  leftOut: 'Puana katılmayan:',
  noDeductions: 'Kesinti yok: boyalı ya da değişen parça ve hasar kaydı yok.',
  noPhrases: 'Uyarı ifadesi bulunmadı.',
  none: 'Yok',
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
};

export const formatNumber = (value: number, digits = 1) =>
  value.toLocaleString('tr-TR', { maximumFractionDigits: digits });

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
      const source =
        reason.source === 'manual' ? 'elle girildi' : `${reason.count} ilanın ortanca fiyatı`;
      return `${bandLabels[reason.band]}: referansa göre ${sign}%${percent} (${formatMoney(reason.reference)}, ${source})`;
    }
    case 'noReference':
      return `${strings.insufficient}: ${reason.found} benzer ilan var, en az ${config.price.minComparables} gerekli`;
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
