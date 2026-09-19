export const formatDate = (date: Date): string => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${mm}${dd}${yyyy}_${hh}${min}${ss}`;
};

export const formatDateTime = (date: Date | null): string => {
  if (!date) {
    return '';
  }

  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

export const toKebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

/**
 * Reduces a string to ASCII letters, digits and dashes. Header values only
 * accept bytes in [\t\x20-\x7e\x80-\xff], so anything else (smart quotes,
 * en/em dashes, emoji, CJK) would make res.setHeader throw ERR_INVALID_CHAR.
 */
export const toAsciiSlug = (str: string): string => {
  // NFKD splits accented letters into base + combining mark so the base letter
  // survives instead of being dropped with the rest of the non-ASCII text.
  const withoutAccents = str.normalize('NFKD').replace(/\p{M}+/gu, '');

  return toKebabCase(withoutAccents)
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
};

export const generateExportFileName = (
  eventId: string,
  eventName: string
): string => {
  const id = toAsciiSlug(eventId ?? '') || 'export';
  const name = toAsciiSlug(eventName ?? '') || 'event';

  return `${id}_${name}_${formatDate(new Date())}.xlsx`;
};
