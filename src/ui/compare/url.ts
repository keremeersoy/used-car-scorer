export function compareUrl(ids: string[]): string {
  return `compare.html?ids=${ids.map(encodeURIComponent).join(',')}`;
}
