# Used Car Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private Chrome extension that reads an open sahibinden.com listing on click, scores it out of 100 with reasons, saves it and compares saved listings.

**Architecture:** The toolbar click opens a side panel and records a read request. The panel copies the tab's HTML with `chrome.scripting.executeScript`, parses it with `DOMParser`, and runs pure `extract`, scoring and draft functions. Saved listings live in `chrome.storage.local`; compare is an extension page in a full tab.

**Tech Stack:** Manifest V3, TypeScript 7, Vite 8, React 19, Vitest 5, jsdom, `@types/chrome`.

**Spec:** `docs/superpowers/specs/2026-11-27-used-car-scorer-design.md`

## Global Constraints

- Permissions are exactly `activeTab`, `scripting`, `storage`, `sidePanel`. No `host_permissions`, `optional_permissions`, `optional_host_permissions`, `content_scripts`, `web_accessible_resources`, `externally_connectable`. `minimum_chrome_version` `"116"`.
- Never send a request to sahibinden, navigate automatically, fetch by listing number, evade bot protection, or add anything to the page. Never fetch the site during development either.
- Read only on a user click (toolbar icon or **Tekrar oku**).
- Selectors come only from `fixtures/`, saved by hand by the owner. Never guess them.
- No server, analytics, remote code, fonts or images. No `fetch` or `XMLHttpRequest` in `src/`.
- Page HTML is untrusted: read text only; never insert it into extension UI.
- UI Turkish, with all copy in `src/ui/strings.ts`. Code and comments English.
- A missing value is `null` or `'unknown'`. Never guess it or treat it as clean.
- All scoring numbers and phrase lists live in `src/scoring/config.ts`. Scoring functions are pure and receive `now`.
- Scores are never stored.
- `fixtures/` is git-ignored and never committed.
- Commits are local only. Nothing is pushed.

## Review Focus

1. Numbers typed the Turkish way (`1.250.000`, `85.000 km`) must parse as whole numbers; unclear input is rejected, never turned into 0 or a smaller number. (Task 10)
2. All-caps descriptions (`ACİL`, `ACIL`, `PERT KAYDI YOKTUR`) must match and negate like lowercase. (Task 4)
3. A second read arriving while the first is running: only the newest may change the panel. (Task 8)
4. Stored data that is corrupt or from an unknown version must show an error and never be overwritten. (Task 6)
5. Lookalike hosts (`sahibinden.com.evil.com`, `notsahibinden.com`) must not be read. (Task 8)

## Files

| Path | Responsibility |
|---|---|
| `public/manifest.json`, `panel.html`, `compare.html`, `vite.config.ts` | Extension shell and build |
| `src/background.ts` | Icon click: open panel, record request |
| `src/types.ts` | Listing data model |
| `src/scoring/{types,config,damage,price,km,description,score}.ts` | Scoring |
| `src/storage/listings.ts` | Saved listings |
| `src/draft/draft.ts` | Editable draft and re-read merge |
| `src/read/{request,readTab,latest}.ts` | Click-to-HTML flow |
| `src/extract/extract.ts` | Document to listing data |
| `src/ui/{strings,parse}.ts`, `src/ui/panel/*`, `src/ui/compare/*` | Turkish UI |
| `tests/` | Vitest tests, one file per unit; `tests/helpers.ts` shared factories |

Every task ends with `npm test && npm run typecheck` passing, then a commit of that task's files.

---

### Task 1: Scaffold and prove tab access

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `public/manifest.json`, `panel.html`, `compare.html`, `src/background.ts`, `src/read/request.ts`, `src/ui/panel/main.tsx` (temporary probe), `src/ui/compare/main.tsx` (empty page)
- Test: `tests/manifest.test.ts`

**Interfaces:**
- Produces: scripts `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `build` (`vite build`) writing `dist/`.
- Produces in `src/read/request.ts`: `interface ReadRequest { windowId: number; tabId: number; at: number }`, `requestKey(windowId: number): string` returning `` `readRequest:${windowId}` ``.

- [ ] **Step 1:** `git init`; `.gitignore` lists `node_modules/`, `dist/`, `fixtures/`. Create `package.json` with `"type": "module"` and the three scripts. Install `react@^19 react-dom@^19` and, as dev dependencies, `typescript@^7 vite@^8 @vitejs/plugin-react@^6 vitest@^5 jsdom@^31 @types/jsdom @types/chrome @types/react@^19 @types/react-dom@^19 @types/node`. `tsconfig.json`: `strict`, `noEmit`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `resolveJsonModule`, `types: ["chrome", "vite/client", "node"]`, include `src`, `tests`, `vite.config.ts`.

- [ ] **Step 2: Write the failing test**

```ts
import manifest from '../public/manifest.json';

test('manifest asks for exactly the agreed access', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage', 'sidePanel']);
  expect(manifest.minimum_chrome_version).toBe('116');
  for (const key of ['host_permissions', 'optional_permissions', 'optional_host_permissions',
    'content_scripts', 'web_accessible_resources', 'externally_connectable']) {
    expect(manifest).not.toHaveProperty(key);
  }
});
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL, manifest not found.
- [ ] **Step 4:** Create the manifest: name `Araç Skoru`, version `0.1.0`, `"action": {"default_title": "İlanı oku"}`, `"background": {"service_worker": "background.js", "type": "module"}`, `"side_panel": {"default_path": "panel.html"}`, plus the tested keys.
- [ ] **Step 5:** `vite.config.ts` (`defineConfig` from `vitest/config`, `test.globals: true`; add `vitest/globals` to the tsconfig `types`): React plugin; `build.modulePreload.polyfill: false` (the polyfill calls `fetch`); `build.rolldownOptions.input` = `panel.html`, `compare.html`, `background: 'src/background.ts'`; `output.entryFileNames` gives `background.js` for the background chunk and `assets/[name]-[hash].js` otherwise.
- [ ] **Step 6:** Write `src/background.ts`. `open` must come first, with no `await` before it, or Chrome rejects it:

```ts
import { requestKey, type ReadRequest } from './read/request';

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  void chrome.sidePanel.open({ windowId: tab.windowId });
  const request: ReadRequest = { windowId: tab.windowId, tabId: tab.id, at: Date.now() };
  void chrome.storage.session.set({ [requestKey(tab.windowId)]: request });
});
```

- [ ] **Step 7:** Temporary probe panel: a **Probe** button that takes the window's active tab (`chrome.tabs.query({ active: true, currentWindow: true })`), runs `executeScript` returning `document.documentElement.outerHTML.length`, and prints the tab URL, the length, or the error text.
- [ ] **Step 8:** Run `npm test && npm run typecheck && npm run build`. Expected: PASS; `dist/` has `manifest.json`, `background.js`, `panel.html`, `compare.html`.
- [ ] **Step 9: STOP. Owner checks in real Chrome** (`chrome://extensions` → Developer mode → Load unpacked → `dist/`). Record each result:

| # | Action | Expected |
|---|---|---|
| a | On `https://example.com`, click the icon, press Probe | Panel opens; URL and length shown |
| b | Same tab, go to `https://example.com/foo`, press Probe | Works |
| c | Same tab, go to `https://www.iana.org`, press Probe | Error, no URL |
| d | Click the icon again, press Probe | Works |
| e | Open another site in a new tab, press Probe without clicking the icon | Error |

If **a** or **d** fails, stop and tell the owner. Do not add permissions. If **b** differs, record it and tell the owner what it means for **Tekrar oku**.

- [ ] **Step 10:** Commit: `chore: scaffold extension and prove side panel tab access`.

---

### Task 2: Data model, config, km and damage scoring

**Files:**
- Create: `src/types.ts`, `src/scoring/types.ts`, `src/scoring/config.ts`, `src/scoring/km.ts`, `src/scoring/damage.ts`, `tests/helpers.ts`
- Test: `tests/km.test.ts`, `tests/damage.test.ts`

**Interfaces:**
- Produces `src/types.ts`: `PartStatus`; `ListingData` = the spec's `Listing` fields from `title` through `description` (nullable as in spec section 6); `Listing extends ListingData { id: string; url: string; savedAt: string; referencePrice: number | null; editedFields: string[] }`; `PageRead extends ListingData { id: string | null; url: string }`; `Scorable = ListingData & { id: string; referencePrice: number | null }`.
- Produces `src/scoring/types.ts`:

```ts
export type SectionKey = 'damage' | 'price' | 'km' | 'description';
export type PriceBand = 'veryCheap' | 'good' | 'normal' | 'high' | 'expensive';
export type Reason =
  | { code: 'heavyDamage' }
  | { code: 'part'; part: string; status: 'localPaint' | 'painted' | 'replaced'; points: number }
  | { code: 'roofExtra'; points: number }
  | { code: 'record'; amount: number; points: number }
  | { code: 'recordUnknown'; points: number }
  | { code: 'heavyUnknown'; points: number }
  | { code: 'partsCap'; cap: number }
  | { code: 'priceBand'; band: PriceBand; diff: number; reference: number; source: 'manual' | 'median'; count: number | null }
  | { code: 'noReference'; found: number }
  | { code: 'kmPerYear'; value: number; points: number }
  | { code: 'phrase'; phrase: string; sentence: string; negated: boolean; points: number };
export type Warning = 'unknownParts' | 'recordUnknown' | 'heavyUnknown' | 'heavyDamage'
  | 'checkKm' | 'descriptionMissing' | 'noReference';
export type MissingField = 'price' | 'km' | 'year';
export interface SectionResult { points: number | null; max: number; reasons: Reason[]; warnings: Warning[] }
export interface ScoreResult {
  total: number | null; sections: Record<SectionKey, SectionResult>;
  missing: MissingField[]; warnings: Warning[];
}
```

`reasons[].points` is the points taken off (positive), except `kmPerYear.points`, which is the points earned.

- Produces `config.ts`: `interface Config`, `const config: Config`, `interface PartDef { key: string; label: string }`. Values: `weights` {damage 35, price 30, km 25, description 10}; `damage` {penalty: localPaint 1, painted 3, replaced 6; roofExtra 6; recordMax 10; recordFullRatio 0.10; unknownRecord 5; unknownHeavy 5; incompleteCap 15; parts `[]` (filled in Task 9); roofPart `'roof'`}; `price` {cheapAt -0.10; goodBelow -0.03; normalUpTo 0.03; highUpTo 0.10; points veryCheap 25, good 30, normal 22, high 12, expensive 5; minComparables 5; maxAgeDays 30; yearSpread 1}; `km` {bands `[[10000,25],[15000,21],[20000,16],[30000,9]]`; above 3; lowPerYear 3000; lowAgeOver 3}; `description` {penalty 3; phrases `['ağır hasar','pert','airbag','şasi','motor arızalı','acil']`; negators `['yok','yoktur','değil','değildir','bulunmamaktadır','bulunmuyor']`}.
- Produces: `scoreKm(l: ListingData, now: Date, cfg: Config): SectionResult`, `scoreDamage(l: ListingData, cfg: Config): SectionResult`.
- Produces `tests/helpers.ts`: `testCfg` (config with parts `roof`, `p1`…`p7`), `listing(overrides?: Partial<Listing>): Listing` — defaults: id `'1'`, price 1_000_000, year 2020, km 60_000, brand/series/model/fuel/gearbox/engine non-empty, heavyDamage false, damageRecordTL 0, all `testCfg` parts original, description `'Temiz araç.'`, non-empty title and url, referencePrice null, editedFields `[]`, savedAt `NOW` as ISO; `NOW = new Date('2026-11-27T12:00:00Z')`; `page(overrides?: Partial<Listing>): PageRead` — the same listing reduced to `PageRead` fields.

- [ ] **Step 1: Write the failing tests**

```ts
// km.test.ts — age 10 in 2026
test.each([[100_000, 25], [100_010, 21], [150_000, 21], [150_010, 16], [200_000, 16],
  [200_010, 9], [300_000, 9], [300_010, 3]])('%i km over 10 years', (km, points) => {
  expect(scoreKm(listing({ year: 2016, km }), NOW, testCfg).points).toBe(points);
});
test.each([2026, 2027])('model year %i divides by 1', (year) => {
  expect(scoreKm(listing({ year, km: 12_000 }), NOW, testCfg).points).toBe(21);
});
test('very low km warns only on cars older than 3 years', () => {
  const warns = (year: number, km: number) =>
    scoreKm(listing({ year, km }), NOW, testCfg).warnings.includes('checkKm');
  expect(warns(2022, 11_999)).toBe(true);
  expect(warns(2022, 12_000)).toBe(false);
  expect(warns(2023, 100)).toBe(false);
});
test('zero km is a value; blank km or year is not scored', () => {
  expect(scoreKm(listing({ km: 0 }), NOW, testCfg).points).toBe(25);
  expect(scoreKm(listing({ km: null }), NOW, testCfg).points).toBeNull();
  expect(scoreKm(listing({ year: null }), NOW, testCfg).points).toBeNull();
});
```

```ts
// damage.test.ts
const clean = listing().parts;
const score = (o: Partial<Listing>) => scoreDamage(listing(o), testCfg);
const withParts = (p: Record<string, PartStatus>) => score({ parts: { ...clean, ...p } }).points;
const replaced = (n: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i + 1}`, 'replaced' as const]));

test('part penalties', () => {
  expect(score({}).points).toBe(35);
  expect(withParts({ p1: 'localPaint' })).toBe(34);
  expect(withParts({ p1: 'painted' })).toBe(32);
  expect(withParts({ p1: 'replaced' })).toBe(29);
});
test('roof extra applies to painted or replaced only', () => {
  expect(withParts({ roof: 'localPaint' })).toBe(34);
  expect(withParts({ roof: 'painted' })).toBe(26);
  expect(withParts({ roof: 'replaced' })).toBe(23);
});
test('damage record scales to 10 points at 10% of price', () => {
  expect(score({ damageRecordTL: 50_000 }).points).toBe(30);
  expect(score({ damageRecordTL: 100_000 }).points).toBe(25);
  expect(score({ damageRecordTL: 300_000 }).points).toBe(25);
  expect(score({ damageRecordTL: 33_333 }).points).toBeCloseTo(31.6667, 3);
});
test('unknown record and heavy damage cost 5 each, with warnings', () => {
  expect(score({ damageRecordTL: null }).points).toBe(30);
  expect(score({ heavyDamage: null }).points).toBe(30);
  const both = score({ damageRecordTL: null, heavyDamage: null });
  expect(both.points).toBe(25);
  expect(both.warnings).toEqual(expect.arrayContaining(['recordUnknown', 'heavyUnknown']));
});
test('heavy damage is zero', () => {
  expect(score({ heavyDamage: true })).toMatchObject({ points: 0, warnings: ['heavyDamage'] });
});
test('floor, then cap at 15 when parts are incomplete', () => {
  expect(withParts(replaced(7))).toBe(0);
  expect(withParts({ p1: 'unknown' })).toBe(15);
  expect(score({ parts: { roof: 'original' } }).points).toBe(15);
  expect(withParts({ ...replaced(3), p7: 'unknown' })).toBe(15);
  expect(withParts({ ...replaced(5), p7: 'unknown' })).toBe(5);
  expect(score({ parts: {} }).warnings).toContain('unknownParts');
});
test('an empty configured part list never counts as complete', () => {
  const cfg = { ...config, damage: { ...config.damage, parts: [] } };
  expect(scoreDamage(listing(), cfg).points).toBe(15);
});
test('blank price blocks damage only when the record needs it', () => {
  expect(score({ price: null, damageRecordTL: 5_000 }).points).toBeNull();
  expect(score({ price: null, damageRecordTL: 0 }).points).toBe(35);
  expect(score({ price: null, damageRecordTL: null }).points).toBe(30);
  expect(score({ price: null, damageRecordTL: 5_000, heavyDamage: true }).points).toBe(0);
});
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL, modules not found.
- [ ] **Step 3:** Implement the types, config, `scoreKm`, `scoreDamage` and helpers, following spec 7.1 and 7.3. A price of 0 counts as blank. A part in the configured list that is absent from `parts` is unknown.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add data model, km and damage scoring`.

---

### Task 3: Price scoring

**Files:** Create `src/scoring/price.ts`. Test `tests/price.test.ts`.

**Interfaces:**
- Consumes: Task 2 types, `config`, helpers.
- Produces: `type Reference = { value: number; source: 'manual' | 'median'; count: number | null } | { value: null; found: number }`; `findReference(target: Scorable, saved: Listing[], now: Date, cfg: Config): Reference`; `scorePrice(target: Scorable, saved: Listing[], now: Date, cfg: Config): SectionResult`.

- [ ] **Step 1: Write the failing tests**

```ts
test.each([[900_000, 25], [900_001, 30], [969_999, 30], [970_000, 22], [1_030_000, 22],
  [1_030_001, 12], [1_100_000, 12], [1_100_001, 5]])('price %i against 1,000,000', (price, points) => {
  const t = listing({ price, referencePrice: 1_000_000 });
  expect(scorePrice(t, [], NOW, testCfg).points).toBe(points);
});

const pool = (prices: number[], o: Partial<Listing> = {}) =>
  prices.map((price, i) => listing({ id: `s${i}`, price, ...o }));
const five = [800_000, 900_000, 1_000_000, 1_100_000, 1_200_000];

test('median of five; even count averages the middle two', () => {
  expect(findReference(listing(), pool(five), NOW, testCfg)).toEqual({ value: 1_000_000, source: 'median', count: 5 });
  expect(findReference(listing(), pool([...five, 1_300_000]), NOW, testCfg)).toMatchObject({ value: 1_050_000, count: 6 });
});
test('four are not enough', () => {
  const r = scorePrice(listing(), pool(five.slice(1)), NOW, testCfg);
  expect(r).toMatchObject({ points: null, warnings: ['noReference'], reasons: [{ code: 'noReference', found: 4 }] });
});
test('manual reference wins; zero is ignored', () => {
  expect(findReference(listing({ referencePrice: 500_000 }), pool(five), NOW, testCfg)).toMatchObject({ value: 500_000, source: 'manual' });
  expect(findReference(listing({ referencePrice: 0 }), pool(five), NOW, testCfg)).toMatchObject({ source: 'median' });
});
test.each<[string, Partial<Listing>]>([
  ['brand', { brand: 'x' }], ['series', { series: 'x' }], ['model', { model: 'x' }],
  ['engine', { engine: 'x' }], ['fuel', { fuel: 'x' }], ['gearbox', { gearbox: 'x' }],
  ['year 2 apart', { year: 2022 }], ['older than 30 days', { savedAt: '2026-10-27T12:00:00Z' }],
  ['no price', { price: null }], ['heavy damage', { heavyDamage: true }],
])('excludes a different %s', (_, o) => {
  const saved = [...pool(five.slice(1)), listing({ id: 'odd', ...o })];
  expect(findReference(listing(), saved, NOW, testCfg)).toMatchObject({ value: null, found: 4 });
});
test('includes year ±1, exactly 30 days, and Turkish case differences; excludes itself', () => {
  const t = listing({ model: 'İkinci' });
  const saved = pool(five, { model: ' ikinci ', year: 2021, savedAt: '2026-10-28T12:00:00Z' });
  expect(findReference(t, [...saved, t], NOW, testCfg)).toMatchObject({ count: 5 });
});
test('blank match fields never match', () => {
  expect(findReference(listing({ engine: null }), pool(five, { engine: null }), NOW, testCfg)).toMatchObject({ value: null, found: 0 });
});
test('blank price gives no price score and no insufficient-data warning', () => {
  expect(scorePrice(listing({ price: null }), pool(five), NOW, testCfg)).toMatchObject({ points: null, warnings: [] });
});
```

- [ ] **Step 2:** Run `npm test -- price`. Expected: FAIL.
- [ ] **Step 3:** Implement per spec 7.2. Compare text with `trim().toLocaleLowerCase('tr-TR')`. `priceBand.diff` is the raw ratio.
- [ ] **Step 4:** Run `npm test -- price`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add price scoring`.

---

### Task 4: Description scoring

**Files:** Create `src/scoring/description.ts`. Test `tests/description.test.ts`.

**Interfaces:**
- Produces: `scoreDescription(text: string | null, cfg: Config): SectionResult`; one `phrase` reason per match.

- [ ] **Step 1: Write the failing tests**

```ts
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
])('%s → %i', (text, points) => expect(run(text).points).toBe(points));

test('every match shows its sentence, negated ones uncounted', () => {
  expect(run('1.6 motor, 85.000 km, pert kaydı yoktur. Temiz.').reasons).toEqual([
    { code: 'phrase', phrase: 'pert', sentence: '1.6 motor, 85.000 km, pert kaydı yoktur', negated: true, points: 0 },
  ]);
});
test('a repeated phrase is charged once', () => {
  expect(run('Acil. Acil.').reasons.map((r) => r.code === 'phrase' && r.points)).toEqual([3, 0]);
});
test.each([null, '', '   '])('blank description %j is left out', (text) => {
  expect(run(text)).toMatchObject({ points: null, warnings: ['descriptionMissing'] });
});
```

- [ ] **Step 2:** Run `npm test -- description`. Expected: FAIL.
- [ ] **Step 3:** Implement per spec 7.4. The splitting and folding decide correctness:

```ts
// '.' and ',' between digits are number formatting, not boundaries.
const SENTENCE = /(?<!\d)\.|\.(?!\d)|[!?\n]+/;
const CLAUSE = /;|(?<!\d),|,(?!\d)/;
// Fold both Turkish i letters so "ACIL", "ACİL" and "acil" match.
const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');
```

Fold phrases and negators too. A phrase matches after `(?<![\p{L}\p{N}])` with `\s+` for its spaces (flag `u`); a negator is a whole word, between `\p{L}` boundaries, after the match in the same clause. `sentence` is the trimmed original text.

- [ ] **Step 4:** Run `npm test -- description`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add description scoring`.

---

### Task 5: Total score

**Files:** Create `src/scoring/score.ts`. Test `tests/score.test.ts`.

**Interfaces:**
- Consumes: Tasks 2–4 section functions.
- Produces: `scoreListing(target: Scorable, saved: Listing[], now: Date, cfg: Config = config): ScoreResult`.

- [ ] **Step 1: Write the failing tests**

```ts
const run = (o: Partial<Listing>) => scoreListing(listing(o), [], NOW, testCfg);
test('rescales when price is left out', () => {
  const r = run({ year: 2020, km: 78_000, damageRecordTL: null, description: 'Acil.' });
  expect([r.sections.damage.points, r.sections.price.points, r.sections.km.points, r.sections.description.points])
    .toEqual([30, null, 21, 7]);
  expect(r.total).toBe(83);
});
test('all four sections', () => {
  expect(run({ referencePrice: 1_000_000 }).total).toBe(92); // 35 + 22 + 25 + 10
});
test('rescales when the description is left out', () => {
  expect(run({ referencePrice: 1_000_000, description: null }).total).toBe(91); // 82 / 90
});
test.each<[MissingField, Partial<Listing>]>([['price', { price: null }], ['price', { price: 0 }], ['km', { km: null }], ['year', { year: null }]])(
  'no total without %s', (field, o) => {
    const r = run(o);
    expect(r.total).toBeNull();
    expect(r.missing).toEqual([field]);
    expect(r.sections.description.points).toBe(10);
  });
test('heavy damage zeroes only damage and surfaces the warning', () => {
  const r = run({ heavyDamage: true, referencePrice: 1_000_000 });
  expect(r.total).toBe(57);
  expect(r.warnings).toContain('heavyDamage');
});
```

- [ ] **Step 2:** Run `npm test -- score`. Expected: FAIL.
- [ ] **Step 3:** Implement per spec 7.5. `warnings` is the de-duplicated union of section warnings.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add total score`.

---

### Task 6: Listing storage

**Files:** Create `src/storage/listings.ts`. Test `tests/storage.test.ts`.

**Interfaces:**
- Produces: `interface StorageArea { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> }`; `STORE_KEY = 'usedCarScorer'`; stored shape `{ version: 1, listings: Record<string, Listing> }`; `class StorageDataError extends Error`; `createListingStore(area: StorageArea): { getAll(): Promise<Listing[]>; save(l: Listing): Promise<void>; remove(id: string): Promise<void> }`.

- [ ] **Step 1: Write the failing tests** (with an in-memory `fakeArea(initial)` exposing `data`)

```ts
test('same id updates, newest first, remove deletes', async () => {
  const store = createListingStore(fakeArea());
  await store.save(listing({ id: '1', savedAt: '2026-11-01T00:00:00Z' }));
  await store.save(listing({ id: '2', savedAt: '2026-11-02T00:00:00Z' }));
  await store.save(listing({ id: ' 1 ', price: 900_000, savedAt: '2026-11-03T00:00:00Z' }));
  expect((await store.getAll()).map((l) => [l.id, l.price])).toEqual([['1', 900_000], ['2', 1_000_000]]);
  await store.remove('1');
  expect((await store.getAll()).map((l) => l.id)).toEqual(['2']);
});
test('concurrent saves keep both', async () => {
  const store = createListingStore(fakeArea());
  await Promise.all([store.save(listing({ id: 'a' })), store.save(listing({ id: 'b' }))]);
  expect(await store.getAll()).toHaveLength(2);
});
test('a blank id is rejected', async () => {
  await expect(createListingStore(fakeArea()).save(listing({ id: '  ' }))).rejects.toThrow();
});
test.each([{ version: 2, listings: {} }, { version: 1, listings: null }, 'junk'])(
  'unreadable data %j is reported and left untouched', async (bad) => {
    const area = fakeArea({ [STORE_KEY]: bad });
    const store = createListingStore(area);
    await expect(store.getAll()).rejects.toThrow(StorageDataError);
    await expect(store.save(listing())).rejects.toThrow(StorageDataError);
    await expect(store.remove('1')).rejects.toThrow(StorageDataError);
    expect(area.data[STORE_KEY]).toEqual(bad);
  });
test('a failed write rejects and does not block later writes', async () => {
  const area = fakeArea();
  const set = area.set;
  area.set = async () => { area.set = set; throw new Error('quota'); };
  const store = createListingStore(area);
  await expect(store.save(listing({ id: 'a' }))).rejects.toThrow('quota');
  await store.save(listing({ id: 'b' }));
  expect(await store.getAll()).toHaveLength(1);
});
```

- [ ] **Step 2:** Run `npm test -- storage`. Expected: FAIL.
- [ ] **Step 3:** Implement; chain writes on one promise so read-modify-write cannot interleave. A missing key means an empty store.
- [ ] **Step 4:** Run `npm test -- storage`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add listing storage`.

---

### Task 7: Draft and re-read merge

**Files:** Create `src/draft/draft.ts`. Test `tests/draft.test.ts`.

**Interfaces:**
- Produces:

```ts
export type FieldKey = Exclude<keyof ListingData, 'parts'> | 'id' | 'referencePrice';
export type EditKey = FieldKey | `parts.${string}`;
export interface Draft {
  listing: Omit<Listing, 'savedAt'>; savedAt: string | null; fromPage: boolean;
  pageValues: Partial<Record<EditKey, unknown>>; dirty: boolean;
}
draftFromPage(page: PageRead, saved: Listing | undefined): Draft
draftFromSaved(saved: Listing): Draft
emptyDraft(url: string): Draft
editField<K extends FieldKey>(d: Draft, key: K, value: Listing[K]): Draft
editPart(d: Draft, part: string, status: PartStatus): Draft
takePageValue(d: Draft, key: EditKey): Draft
toListing(d: Draft, now: Date): Listing
```

A new draft from a blank page id has `listing.id === ''`. Edits add the key to `editedFields` once and set `dirty`.

- [ ] **Step 1: Write the failing tests** (using `page` from the helpers)

```ts
const saved = listing({ damageRecordTL: 5_000, price: 950_000, engine: '1.6', referencePrice: 990_000,
  editedFields: ['damageRecordTL', 'parts.p1'], parts: { ...listing().parts, p1: 'painted' } });

test('typed values survive a re-read and show the page value', () => {
  const d = draftFromPage(page({ damageRecordTL: 7_000, price: 900_000 }), saved);
  expect(d.listing.damageRecordTL).toBe(5_000);
  expect(d.listing.parts.p1).toBe('painted');
  expect(d.pageValues).toEqual({ damageRecordTL: 7_000, 'parts.p1': 'original' });
  expect(d.listing.price).toBe(900_000);
});
test('a value the page no longer states keeps the saved one', () => {
  const d = draftFromPage(page({ engine: null, damageRecordTL: null, parts: { p2: 'unknown' } }), saved);
  expect(d.listing.engine).toBe('1.6');
  expect(d.listing.parts.p2).toBe('original');
  expect(d.listing.referencePrice).toBe(990_000);
  expect(d.pageValues).toEqual({});
});
test('a field the owner cleared stays cleared', () => {
  const d = draftFromPage(page({ km: 5 }), listing({ km: null, editedFields: ['km'] }));
  expect(d.listing.km).toBeNull();
});
test('taking the page value forgets the edit', () => {
  const d = takePageValue(draftFromPage(page({ damageRecordTL: 7_000 }), saved), 'damageRecordTL');
  expect(d.listing.damageRecordTL).toBe(7_000);
  expect(d.listing.editedFields).toEqual(['parts.p1']);
  expect(d.dirty).toBe(true);
});
test('savedAt refreshes only for page reads', () => {
  const old = listing({ savedAt: '2026-01-01T00:00:00.000Z' });
  expect(toListing(editField(draftFromSaved(old), 'km', 1), NOW).savedAt).toBe(old.savedAt);
  expect(toListing(draftFromPage(page({}), old), NOW).savedAt).toBe(NOW.toISOString());
  expect(toListing(emptyDraft('u'), NOW).savedAt).toBe(NOW.toISOString());
});
test('editing marks the draft dirty once per key', () => {
  const d = editPart(editPart(emptyDraft('u'), 'roof', 'painted'), 'roof', 'replaced');
  expect(d.listing.editedFields).toEqual(['parts.roof']);
  expect(d.dirty).toBe(true);
});
```

- [ ] **Step 2:** Run `npm test -- draft`. Expected: FAIL.
- [ ] **Step 3:** Implement per spec 5.4. All functions return new objects. `pageValues` records only stated page values that differ from the kept value. `url` always comes from the page.
- [ ] **Step 4:** Run `npm test -- draft`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add editable draft with re-read merge`.

---

### Task 8: Click-to-HTML flow

**Files:** Modify `src/read/request.ts`. Create `src/read/readTab.ts`, `src/read/latest.ts`. Test `tests/read.test.ts`.

**Interfaces:**
- Produces: `MAX_REQUEST_AGE_MS = 10_000`; `takeReadRequest(area: { get(key: string): Promise<Record<string, unknown>>; remove(key: string): Promise<void> }, windowId: number, now: number): Promise<ReadRequest | null>`.
- Produces: `type ReadOutcome = { kind: 'ok'; html: string; url: string } | { kind: 'notSahibinden' } | { kind: 'noAccess' }`; `interface TabApi { getUrl(tabId: number): Promise<string | undefined>; copyPage(tabId: number): Promise<{ html: string; url: string }> }`; `chromeTabApi: TabApi`; `isSahibindenUrl(url: string): boolean`; `readTab(tabId: number, api: TabApi): Promise<ReadOutcome>`.
- Produces: `createSequence(): () => () => boolean` — each call starts a run and returns `isCurrent()`.

- [ ] **Step 1: Write the failing tests** (`fakeSession(initial)`: in-memory `get`/`remove` exposing `data`)

```ts
test.each(['https://www.sahibinden.com/ilan/x', 'https://sahibinden.com/'])('reads %s', (u) => expect(isSahibindenUrl(u)).toBe(true));
test.each(['https://sahibinden.com.evil.com/', 'https://notsahibinden.com/', 'https://evil.com/?u=sahibinden.com',
  'https://sahibinden.com@evil.com/', 'file:///sahibinden.com', 'junk'])('refuses %s', (u) => expect(isSahibindenUrl(u)).toBe(false));

const api = (url: string | undefined, page = { html: '<p>', url: url! }) =>
  ({ getUrl: vi.fn(async () => url), copyPage: vi.fn(async () => page) });
test('never injects elsewhere or without a visible URL', async () => {
  const other = api('https://example.com');
  expect(await readTab(1, other)).toEqual({ kind: 'notSahibinden' });
  const hidden = api(undefined);
  expect(await readTab(1, hidden)).toEqual({ kind: 'noAccess' });
  expect([...other.copyPage.mock.calls, ...hidden.copyPage.mock.calls]).toHaveLength(0);
});
test('reads, rechecks the returned URL, and maps injection errors', async () => {
  const url = 'https://www.sahibinden.com/ilan/x';
  expect(await readTab(1, api(url))).toEqual({ kind: 'ok', html: '<p>', url });
  expect(await readTab(1, api(url, { html: '', url: 'https://example.com' }))).toEqual({ kind: 'notSahibinden' });
  const broken = { getUrl: async () => url, copyPage: async () => { throw new Error('x'); } };
  expect(await readTab(1, broken)).toEqual({ kind: 'noAccess' });
});
test('a request is taken once and expires', async () => {
  const make = (at: number) => fakeSession({ [requestKey(7)]: { windowId: 7, tabId: 3, at } });
  const area = make(1_000);
  expect(await takeReadRequest(area, 7, 2_000)).toMatchObject({ tabId: 3 });
  expect(await takeReadRequest(area, 7, 2_000)).toBeNull();
  const old = make(1_000);
  expect(await takeReadRequest(old, 7, 11_001)).toBeNull();
  expect(old.data).toEqual({});
  expect(await takeReadRequest(make(1_000), 8, 2_000)).toBeNull();
});
test('only the newest run is current', () => {
  const begin = createSequence();
  const first = begin(); const second = begin();
  expect([first(), second()]).toEqual([false, true]);
});
```

- [ ] **Step 2:** Run `npm test -- read`. Expected: FAIL.
- [ ] **Step 3:** Implement. Protocol must be `http:` or `https:`; host `sahibinden.com` or ending `.sahibinden.com`. `copyPage` runs `executeScript` with a function returning `{ html: document.documentElement.outerHTML, url: location.href }`.
- [ ] **Step 4:** Run `npm test -- read`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add tab reading flow`.

---

### Task 9: Extractor from saved pages

**Needs the owner's files.** Tasks 1–8 do not; stop here if they are missing.

**Files:** Create `src/extract/extract.ts`, `fixtures/*.html`, `fixtures/*.expected.json` (ignored by git). Modify `src/scoring/config.ts` (part list). Test `tests/extract.test.ts`.

**Interfaces:**
- Produces: `type ExtractNotice = 'foreignCurrency'`; `interface ExtractResult { read: PageRead; recognised: boolean; notices: ExtractNotice[] }`; `extract(doc: Document, url: string): ExtractResult`. `recognised` = `id` is set and at least one of `price`, `year`, `km` is set.

- [ ] **Step 1: STOP. Ask the owner** for 3–5 listing pages saved with Ctrl/Cmd+S into `fixtures/`, including one with painted or replaced parts and one with missing information. Never fetch them yourself.
- [ ] **Step 2:** Replace every seller name, phone number, and the owner's own name and email with `XXX`. Verify with a search for each replaced string and for phone patterns `(\+?90|0)?\s*\(?5\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}`; review every hit. Expected: no personal data left.
- [ ] **Step 3:** For each page, write `<name>.expected.json` (`{ url, result: ExtractResult }`) from what the page visibly says, not from extractor output. Record where each field and part status lives.
- [ ] **Step 4: Ask the owner** wherever the pages leave something open: how an unmarked part should read (spec section 6), a field that is absent (such as engine or damage record), or part status visible only through styling (approach A's limit). Do not proceed on a guess.
- [ ] **Step 5: Write the failing tests**

```ts
const dir = join(__dirname, '../fixtures');
const pages = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')) : [];
const parse = (html: string) => new JSDOM(html).window.document;
if (!pages.length) console.warn('SKIPPED: fixtures/ is empty, the extractor is not verified');

describe.skipIf(!pages.length)('saved pages', () => {
  test.each(pages)('%s', (file) => {
    const expected = JSON.parse(readFileSync(join(dir, file.replace(/html$/, 'expected.json')), 'utf8'));
    const doc = parse(readFileSync(join(dir, file), 'utf8'));
    expect(extract(doc, expected.url)).toEqual(expected.result);
  });
});
test('a bot check or unrelated page yields nothing, never clean values', () => {
  const r = extract(parse('<html><body>Güvenlik kontrolü</body></html>'), 'https://www.sahibinden.com/x');
  expect(r.recognised).toBe(false);
  const { url, parts, ...fields } = r.read;
  expect(Object.values(fields).every((v) => v === null)).toBe(true);
  expect(Object.values(parts).every((s) => s === 'unknown')).toBe(true);
});
```

Add one test that takes a fixture, replaces its price currency text with `USD`, and asserts `price === null` and `notices` equals `['foreignCurrency']`. Add a test that `config.damage.parts` contains `config.damage.roofPart` and that every part key in every expected file is in the list.

- [ ] **Step 6:** Run `npm test -- extract`. Expected: FAIL, and no skip warning.
- [ ] **Step 7:** Fill `config.damage.parts` with keys and Turkish labels from the pages (roof key `roof`). Implement `extract`. Use only DOM APIs that work on a detached document (`textContent`, no `innerText`, styles or layout). `parts` holds every configured key. Do not read the damage record from the description. A price of 0 or a non-TL price is `null`.
- [ ] **Step 8:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 9:** Check `git status` shows nothing from `fixtures/`. Commit: `feat: extract listing data from saved page structure`.

---

### Task 10: Panel logic and input parsing

**Files:** Create `src/ui/parse.ts`, `src/ui/panel/panelState.ts`. Test `tests/parse.test.ts`, `tests/panelState.test.ts`.

**Interfaces:**
- Consumes: `Draft` functions (Task 7), `ExtractResult` (Task 9).
- Produces: `parseWholeNumber(text: string): { ok: true; value: number | null } | { ok: false }`.
- Produces:

```ts
export type ReadResult = ({ kind: 'page' } & ExtractResult) | { kind: 'notSahibinden' } | { kind: 'noAccess' };
export type Incoming = ({ kind: 'page' } & ExtractResult) | { kind: 'saved'; listing: Listing };
export type Notice = 'unreadable' | 'notSahibinden' | 'noAccess' | 'foreignCurrency';
export interface PanelState { draft: Draft | null; pending: Incoming | null; notices: Notice[]; revision: number }
export const initialState: PanelState;
receive(s: PanelState, r: ReadResult | Incoming, saved: Listing[]): PanelState
discardAndReplace(s: PanelState, saved: Listing[]): PanelState
keepCurrent(s: PanelState): PanelState
afterSave(s: PanelState, saved: Listing[]): PanelState   // saved already includes the new entry
```

`revision` increases whenever `draft` is replaced.

- [ ] **Step 1: Write the failing tests**

```ts
test.each([['', null], ['  ', null], ['0', 0], ['1250000', 1_250_000], ['1.250.000', 1_250_000],
  ['1 250 000', 1_250_000], ['85.000 km', 85_000], ['750.000 TL', 750_000]])('%j', (t, value) =>
  expect(parseWholeNumber(t)).toEqual({ ok: true, value }));
test.each(['abc', '12,5', '-5', '1.5', '12.50', '1..000'])('rejects %j', (t) =>
  expect(parseWholeNumber(t)).toEqual({ ok: false }));
```

```ts
const incoming = (o: Partial<Listing> = {}, recognised = true) =>
  ({ kind: 'page' as const, read: page(o), recognised, notices: [] });
const dirty = () => {
  const s = receive(initialState, incoming(), []);
  return { ...s, draft: editField(s.draft!, 'damageRecordTL', 5_000) };
};
test('a read over unsaved edits waits', () => {
  const s = receive(dirty(), incoming({ id: '2' }), []);
  expect(s.draft!.listing.id).toBe('1');
  expect(s.pending).not.toBeNull();
  expect(discardAndReplace(s, []).draft!.listing.id).toBe('2');
  expect(keepCurrent(s)).toMatchObject({ pending: null, draft: s.draft });
});
test('saving first, then re-reading the same listing, keeps the typed value', () => {
  const s = receive(dirty(), incoming(), []);
  const stored = [toListing(s.draft!, NOW)];
  expect(afterSave(s, stored).draft!.listing.damageRecordTL).toBe(5_000);
});
test('a failed read keeps the draft and shows why', () => {
  const s = receive(dirty(), { kind: 'noAccess' }, []);
  expect(s.draft).toEqual(dirty().draft);
  expect(s.notices).toEqual(['noAccess']);
});
test('an unreadable page gives an empty form with its URL', () => {
  const s = receive(initialState, incoming({}, false), []);
  expect(s.notices).toContain('unreadable');
  expect(s.draft!.listing).toMatchObject({ id: '', price: null, url: page({}).url });
});
test('opening a saved listing also respects unsaved edits', () => {
  expect(receive(dirty(), { kind: 'saved', listing: listing({ id: '9' }) }, []).pending).not.toBeNull();
});
```

- [ ] **Step 2:** Run `npm test -- parse panelState`. Expected: FAIL.
- [ ] **Step 3:** Implement. Accepted numbers: plain digits, or digits grouped in threes by `.` or space, with an optional trailing `TL` or `km`. Build the draft when it is shown, not when it arrives, so it merges with the latest saved data.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: add panel state and number parsing`.

---

### Task 11: Side panel UI

**Files:** Create `src/ui/strings.ts`, `src/ui/panel/{App,ScoreCard,ListingForm,ReplacePrompt,SavedList}.tsx`, `src/ui/panel/panel.css`, `src/ui/useListings.ts`. Replace `src/ui/panel/main.tsx`. Test `tests/strings.test.ts`.

**Interfaces:**
- Consumes: `scoreListing`, `createListingStore(chrome.storage.local)`, `takeReadRequest`, `readTab`, `createSequence`, `extract`, `panelState`, `parseWholeNumber`.
- Produces: `reasonText(r: Reason, partLabel: (key: string) => string): string`, `warningText(w: Warning): string`, `strings` (all other copy); `useListings(): { listings: Listing[]; error: string | null; save(l: Listing): Promise<void>; remove(id: string): Promise<void> }`, reloading on `chrome.storage.onChanged`; `compareUrl(ids: string[]): string` in `src/ui/compare/url.ts`, returning `compare.html?ids=` with encoded ids joined by commas.

Fixed copy (exact): tabs `İlan`, `Kayıtlılar`; buttons `Kaydet`, `Tekrar oku`, `Karşılaştır`, `Sil`; `Referans fiyat`; `yetersiz veri`; bands `Çok ucuz, nedenini kontrol et`, `İyi fiyat`, `Normal`, `Biraz pahalı`, `Pahalı`; `Eklenti simgesine tıklayın`; `İlan okunamadı`; `Bu sayfa sahibinden.com değil`; `Kaydedilmemiş değişiklikler var` with `Kaydet` / `Vazgeç ve değiştir` / `Burada kal`; part states `Orijinal`, `Lokal boyalı`, `Boyalı`, `Değişen`, `Bilinmiyor`; heavy damage `Evet`, `Hayır`, `Bilinmiyor`; `Kilometreyi kontrol edin`; `Fiyatlar satış fiyatı değil, ilanda istenen fiyatlardır.`; `Geçersiz sayı`.

- [ ] **Step 1: Write the failing tests**

```ts
const price = (band: PriceBand) => reasonText({ code: 'priceBand', band, diff: 0, reference: 1, source: 'manual', count: null }, String);
test('fixed price labels', () => {
  expect(price('veryCheap')).toContain('Çok ucuz, nedenini kontrol et');
  expect(price('good')).toContain('İyi fiyat');
});
test('a median names its sample size; no reference says so', () => {
  expect(reasonText({ code: 'priceBand', band: 'normal', diff: 0, reference: 1_000_000, source: 'median', count: 6 }, String)).toContain('6 ilan');
  expect(reasonText({ code: 'noReference', found: 2 }, String)).toContain('yetersiz veri');
});
test('a description match quotes its sentence and marks negation', () => {
  const text = reasonText({ code: 'phrase', phrase: 'pert', sentence: 'Pert yoktur', negated: true, points: 0 }, String);
  expect(text).toContain('Pert yoktur');
  expect(text).toContain('sayılmadı');
});
```

- [ ] **Step 2:** Run `npm test -- strings`. Expected: FAIL.
- [ ] **Step 3:** Implement `strings.ts` with exhaustive switches over `Reason['code']` and `Warning`. Run the test: PASS.
- [ ] **Step 4:** Build the components to the spec 5.2 sketch:
  - `App`: on load and on `chrome.storage.session.onChanged` for its window's key, take the request, then `readTab` → `DOMParser` (`parseFromString(html, 'text/html')`) → `extract` → `receive`. Apply a result only if `isCurrent()`. **Tekrar oku** does the same for the active tab. Nothing reads on tab switch or navigation. With no draft, show `İlanı okumak için eklenti simgesine tıklayın`.
  - `ScoreCard`: total (or the missing field names), warnings (heavy damage first and prominent), four expandable sections with reasons, one decimal at most, and the asking-price note.
  - `ListingForm` (keyed by `revision`): listing number, every field, parts, referencePrice. Number fields keep their raw text, call `editField` only when it parses (price and referencePrice: 0 → null; year: four digits), and otherwise show `Geçersiz sayı`. Unknown fields are highlighted. Differing page values show beside the field with a button calling `takePageValue`. **Kaydet** is disabled while the number is blank or any field is invalid. A successful save calls `afterSave`; a storage error is shown and the draft stays dirty.
  - `SavedList`: title, price, live total; open (`receive` with `kind: 'saved'`, then switch to **İlan**); delete after `confirm`; checkboxes; **Karşılaştır** enabled at 2+, calling `chrome.tabs.create({ url: chrome.runtime.getURL(compareUrl(ids)) })`.
  - Listing text is rendered as React text only.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run build`. Expected: PASS.
- [ ] **Step 6:** Owner reloads the extension and checks: icon on a non-sahibinden page shows the message; the form can be filled by hand and saved; the entry appears under **Kayıtlılar** and survives closing the panel; unsaved edits prompt before a new read. Record results.
- [ ] **Step 7:** Commit: `feat: add side panel review, scoring and saved list`.

---

### Task 12: Compare tab

**Files:** Create `src/ui/compare/rows.ts`, `src/ui/compare/CompareApp.tsx`, `src/ui/compare/compare.css`. Modify `src/ui/compare/main.tsx`, `src/ui/compare/url.ts`. Test `tests/compare.test.ts`.

**Interfaces:**
- Consumes: `scoreListing`, `useListings`, `isSahibindenUrl`, `compareUrl`.
- Produces: `parseIds(search: string): string[]` in `url.ts`; `interface Column { id: string; title: string; url: string; total: number | null; isBest: boolean; excluded: SectionKey[] }`; `interface Row { label: string; cells: string[] }`; `buildComparison(ids: string[], saved: Listing[], now: Date, cfg?: Config): { columns: Column[]; rows: Row[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
test('ids survive the round trip', () => {
  expect(parseIds(new URL(compareUrl(['1', 'a,b']), 'https://x/').search)).toEqual(['1', 'a,b']);
});
const saved = [listing({ id: 'a', referencePrice: 1_000_000 }), listing({ id: 'b', km: 250_000 }), listing({ id: 'c', km: null })];
test('columns follow the ids, skip deleted ones, mark the best and the left-out sections', () => {
  const { columns, rows } = buildComparison(['b', 'gone', 'a', 'c'], saved, NOW, testCfg);
  expect(columns.map((c) => [c.id, c.isBest])).toEqual([['b', false], ['a', true], ['c', false]]);
  expect(columns[0].excluded).toEqual(['price']);
  expect(columns[2].total).toBeNull();
  expect(rows.every((r) => r.cells.length === 3)).toBe(true);
});
test('ties are all best', () => {
  const two = [listing({ id: 'a' }), listing({ id: 'b' })];
  expect(buildComparison(['a', 'b'], two, NOW, testCfg).columns.map((c) => c.isBest)).toEqual([true, true]);
});
```

- [ ] **Step 2:** Run `npm test -- compare`. Expected: FAIL.
- [ ] **Step 3:** Implement. Rows, in the order of spec 5.3, with Turkish labels from `strings`; blank values show `—`. The median uses all saved listings, not only the compared ones.
- [ ] **Step 4:** Build `CompareApp`: a horizontally scrolling table with a sticky label column; best total highlighted; left-out sections noted in the column; a link only when `isSahibindenUrl(url)`, with `target="_blank" rel="noreferrer"`; storage errors shown.
- [ ] **Step 5:** Run `npm test && npm run typecheck && npm run build`. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: add compare tab`.

---

### Task 13: Final verification

**Files:** Create `README.md` (build, load unpacked, where to edit scoring, the terms-of-service risk).

- [ ] **Step 1:** Run `npm test && npm run typecheck && npm run build`. Expected: PASS with no "SKIPPED: fixtures/" warning.
- [ ] **Step 2:** Run `grep -rnE "fetch\(|XMLHttpRequest|sendBeacon|innerHTML|dangerouslySetInnerHTML" src` — expected: no matches. Confirm `dist/manifest.json` equals `public/manifest.json`.
- [ ] **Step 3: Owner** opens one real listing and: clicks the icon, checks every field against the page, corrects one, saves, re-reads (the correction stays), saves a second listing, compares them, deletes one. Record each result; a wrong field becomes a new fixture and a failing test.
- [ ] **Step 4:** Check each line of spec section 10 and report it with its evidence.
- [ ] **Step 5:** Commit: `docs: add readme`.
