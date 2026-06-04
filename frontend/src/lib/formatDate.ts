/**
 * Centralized date formatting utilities.
 * Uses explicit locale (en-GB) for consistent day-month-year clinical convention.
 */

const DATE_LOCALE = 'en-GB';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day:   '2-digit',
  month: 'short',
  year:  'numeric',
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour:   '2-digit',
  minute: '2-digit',
};

/** "03 Jun 2026" */
export function formatDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(DATE_LOCALE, DATE_OPTIONS);
}

/** "03 Jun 2026, 14:30" */
export function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(DATE_LOCALE, DATETIME_OPTIONS);
}

/** "3h ago", "2d ago", "Just now" — relative time for urgency indicators */
export function timeAgo(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';

  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours   = Math.floor(diffMs / 3_600_000);
  const days    = Math.floor(diffMs / 86_400_000);

  if (minutes < 1)  return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24)   return `${hours}h ago`;
  if (days < 30)    return `${days}d ago`;
  return formatDate(d);
}
