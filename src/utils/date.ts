/**
 * Date & Time Utilities for OMEGA SPA POS
 * Standard: Africa/Douala (WAT, UTC+1)
 */

import { format, parseISO, isValid } from 'date-fns';

export function formatDate(dateInput: string | Date | null | undefined, formatStr: string = 'dd MMM yyyy'): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (!isValid(d)) return '—';
    return format(d, formatStr);
  } catch (e) {
    return '—';
  }
}

export function formatTime(timeInput: string | Date | null | undefined): string {
  if (!timeInput) return '—';
  try {
    if (typeof timeInput === 'string' && /^\d{2}:\d{2}/.test(timeInput)) {
      return timeInput.substring(0, 5);
    }
    const d = typeof timeInput === 'string' ? parseISO(timeInput) : timeInput;
    if (!isValid(d)) return '—';
    return format(d, 'HH:mm');
  } catch (e) {
    return '—';
  }
}

export function formatDateTime(dateTimeInput: string | Date | null | undefined): string {
  if (!dateTimeInput) return '—';
  return `${formatDate(dateTimeInput, 'dd MMM yyyy')} at ${formatTime(dateTimeInput)}`;
}

export function getTodayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

