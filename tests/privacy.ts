/** Things that must never be committed to this public repository. */
const PATTERNS: [name: string, pattern: RegExp][] = [
  ['mobile number', /(\+90[\s.\-(]*|\b0[\s.\-(]*)5\d{2}[\s.\-)]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g],
  [
    'personal email',
    /[\w.+-]+@(gmail|hotmail|outlook|yahoo|icloud|yandex|proton(mail)?)\.[a-z.]{2,}/gi,
  ],
  ['home folder path', /\/(Users|home)\/[\w.-]+\//g],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['access token', /\b(ghp_|gho_|github_pat_|AKIA|AIza|xox[baprs]-)[A-Za-z0-9_-]{16,}/g],
];

/** Names of the kinds found, never the values, so a failing run does not repeat them. */
export function findLeaks(text: string): string[] {
  return PATTERNS.flatMap(([name, pattern]) => (text.match(pattern) ?? []).map(() => name));
}
