/** Plain digits, or digits grouped in threes by '.' or a space, with an optional unit. */
const WHOLE_NUMBER = /^(\d+|\d{1,3}([.\s]\d{3})+)$/;
const UNIT = /\s*(tl|km)$/i;

export type ParsedNumber = { ok: true; value: number | null } | { ok: false };

/** Unclear input is rejected: it must never turn into zero or a smaller number. */
export function parseWholeNumber(text: string): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  const digits = trimmed.replace(UNIT, '');
  if (!WHOLE_NUMBER.test(digits)) return { ok: false };
  return { ok: true, value: Number(digits.replace(/[.\s]/g, '')) };
}

export function parsePrice(text: string): ParsedNumber {
  const parsed = parseWholeNumber(text);
  return parsed.ok && parsed.value === 0 ? { ok: true, value: null } : parsed;
}

const OLDEST_YEAR = 1900;

/** Rejects years no car can have, such as 2108 typed for 2018. */
export function parseYear(text: string, latest = new Date().getFullYear() + 1): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d{4}$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return value >= OLDEST_YEAR && value <= latest ? { ok: true, value } : { ok: false };
}
