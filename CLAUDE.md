# Working on this repository

## Standing instructions from the owner (2026-11-27)

For bugs and small improvements, do not ask first: find the problem, fix it, run the checks and
security scans, merge into `main`, push, and update the issues. Report what was done afterwards,
in Turkish.

Still ask before anything that changes repository visibility, GitHub account or security settings,
deletes data or branches that hold unmerged work, rewrites published history, publishes the project
anywhere else, adds a manifest permission, sends a request to sahibinden.com, or costs money.

## Process

1. Branch from `main`. Write the failing test first, then the fix.
2. `npm run check` (tests, type check, build, dependency audit).
3. For UI or reading changes, also try the built extension in a throwaway Chrome profile.
4. Open a pull request with `Fixes #N` in the commits. Wait until CI and CodeQL pass.
5. Merge with a local fast-forward and push `main`. Do not use GitHub's merge button: it can write
   the owner's personal email into public history.
6. Run `npm run build` so the owner's unpacked extension is up to date, and say that it needs a
   reload in `chrome://extensions`.

## Rules that do not change

- The design is `docs/superpowers/specs/`. Scoring numbers and word lists live in
  `src/scoring/config.ts`.
- Read only the page already open, only on a click. No crawling, no background requests, nothing
  added to the page, no data leaving the browser.
- Selectors come only from pages the owner saved by hand into `fixtures/` (never committed).
  Never fetch the site.
- A missing value is unknown, never clean.
- This repository is public. No personal data, secrets or text copied from real listings.
  `tests/repository.test.ts` checks the obvious cases.
- Commit with the GitHub no-reply email.
- Code and comments in English, interface and issues in Turkish.
