export function compareUrl(ids: string[]): string {
  return `compare.html?ids=${ids.map(encodeURIComponent).join(',')}`;
}

export function parseIds(search: string): string[] {
  // Split the raw value: an id may itself contain an encoded comma.
  const raw = /[?&]ids=([^&]*)/.exec(search)?.[1] ?? '';
  return raw.split(',').filter(Boolean).map(decodeURIComponent);
}
