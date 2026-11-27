import type { Config } from './config';
import type { Reason, SectionResult } from './types';

// '.' and ',' between digits are number formatting, not boundaries.
const SENTENCE = /(?<!\d)\.|\.(?!\d)|[!?\n]+/;
const CLAUSE = /;|(?<!\d),|,(?!\d)/;

// Fold both Turkish i letters so "ACIL", "ACİL" and "acil" match.
const fold = (text: string) => text.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches at the start of a word only ("pert" is not in "ekspertiz"); suffixes are allowed. */
function phrasePattern(phrase: string): RegExp {
  const words = fold(phrase).trim().split(/\s+/).map(escape).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${words}`, 'u');
}

/** Words that negate, and the words allowed to stand between the phrase and them. */
interface Rule {
  negators: Set<string>;
  fillers: Set<string>;
}

const rule = (negators: string[], fillers: string[]): Rule => ({
  negators: new Set(negators.map(fold)),
  fillers: new Set(fillers.map(fold)),
});

function rulesFor(phrase: string, cfg: Config['description']): Rule[] {
  const { negators, fillers, partNegation: part } = cfg;
  if (!part.phrases.includes(phrase)) return [rule(negators, fillers)];
  return [
    rule(negators, [...fillers, ...part.fillers]),
    rule(part.flawless, part.flawlessFillers),
  ];
}

function isNegated(after: string[], { negators, fillers }: Rule): boolean {
  for (const word of after) {
    if (negators.has(word)) return true;
    // Any other word means the negator is probably about something else.
    if (!fillers.has(word)) return false;
  }
  return false;
}

export function scoreDescription(text: string | null, cfg: Config): SectionResult {
  const max = cfg.weights.description;
  if (text === null || text.trim() === '') {
    return { points: null, max, reasons: [], warnings: ['descriptionMissing'] };
  }

  const { penalty, phrases } = cfg.description;
  const patterns = phrases
    .filter((phrase) => phrase.trim() !== '')
    .map((phrase) => ({
      phrase,
      pattern: phrasePattern(phrase),
      rules: rulesFor(phrase, cfg.description),
    }));
  const charged = new Set<string>();
  const reasons: Reason[] = [];

  for (const sentence of text.split(SENTENCE)) {
    for (const clause of sentence.split(CLAUSE)) {
      const folded = fold(clause);
      for (const { phrase, pattern, rules } of patterns) {
        const match = pattern.exec(folded);
        if (!match) continue;
        // Only what follows the matched word, within the same clause, can negate it.
        const after = folded
          .slice(match.index + match[0].length)
          .replace(/^\p{L}+/u, '') // the rest of the word, such as a suffix
          .split(/[^\p{L}]+/u)
          .filter(Boolean);
        const negated = rules.some((candidate) => isNegated(after, candidate));
        const charge = !negated && !charged.has(phrase);
        if (charge) charged.add(phrase);
        reasons.push({
          code: 'phrase',
          phrase,
          sentence: sentence.trim(),
          negated,
          points: charge ? penalty : 0,
        });
      }
    }
  }

  const points = Math.max(0, max - charged.size * penalty);
  return { points, max, reasons, warnings: [] };
}
