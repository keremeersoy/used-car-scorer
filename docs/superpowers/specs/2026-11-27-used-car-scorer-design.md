# Used Car Scorer: design

Date: 2026-11-27. Status: approved by the owner on 2026-11-27.

Items marked **(call)** were filled in while writing. They are not owner decisions and can be changed.

## 1. Intent

A private Chrome extension for comparing used cars on sahibinden.com. The owner opens a listing, clicks the extension icon, gets a score out of 100 with reasons, and saves the listing to compare later.

- **User:** the owner only. Not published to the Chrome Web Store.
- **Success:** scoring and saving a listing takes one or two clicks.
- **Language:** Turkish UI. English code and comments.

## 2. Goals, non-goals, anti-goals

**Goals (v1):** read the open listing, review and fix the fields, score with a breakdown, save, compare two or more, delete.

**Non-goals:** accounts, sync, mobile, AI analysis, price history, other sites, a paste-the-page-text web app, editing warning phrases in the UI, reading the damage record amount out of free text.

**Anti-goals.** The project has failed if any of these happens, even if it works:

- It sends any request to sahibinden, navigates on its own, or fetches by listing number.
- It bypasses or evades bot protection.
- It adds anything to the page.
- It treats a missing value as clean, or guesses it.
- It shows a score without saying why.
- Data leaves the machine.

## 3. Constraints

- Manifest V3, TypeScript, Vite, React, Vitest.
- Permissions are exactly `activeTab`, `scripting`, `storage`, `sidePanel`, plus one optional host permission, `https://*.sahibinden.com/*`, for automatic reading (approved by the owner). No `host_permissions`, `content_scripts`, `web_accessible_resources` or `externally_connectable`.
- `minimum_chrome_version` 116, for `sidePanel.open()` (checked against Chrome's API reference).
- No remote code, fonts, images or analytics.
- **Fixed extension id (added later):** the manifest carries a public `key`, so saved listings no longer depend on the folder. Changing it would hide everything saved. No private key exists.
- Selectors come only from pages the owner saved by hand. Never guess them or fetch the site.
- **Known risk:** the site may still detect the extension or consider it against its terms, and may restrict the account. The owner should read the terms.

## 4. Approaches

| Question | Options | Chosen | Why |
|---|---|---|---|
| How to get listing data | Server fetches by number; web app with pasted text; extension reads the open page | Extension (brief) | Server fetching is scraping and is rejected. Pasting is lower risk but more manual. The extension is one click with some account risk. |
| Where the UI lives | Popup; side panel | Side panel (owner) | Stays open while browsing and correcting. Costs the `sidePanel` permission. A popup closes on any outside click. |
| Where the reader runs | A: copy the page HTML and parse it in the panel; B: inject the extractor into the page | A (owner) | Same `extract()` in tests and in the extension, almost no code on the site, no extra bundle. It cannot see styling. If the saved pages show that part status is only visible through styling, go back to the owner about B. |
| Build tooling | Extension framework; plain Vite | Plain Vite, hand-written manifest **(call)** | Every permission is visible and checkable. |

## 5. How it works

### 5.1 Reading a listing

1. The owner clicks the toolbar icon. In `chrome.action.onClicked` the service worker calls `chrome.sidePanel.open()` immediately, before any `await`, then writes a read request (`windowId`, `tabId`, timestamp) to `chrome.storage.session`. `openPanelOnActionClick` stays off.
2. The panel picks up a request for its own window, both on load and on change. It deletes the request as it takes it, and ignores one older than 10 seconds, so reopening the panel never reads a page without a fresh click **(call)**.
3. If the tab is not on `sahibinden.com` or a subdomain, nothing is injected and the panel says so. A tab whose URL the extension cannot see counts as "no access".
4. The panel runs a tiny function with `chrome.scripting.executeScript` that returns the page HTML and URL.
5. The panel parses it with `DOMParser` and calls `extract(document, url)`. The parsed page is untrusted: only text is read from it, and none of its HTML is ever inserted into the extension's UI.

The icon click is what grants access. According to Chrome's docs the grant lasts while the tab stays on the same site, so the panel also has a **Tekrar oku** button. It reads the window's active tab, and if access is gone it asks the owner to click the icon. Nothing is read on tab switch or navigation.

**Unverified assumption:** that the grant from `action.onClicked` lets the side panel page run `executeScript`. The first build step must prove this in a real Chrome. If it fails, stop and tell the owner. Do not add host permissions.

**Automatic reading (added later, approved by the owner).** Off until the owner turns it on in the panel and grants the optional access. While it is on and the panel is open, a listing's detail page is read when it finishes loading in the active tab or when its tab becomes active. Other pages are left alone. Coming back to the listing already shown keeps it, with any typed values, unless it has no unsaved edits and the page now says something else (it was still loading, or it changed); a different listing waits if there are unsaved edits. Turning it off removes the access. This replaces "only on a click" for listing pages only.

### 5.2 Panel

Two tabs, **İlan** and **Kayıtlılar**, and the automatic reading switch. A listing is shown answer first (redesigned later at the owner's request):

1. The car: title, known facts, price, and the verdict with the score gauge. Verdict thresholds are in the config; heavy damage is always "Riskli".
2. What to watch (worst first), what is still unknown, good points.
3. What the owner may have learned from the seller: damage record, heavy damage, reference price.
4. A top view of the car for part states; choosing a panel changes its state.
5. All other fields, folded unless something needed is blank.
6. The score breakdown by section with reasons, and the asking-price note.
7. **Kaydet** stays at the bottom.

The score updates as fields are edited. Unknown values are highlighted and never praised. **Kayıtlılar** lists saved listings best first, with verdicts, selection for **Karşılaştır**, delete with confirmation, and backup.

### 5.3 Compare

A full tab (`compare.html`, listing ids in the URL), one column per listing, scrolling sideways when needed. Rows: total score, each section, price, reference price, year, km, km per year, fuel, gearbox, engine, painted and replaced parts, damage record, heavy damage, warnings, link to the listing. The highest total is highlighted. A listing with a section left out says so in its column, because its total is rescaled.

### 5.4 Saving

- `chrome.storage.local`, listings keyed by listing number, with a schema version.
- The listing number is required to save and can be typed by hand. Everything else may be blank.
- Saving an existing number updates that entry. `savedAt` is refreshed only when the draft came from a page read, so editing an old entry from the list does not make its price look current **(call)**.
- **Reading a saved listing again (call):** fields the owner typed or corrected keep the typed value, and the panel shows the page's value beside it when they differ, with a way to take the page's value. Fields never edited take the new page value, except that a value the page no longer states keeps the saved one. `referencePrice` is always kept. This needs `editedFields` in the record, tracked per part for `parts`.
- Scores are never stored. They are calculated when shown, so a saved listing's score can change as the median, the current year or the config changes **(call)**.
- **Notes (added later):** each listing can carry the owner's note (up to 2000 characters). It is never taken from the page, survives re-reads, is shown in the saved list and compare view, is part of backups, and does not affect the score.
- Storage errors are shown, never swallowed.
- A save replaces a saved entry only if it is still the one the draft started from; otherwise the owner is asked.
- **Backup (added later):** the saved list can be exported to a JSON file and restored from one. A restore checks every field, leaves out broken entries and names them, and replaces a saved entry only with one changed later (`updatedAt`, set on every write; older entries fall back to `savedAt`).

## 6. Data model

```ts
type PartStatus = 'original' | 'localPaint' | 'painted' | 'replaced' | 'unknown';

interface Listing {
  id: string;                      // listing number
  url: string;
  savedAt: string;                 // ISO date
  title: string | null;
  price: number | null;            // TL
  brand: string | null;
  series: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  gearbox: string | null;
  engine: string | null;
  heavyDamage: boolean | null;
  damageRecordTL: number | null;   // tramer; 0 = stated no record
  parts: Record<string, PartStatus>;
  description: string | null;
  referencePrice: number | null;   // entered by hand
  note?: string | null;            // the owner's own words; added later
  editedFields: string[];
}
```

A missing field is `null` or `unknown`. The brief's non-null fields became nullable so a partial read can be represented **(call)**.

All prices are in TL. If the page states another currency, `price` stays blank and the panel says why, so the owner can type a TL figure **(call)**. A price of 0 counts as blank.

A part is `original` only if the page says so, directly or through a convention that the saved pages make unambiguous. If it is ambiguous, ask the owner.

## 7. Scoring

All numbers, bands and warning phrases live in one config file. Scoring functions are pure and receive the current date.

### 7.1 Damage (35)

1. Heavy damage is **yes**: 0 points and a clear warning. Skip the rest.
2. Start at 35. Per part: local paint −1, painted −3, replaced −6. Roof painted or replaced: a further −6.
3. Damage record: `10 × min(1, (damageRecordTL / price) / 0.10)` points off.
4. Damage record unknown: −5. Heavy damage unknown: −5. (owner)
5. Floor at 0.
6. If any part on the expected list is unknown or absent, cap at 15. (owner)

Every unknown adds a warning. Example: all parts original, heavy damage "no", record unknown gives 30.

### 7.2 Price (30)

Reference: the manual `referencePrice` if entered (above 0). Otherwise the median of **similar cars in the same condition** (changed later, approved by the owner).

- Cars come from saved listings and from listings only looked at. Each listing read is remembered locally (number, address, title, brand, series, model, year, km, fuel, gearbox, price, heavy damage, parts, date; no description or seller data), one record per number, for 30 days, and can be cleared. A saved entry's corrections win; a later sight has the newer price.
- Similar: same brand, series, model, fuel and gearbox (trimmed, Turkish-locale case-insensitive; a blank value never matches), year within ±1, km within 40,000, seen in the last 30 days, has a price, not this listing, not marked heavy damage = yes. Engine is no longer matched; the model name carries it.
- Condition groups: **clean** (no replaced part, at most one painted or locally painted), **painted** (no replaced part, two or more painted), **replaced** (at least one replaced). A car with any unknown part is in no group. A heavily damaged car is compared with none.
- At least 5 cars in the car's own group are trusted; 3 or 4 are used and marked as little data; fewer give no price score.
- The panel shows all three groups with counts and medians, the cars behind them, how many remembered cars there are, why the others were left out, and which needed fields are blank on this car.

`diff = (price − reference) / reference`

| diff | points | label |
|---|---|---|
| ≤ −10% | 25 | Çok ucuz, nedenini kontrol et |
| > −10% and < −3% | 30 | İyi fiyat |
| −3% to +3% inclusive | 22 | Normal |
| > +3% and ≤ +10% | 12 | Biraz pahalı |
| > +10% | 5 | Pahalı |

The panel shows which reference was used, and for a median how many listings it came from. No reference: leave the section out and show "yetersiz veri".

### 7.3 Km (25)

`kmPerYear = km / max(1, currentYear − year)`. Up to 10,000: 25. Up to 15,000: 21. Up to 20,000: 16. Up to 30,000: 9. Above: 3. Upper bounds are inclusive. If `kmPerYear` is under 3,000 and `currentYear − year` is over 3, add "check the km".

### 7.4 Description (10)

- Start at 10, subtract 3 for each **distinct** phrase with at least one non-negated match, floor 0 **(call: distinct, not every occurrence)**.
- Default warnings: "ağır hasar", "pert", "airbag", "şasi", "motor arızalı", "acil". Other spellings belong to one warning and are charged once: "egirbek" and "airbek" for airbag, "şase" for şasi (added by the owner after real pages). Spellings typed without Turkish letters ("sasi", "agir hasar") match too.
- A part warning followed only by "yok" ("airbag yok") is unclear and counts; it needs a word saying what is absent ("airbag sorunu yok").
- Warnings joined by "ve", "veya" or "ya da" share one negation, only between bare record or part warnings (never "motor arızalı" or "acil", never "ağır hasarlı ve …"). A negator followed by "değil" or a question particle clears nothing. A list of parts written with commas stays one clause.
- A warning about a part (airbag, şasi) counts only when something wrong is said about it: a problem word within four words after it, or an adjective right before it. Equipment lists and "airbags are original" are shown as mentions and cost nothing (owner decision).
- Every match in a clause is checked; the clause is cleared only if all of them are negated. In a list of parts ("şase podye airbag hatasız") the other part names do not separate a part warning from its negator.
- Matching is Turkish-locale lowercase and must start at a word boundary that understands Turkish letters. Suffixes are allowed. Without this, "pert" would match inside "ekspertiz".
- Negation: a match is negated only when a negator follows it in the same clause with nothing but filler words in between ("pert kaydı yoktur"), so "pert kayıtlı motor sorunsuz" still counts. Negators: "yok", "yoktur", "değil", "değildir", "bulunmamaktadır", "bulunmuyor". "hatasız" and "sorunsuz" (added by the owner) clear only phrases that name a part (airbag, şasi and the airbag spellings). The word lists are in the config. Clauses end at `. ! ? ; ,` or a line break. **(tightened after the final review)** Unclear cases count against the listing.
- Every match shows its sentence, negated ones too, marked as not counted.
- Description blank or not read: leave the section out and warn.

### 7.5 Total

- Price, km or year blank: **no total**. Computable sections still show, and the panel names the missing fields. (owner) With a blank price, Damage is computable only if it needs no price: heavy damage is yes, or the damage record is 0 or unknown.
- Otherwise `round(points earned / maximum of included sections × 100)`. Only the total is rounded. Section points show at most one decimal.

## 8. Failure behaviour

| Situation | Panel shows |
|---|---|
| Not a sahibinden page | A message; nothing is injected |
| No access to the tab | "Eklenti simgesine tıklayın" |
| Page cannot be read as a listing (including a bot check) | "İlan okunamadı" and an empty form to fill by hand. No retry. |
| Some fields missing | The filled form with the gaps highlighted |

## 9. Structure, testing, build order

```
src/
  background.ts
  extract/    # pure: Document + url -> partial Listing
  scoring/    # config.ts, damage.ts, price.ts, km.ts, description.ts, total
  storage/
  ui/         # panel, compare, shared components, Turkish strings in one file (call)
public/manifest.json
fixtures/     # saved listing pages, git-ignored
tests/
```

**Tests (Vitest):** every scoring boundary and missing-data case; description negation and the "ekspertiz" case; re-read merge; storage against a fake `chrome.storage`; the manifest's exact permission list; the extractor against the fixtures. Fixture tests are skipped with a visible notice when `fixtures/` is empty, and the project is not done until they have run.

**Build order**

1. Scaffold, load unpacked, and prove the access assumption in 5.1.
2. Owner saves 3 to 5 listing pages by hand (Ctrl/Cmd+S), including one with painted or replaced parts and one with missing information.
3. Remove seller names, phone numbers and the owner's own account details from the fixtures. Then build the extractor with tests.
4. Scoring with unit tests. This can go ahead of step 3 if the pages are not ready.
5. Storage and panel: review, score, save, delete.
6. Compare tab.
7. Owner opens one real listing and tests by hand.

## 10. Done when

- A listing can be read, corrected, scored and saved.
- Every score shows why.
- A failed read shows a clear message and the fields can be filled by hand.
- Tests pass, fixture tests included, and the manifest has no permissions beyond the four above.

## 11. Left to the builder

Selectors, the part list and where each field comes from (all from the saved pages), component breakdown, visual styling, icons, test DOM library. If the pages turn out not to state something this design relies on, such as engine, ask the owner.
