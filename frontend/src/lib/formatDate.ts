/**
 * Centralized date formatting utilities.
 * Locale is derived from the active app language so Arabic users see Arabic dates.
 */

import i18next from 'i18next';

function getLocale(): string {
  const lang = i18next.language || localStorage.getItem('app_lang') || 'en';
  return lang === 'ar' ? 'ar-SA' : 'en-GB';
}

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

/** "03 Jun 2026"  /  "٠٣ يونيو ٢٠٢٦" */
export function formatDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(getLocale(), DATE_OPTIONS);
}

/** "03 Jun 2026, 14:30" */
export function formatDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(getLocale(), DATETIME_OPTIONS);
}

/** Relative time — "3h ago", "2d ago", "Just now" — translated for Arabic */
export function timeAgo(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '—';

  const lang    = i18next.language || localStorage.getItem('app_lang') || 'en';
  const isAr    = lang === 'ar';

  const diffMs  = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours   = Math.floor(diffMs / 3_600_000);
  const days    = Math.floor(diffMs / 86_400_000);

  if (isAr) {
    if (minutes < 1)  return 'الآن';
    if (minutes < 60) return `منذ ${minutes} د`;
    if (hours < 24)   return `منذ ${hours} س`;
    if (days < 30)    return `منذ ${days} ي`;
  } else {
    if (minutes < 1)  return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24)   return `${hours}h ago`;
    if (days < 30)    return `${days}d ago`;
  }
  return formatDate(d);
}
