import {intlLocale, useTranslation, type Locale} from '@/shared/i18n';
import {useMemo} from 'react';

/** The company's time zone: the server writes dates in it (README), the screens show them in it. */
export const TIME_ZONE = 'America/Bogota';
export const CURRENCY = 'USD';
const NONE = '—';

type Amount = number | string | null | undefined;

export interface Format {
  /** US dollars: $1,250.00 / US$ 1.250,00. Accepts the API's decimal strings. */
  money: (amount: Amount) => string;
  num: (value: Amount) => string;
  /** Oct 5, 2026 / 5 de oct de 2026. A date without a time ("2026-10-05") stays on its day. */
  date: (iso: string | null | undefined) => string;
  /** Oct 5, 2026, 2:30 PM / 5 de oct de 2026, 2:30 p. m. */
  dateTime: (iso: string | null | undefined) => string;
}

function toNumber(value: Amount): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Numbers, money and dates for a language (en → en-US, es → es-CO). */
export function formatter(locale: Locale): Format {
  const tag = intlLocale(locale);
  const money = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: CURRENCY,
  });
  const num = new Intl.NumberFormat(tag, {maximumFractionDigits: 3});
  const day = {day: 'numeric', month: 'short', year: 'numeric'} as const;
  const date = new Intl.DateTimeFormat(tag, {...day, timeZone: TIME_ZONE});
  const dayOnly = new Intl.DateTimeFormat(tag, {...day, timeZone: 'UTC'});
  const dateTime = new Intl.DateTimeFormat(tag, {
    ...day,
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
  const when = (iso: string | null | undefined, as: Intl.DateTimeFormat) => {
    if (!iso) return NONE;
    if (DAY_ONLY.test(iso)) return dayOnly.format(new Date(`${iso}T00:00:00Z`));
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? NONE : as.format(parsed);
  };
  return {
    money: (amount) => {
      const n = toNumber(amount);
      return n === null ? NONE : money.format(n);
    },
    num: (value) => {
      const n = toNumber(value);
      return n === null ? NONE : num.format(n);
    },
    date: (iso) => when(iso, date),
    dateTime: (iso) => when(iso, dateTime),
  };
}

/** The formatter of the current language. */
export function useFormat(): Format {
  const {locale} = useTranslation();
  return useMemo(() => formatter(locale), [locale]);
}
