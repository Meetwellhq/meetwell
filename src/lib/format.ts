/** Short naira price for buttons: ₦5k, ₦12.5k (whole naira under ₦1,000). */
export function nairaShort(kobo: number): string {
  const n = kobo / 100;
  return n >= 1000 ? `₦${Number((n / 1000).toFixed(1))}k` : `₦${Math.round(n)}`;
}

/** Full naira price, no decimals: ₦5,000, ₦12,500. */
export function nairaFull(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}
