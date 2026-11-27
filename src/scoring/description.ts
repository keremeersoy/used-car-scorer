import type { Config } from './config';
import type { Reason, SectionResult } from './types';

// '.' and ',' between digits are number formatting, not boundaries.
const SENTENCE = /(?<!\d)\.|\.(?!\d)|[!?\n]+/;
const CLAUSE = /;|(?<!\d),|,(?!\d)/;

// Fold both Turkish i letters so "ACIL", "ACİL" and "acil" match.
const fold = (text: string) => text.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PLAIN: Record<string, string> = { ğ: 'g', ş: 's', ç: 'c', ö: 'o', ü: 'u' };

/**
 * A word as configured and as typed without Turkish letters. The description itself is never
 * stripped of them: that would turn "şaşırtıcı" into a match for "şasi".
 */
function spellings(word: string): string[] {
  const folded = fold(word).trim();
  const plain = folded.replace(/[ğşçöü]/g, (letter) => PLAIN[letter]!);
  return [...new Set([folded, plain])];
}

const allSpellings = (words: string[]) => new Set(words.flatMap(spellings));

/** Matches at the start of a word only ("pert" is not in "ekspertiz"); suffixes are allowed. */
function phrasePattern(variants: string[]): RegExp {
  const options = variants
    .flatMap(spellings)
    .filter(Boolean)
    .map((spelling) => spelling.split(/\s+/).map(escape).join('\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${options.join('|')})`, 'gu');
}

/** Words that negate, and which words may stand between the phrase and them. */
interface Rule {
  negators: Set<string>;
  allows: (word: string) => boolean;
}

function rulesFor(name: string, cfg: Config['description']): Rule[] {
  const { negators, fillers, partNegation: part } = cfg;
  const plainFillers = allSpellings(fillers);
  if (!part.phrases.includes(name)) {
    return [{ negators: allSpellings(negators), allows: (word) => plainFillers.has(word) }];
  }

  // In "şase, podye, airbag" style lists the other parts do not break the link to a negator.
  const partSpellings = [
    ...allSpellings(
      cfg.phrases.filter(([other]) => part.phrases.includes(other!)).flat(),
    ),
  ];
  const listWords = allSpellings(part.listWords);
  const isListed = (word: string) =>
    listWords.has(word) || partSpellings.some((spelling) => word.startsWith(spelling));
  const partFillers = allSpellings(part.fillers);
  const flawlessFillers = allSpellings(part.flawlessFillers);

  return [
    {
      negators: allSpellings(negators),
      allows: (word) => plainFillers.has(word) || partFillers.has(word) || isListed(word),
    },
    {
      negators: allSpellings(part.flawless),
      allows: (word) => flawlessFillers.has(word) || isListed(word),
    },
  ];
}

function isNegated(after: string[], { negators, allows }: Rule): boolean {
  for (const word of after) {
    if (negators.has(word)) return true;
    // Any other word means the negator is probably about something else.
    if (!allows(word)) return false;
  }
  return false;
}

/** The words following a match, within its clause; only these can negate it. */
const wordsAfter = (clause: string, match: RegExpExecArray) =>
  clause
    .slice(match.index + match[0].length)
    .replace(/^\p{L}+/u, '') // the rest of the word, such as a suffix
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

export function scoreDescription(text: string | null, cfg: Config): SectionResult {
  const max = cfg.weights.description;
  if (text === null || text.trim() === '') {
    return { points: null, max, reasons: [], warnings: ['descriptionMissing'] };
  }

  const { penalty, phrases } = cfg.description;
  const patterns = phrases
    .filter((variants) => variants.some((variant) => variant.trim() !== ''))
    .map((variants) => ({
      phrase: variants[0]!,
      pattern: phrasePattern(variants),
      rules: rulesFor(variants[0]!, cfg.description),
    }));
  const charged = new Set<string>();
  const reasons: Reason[] = [];

  for (const sentence of text.split(SENTENCE)) {
    for (const clause of sentence.split(CLAUSE)) {
      const folded = fold(clause);
      for (const { phrase, pattern, rules } of patterns) {
        const matches = [...folded.matchAll(pattern)];
        if (matches.length === 0) continue;
        // The clause is cleared only if every mention in it is.
        const negated = matches.every((match) => {
          const after = wordsAfter(folded, match);
          return rules.some((candidate) => isNegated(after, candidate));
        });
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
