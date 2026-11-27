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

export function parseYear(text: string): ParsedNumber {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  return /^\d{4}$/.test(trimmed) ? { ok: true, value: Number(trimmed) } : { ok: false };
}
