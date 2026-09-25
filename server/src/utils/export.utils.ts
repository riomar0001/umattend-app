/**
 * Every timestamp that leaves this file is rendered in Philippine time.
 *
 * The Workers runtime reports UTC as its local timezone, so `getHours()` and a
 * bare `toLocaleString()` put the whole export eight hours behind the wall
 * clock the organizers actually ran the event on. The timezone has to be named
 * explicitly — it is never picked up from the host.
 */
const EXPORT_TIME_ZONE = 'Asia/Manila';

export const formatDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  // `hour12: false` still renders midnight as "24" in some ICU versions.
  const hh = get('hour') === '24' ? '00' : get('hour');

  return `${get('month')}${get('day')}${get('year')}_${hh}${get('minute')}${get('second')}`;
};

export const formatDateTime = (date: Date | null): string => {
  if (!date) {
    return '';
  }

  return new Date(date).toLocaleString('en-US', {
    timeZone: EXPORT_TIME_ZONE,
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
