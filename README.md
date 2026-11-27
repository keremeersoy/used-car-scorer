# Araç Skoru

sahibinden.com'daki ikinci el araç ilanlarını karşılaştırmak için kişisel bir Chrome eklentisi.
İlan sayfasındayken eklenti simgesine tıklarsın; yan panel ilanı okur, 100 üzerinden bir puan ve
nedenlerini gösterir. İlanları kaydedip yan yana karşılaştırabilirsin.

> **Kullanım koşulları riski:** Site, eklentileri fark edebilir veya koşullarına aykırı sayıp hesabı
> kısıtlayabilir. Kullanmadan önce koşulları oku. Bu proje sahibinden.com ile bağlantılı değildir.

<p>
  <img src="docs/images/panel.png" alt="Yan panelde puan ve alanlar (uydurma veriler)" width="320">
</p>

![Karşılaştırma ekranı (uydurma veriler)](docs/images/compare.png)

## Özellikler

- Açık ilanı tek tıkla okur; her alan elle düzeltilebilir.
- Puan anında güncellenir, her bölümün nedeni görünür.
- Eksik bilgi hiçbir zaman "temiz" sayılmaz.
- Kayıtlı ilanları karşılaştırır, siler, dosyaya yedekler ve geri yükler.
- Tüm veriler tarayıcıda kalır; sunucu ve analitik yoktur.

## Neyi yapmaz

Siteyi taramaz, kendi kendine sayfa açmaz, ilan numarasıyla veri çekmez, bot korumasını aşmaz ve
sayfaya hiçbir şey eklemez. Yalnızca zaten açık olan sayfayı, yalnızca sen tıklayınca okur.

İzinler: `activeTab`, `scripting`, `storage`, `sidePanel`. Site izni istemez.

## Kurulum

Node 24 (bkz. `.nvmrc`) ve Chrome 116 veya üzeri gerekir.

```bash
npm ci
npm run build
```

Chrome'da `chrome://extensions` sayfasını aç, **Geliştirici modu**'nu etkinleştir, **Paketlenmemiş
öğe yükle** ile `dist/` klasörünü seç. Yeni derlemeden sonra eklentiyi yenile.

Kayıtlı ilanlar, eklentinin yüklendiği klasöre bağlıdır. Klasörü taşırsan veya eklentiyi kaldırırsan
kayıtlar kaybolur; önce **Kayıtlılar** sekmesinden **Yedek al** ile dosyaya kaydet, sonra **Yedekten
yükle** ile geri al.

## Kullanım

1. Bir ilanın detay sayfasında eklenti simgesine tıkla.
2. Gerekirse alanları düzelt (örneğin sayfada ayrı bir alanı olmayan tramer tutarı).
3. **Kaydet**'e bas.
4. **Kayıtlılar** sekmesinde en az iki ilan seçip **Karşılaştır**'a bas.

Aynı sekmede başka bir ilana geçtiysen **Tekrar oku** yeterli; yeni sekmede simgeye yeniden tıkla.

## Puanlama

| Bölüm | Ağırlık | Özet |
|---|---|---|
| Hasar | 35 | Boyalı ve değişen parçalar, tramer, ağır hasar kaydı |
| Fiyat | 30 | Elle girilen referans, yoksa benzer en az 5 kayıtlı ilanın ortanca fiyatı |
| Km | 25 | Yıllık ortalama kilometre |
| Açıklama | 10 | Uyarı ifadeleri |

Referans yoksa fiyat bölümü dışarıda bırakılır ve puan 100'e oranlanır. Fiyatlar satış fiyatı değil,
ilanda istenen fiyatlardır. Tüm sayılar ve kelime listeleri
[`src/scoring/config.ts`](src/scoring/config.ts) dosyasındadır. Ayrıntılar:
[tasarım dokümanı](docs/superpowers/specs/2026-11-27-used-car-scorer-design.md).

## Geliştirme

```bash
npm run check
```

Testleri, tip kontrolünü, derlemeyi ve bağımlılık taramasını birlikte çalıştırır. GitHub'da her
gönderimde bunlar ve CodeQL güvenlik analizi çalışır; Dependabot haftalık güncelleme önerir.

| Klasör | İçerik |
|---|---|
| `src/extract` | İlan sayfasını okuma |
| `src/scoring` | Puanlama ve ayarları |
| `src/draft`, `src/storage` | Düzenleme ve kayıt |
| `src/read` | Tıklamadan sayfa kopyasına giden akış |
| `src/ui` | Yan panel ve karşılaştırma ekranı (tüm Türkçe metinler `strings.ts` içinde) |

Kod ve yorumlar İngilizce, arayüz Türkçedir.

### İlan okuyucusunun testleri

Seçiciler, elle kaydedilen ilan sayfalarından alınır. Bu sayfalar `fixtures/` klasörüne konur ve
depoya **eklenmez**; her birinin yanında bir `<ad>.expected.json` bulunur. Klasör boşsa sayfa testleri
uyarıyla atlanır ve okuyucu doğrulanmamış sayılır (CI'da durum budur).

Sayfalardan satıcı adlarını, telefonları ve kendi hesap bilgilerini temizle. Site değişirse yeni bir
sayfa kaydet, beklenen değerleri yaz ve `src/extract/` altını düzelt. Siteden otomatik sayfa çekme.

## Durum

Çalışan ilk sürüm. Bilinen sorunlar Issues sekmesinde takip edilir.
