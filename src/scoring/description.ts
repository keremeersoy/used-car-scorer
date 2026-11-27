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

function negatorPattern(negators: string[]): RegExp {
  const words = negators.map((word) => escape(fold(word))).join('|');
  return new RegExp(`(?<!\\p{L})(?:${words})(?!\\p{L})`, 'gu');
}

export function scoreDescription(text: string | null, cfg: Config): SectionResult {
  const max = cfg.weights.description;
  if (text === null || text.trim() === '') {
    return { points: null, max, reasons: [], warnings: ['descriptionMissing'] };
  }

  const { penalty, phrases, negators } = cfg.description;
  const patterns = phrases
    .filter((phrase) => phrase.trim() !== '')
    .map((phrase) => ({ phrase, pattern: phrasePattern(phrase) }));
  const negator = negatorPattern(negators);
  const charged = new Set<string>();
  const reasons: Reason[] = [];

  for (const sentence of text.split(SENTENCE)) {
    for (const clause of sentence.split(CLAUSE)) {
      const folded = fold(clause);
      for (const { phrase, pattern } of patterns) {
        const match = pattern.exec(folded);
        if (!match) continue;
        // A negator counts only when it follows the phrase within the same clause.
        negator.lastIndex = match.index + match[0].length;
        const negated = negator.test(folded);
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
