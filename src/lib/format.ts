/** Short naira price for buttons: ₦5k, ₦12.5k (whole naira under ₦1,000). */
export function nairaShort(kobo: number): string {
  const n = kobo / 100;
  return n >= 1000 ? `₦${Number((n / 1000).toFixed(1))}k` : `₦${Math.round(n)}`;
}
