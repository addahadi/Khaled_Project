/**
 * Format a price in Algerian Dinar (DZD).
 * Latin grouped digits in both languages; currency unit localised (DA / دج).
 */
export function formatDZD(amount: number | string, lang: string): string {
  const n = Number(amount).toLocaleString('en-US');
  return lang === 'ar' ? `${n} دج` : `${n} DA`;
}
