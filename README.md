# Used Car Scorer

A private Chrome extension for comparing used cars on sahibinden.com. Open a listing, click the
extension icon, get a score out of 100 with reasons, save it and compare saved listings.

## Terms of service risk

The site may detect extensions or consider them against its terms, and may restrict the account.
Read the terms before using this. The extension only reads the page already open, only on a click,
sends nothing anywhere and keeps all data in the browser.

## Install

```bash
npm install
npm run build
```

In Chrome open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and select
`dist/`. After a rebuild, press the reload button on the extension.

Chrome ties saved listings to the folder the extension is loaded from. Do not move the project.

## Use

1. Open a listing and click the icon. The side panel reads it and shows the score.
2. Correct or add fields (for example the damage record amount, which the page has no field for).
3. Press **Kaydet**.
4. In **Kayıtlılar**, select two or more and press **Karşılaştır**.

**Tekrar oku** reads the next listing opened in the same tab. A new tab needs the icon again.

## Scoring

All weights, bands, warning phrases and negators are in `src/scoring/config.ts`.

## Development

```bash
npm test
npm run typecheck
```

The reader's selectors come from listing pages saved by hand into `fixtures/` (git-ignored), each
with a `<name>.expected.json` beside it. Without them the page tests are skipped with a warning and
the reader is not verified. Remove seller names, phone numbers and your own account details from
saved pages. When the site changes, save a new page, add its expected values and fix
`src/extract/`. Never fetch pages from the site.
