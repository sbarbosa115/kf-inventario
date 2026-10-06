import {TIME_ZONE} from '@/shared/lib';
import type {DateRangeValue} from '@/shared/api';

/** Today in Bogotá as YYYY-MM-DD (the API's days are Bogotá days). */
export function bogotaToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function shift(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type QuickRange = 'today' | 'last7' | 'last30' | 'thisMonth';

export const QUICK_RANGES: QuickRange[] = [
  'today',
  'last7',
  'last30',
  'thisMonth',
];

/** The days a quick pick means, both included, ending today (Bogotá). */
export function quickRange(
  pick: QuickRange,
  now: Date = new Date(),
): Required<DateRangeValue> {
  const today = bogotaToday(now);
  switch (pick) {
    case 'today':
      return {from: today, to: today};
    case 'last7':
      return {from: shift(today, -6), to: today};
    case 'last30':
      return {from: shift(today, -29), to: today};
    case 'thisMonth':
      return {from: `${today.slice(0, 8)}01`, to: today};
  }
}
