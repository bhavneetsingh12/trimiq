export type TxLike = {
  date: string;
  name: string;
  amount: number;
  plaid_item_id?: string | null;
};

export type DetectedSubscription = {
  user_id: string;
  merchant_key: string;
  display_name: string;
  cadence: "monthly" | "weekly" | "biweekly" | "irregular";
  avg_amount: number;
  first_seen_date: string;
  last_charge_date: string;
  charge_count: number;
  confidence: number;
  detection_source: "rules";
  evidence: {
    intervals: number[];
    sample_amounts: number[];
    plaid_item_id: string | null;
  };
  updated_at: string;
  plaid_item_id: string | null;
};

export function normalizeMerchant(s: string) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function groupTransactionsByMerchant(txs: TxLike[]) {
  const byMerchant = new Map<string, TxLike[]>();

  for (const t of txs) {
    const key = normalizeMerchant(t.name);
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(t);
  }

  return byMerchant;
}

export function calculateIntervals(sorted: TxLike[]) {
  const dates = sorted.map((x) => new Date(x.date));
  const intervals: number[] = [];

  for (let i = 1; i < dates.length; i++) {
    const diff =
      (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(Math.round(diff));
  }

  return intervals;
}

export function detectCadence(avgInterval: number) {
  if (avgInterval >= 27 && avgInterval <= 33) return "monthly";
  if (avgInterval >= 6 && avgInterval <= 8) return "weekly";
  if (avgInterval >= 13 && avgInterval <= 16) return "biweekly";
  return "irregular";
}

export function calculateConfidence(
  cadence: string,
  stable: boolean,
  chargeCount: number
) {
  let confidence = 50;
  if (cadence !== "irregular") confidence += 25;
  if (stable) confidence += 25;
  if (chargeCount >= 4) confidence += 5;
  return Math.min(confidence, 95);
}

export function detectSubscriptionsFromTransactions(
  txs: TxLike[],
  userId: string
): DetectedSubscription[] {
  const byMerchant = groupTransactionsByMerchant(txs);
  const candidates: DetectedSubscription[] = [];

  for (const [merchantKey, list] of byMerchant.entries()) {
    if (list.length < 3) continue;

    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const intervals = calculateIntervals(sorted);
    if (intervals.length === 0) continue;

    const amounts = sorted.map((x) => Number(x.amount));
    const avgInterval = Math.round(
      intervals.reduce((a, b) => a + b, 0) / intervals.length
    );

    const cadence = detectCadence(avgInterval);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stable = amounts.every(
      (x) => Math.abs(x - avgAmount) <= avgAmount * 0.15
    );

    const confidence = calculateConfidence(cadence, stable, sorted.length);
    if (confidence < 70) continue;

    const displayName =
      merchantKey
        .split(" ")
        .slice(0, 3)
        .join(" ")
        .replace("COM", "")
        .trim() || merchantKey;

    candidates.push({
      user_id: userId,
      merchant_key: merchantKey,
      display_name: displayName,
      cadence,
      avg_amount: Number(avgAmount.toFixed(2)),
      first_seen_date: sorted[0].date,
      last_charge_date: sorted[sorted.length - 1].date,
      charge_count: sorted.length,
      confidence,
      detection_source: "rules",
      evidence: {
        intervals,
        sample_amounts: amounts.slice(0, 5),
        plaid_item_id: sorted[sorted.length - 1]?.plaid_item_id ?? null,
      },
      updated_at: new Date().toISOString(),
      plaid_item_id: sorted[sorted.length - 1]?.plaid_item_id ?? null,
    });
  }

  return candidates;
}