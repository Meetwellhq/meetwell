import "server-only";

/**
 * Naira per US dollar, for showing admin revenue in dollars. Members still pay
 * in naira; this only converts the totals. Free daily rates from
 * ExchangeRate-API (open access, attribution required), cached for a day.
 * Returns null if the rate can't be fetched, so pages fall back to naira.
 */
export type UsdRate = { ngnPerUsd: number; updated: string };

export async function getUsdRate(): Promise<UsdRate | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string; rates?: { NGN?: number }; time_last_update_utc?: string };
    const rate = body.rates?.NGN;
    if (body.result !== "success" || typeof rate !== "number" || !(rate > 0)) return null;
    return { ngnPerUsd: rate, updated: body.time_last_update_utc ?? "" };
  } catch {
    return null;
  }
}

/** "$1,234" from kobo at the given rate. */
export function usdFromKobo(kobo: number, rate: UsdRate) {
  const usd = kobo / 100 / rate.ngnPerUsd;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: usd < 100 ? 2 : 0,
  }).format(usd);
}
