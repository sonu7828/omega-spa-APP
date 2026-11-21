/**
 * Currency Utility for OMEGA SPA POS
 * Standard: Central African CFA Franc (FCFA / XAF)
 */

export function formatFCFA(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0 FCFA';
  }
  const num = Math.round(Number(amount));
  // Format with space as thousands separator
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

export function parseFCFA(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

