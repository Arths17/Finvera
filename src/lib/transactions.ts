export type RawTransaction = {
  id?: string;
  amount: number; // raw signed amount in account currency (negative = debit)
  currency?: string;
  date: string | number | Date;
  description?: string;
  merchant?: string;
  category?: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedTransaction = {
  id?: string;
  date: Date;
  originalAmount: number;
  normalizedAmount: number; // signed, in account currency
  currency?: string;
  direction: "debit" | "credit";
  merchant?: string; // raw merchant extracted
  canonicalMerchant?: string; // cleaned canonical merchant key
  category?: string;
  recurrenceCandidate?: boolean;
  recurrenceConfidence?: number; // 0-1
  confidence: number; // 0-1 overall confidence in normalization
  raw: RawTransaction;
};

// Lightweight merchant canonicalization map — deterministic rules only.
const MERCHANT_ALIASES: Record<string, string> = {
  "starbucks": "Starbucks",
  "uber": "Uber",
  "uber eats": "Uber",
  "lyft": "Lyft",
  "netflix": "Netflix",
  "spotify": "Spotify",
  "amazon": "Amazon",
  "walmart": "Walmart",
  "costco": "Costco",
  "shell": "Shell",
  "exxon": "Exxon",
  "att": "AT&T",
  "verizon": "Verizon"
};

// Simple merchant -> category hints
const MERCHANT_CATEGORY_HINTS: Record<string, string> = {
  "starbucks": "Food & Drink",
  "uber": "Transport",
  "lyft": "Transport",
  "netflix": "Subscriptions",
  "spotify": "Subscriptions",
  "amazon": "Shopping",
  "walmart": "Groceries",
  "costco": "Groceries",
  "shell": "Auto & Transport",
  "exxon": "Auto & Transport",
  "att": "Utilities",
  "verizon": "Utilities"
};

function toDate(d: string | number | Date): Date {
  if (d instanceof Date) return d;
  return new Date(d);
}

function canonicalizeMerchant(name?: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name
    .toLowerCase()
    .replace(/[\d\-\_\.#@\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // map exact alias
  if (MERCHANT_ALIASES[cleaned]) return MERCHANT_ALIASES[cleaned];

  // try to find known token within cleaned name
  for (const token of Object.keys(MERCHANT_ALIASES)) {
    if (cleaned.includes(token)) return MERCHANT_ALIASES[token];
  }

  // fallback: Title Case the cleaned string (first 4 words max)
  return cleaned
    .split(" ")
    .slice(0, 4)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function guessCategoryFromMerchant(merchant?: string, explicitCategory?: string) {
  if (explicitCategory) return { category: explicitCategory, confidence: 1 };
  if (!merchant) return { category: undefined, confidence: 0 };

  const key = merchant.toLowerCase();
  for (const token of Object.keys(MERCHANT_CATEGORY_HINTS)) {
    if (key.includes(token)) {
      return { category: MERCHANT_CATEGORY_HINTS[token], confidence: 0.9 };
    }
  }

  return { category: undefined, confidence: 0 };
}

export function normalizeTransaction(raw: RawTransaction): NormalizedTransaction {
  const date = toDate(raw.date);
  const originalAmount = raw.amount;
  const normalizedAmount = Number(originalAmount) || 0;
  const direction = normalizedAmount < 0 ? "debit" : "credit";

  const merchant = raw.merchant || raw.description;
  const canonicalMerchant = canonicalizeMerchant(merchant);

  const categoryGuess = guessCategoryFromMerchant(merchant, raw.category);

  // Confidence: simple heuristic combining merchant existence and category confidence
  let confidence = 0.5;
  if (merchant) confidence += 0.2;
  if (canonicalMerchant && canonicalMerchant !== merchant) confidence += 0.05;
  confidence += categoryGuess.confidence * 0.25;
  if (Math.abs(normalizedAmount) > 0) confidence = Math.min(1, confidence);

  return {
    id: raw.id,
    date,
    originalAmount,
    normalizedAmount,
    currency: raw.currency,
    direction,
    merchant: merchant ? merchant.toString() : undefined,
    canonicalMerchant,
    category: categoryGuess.category,
    recurrenceCandidate: false,
    recurrenceConfidence: 0,
    confidence,
    raw
  };
}

// Detect recurrence candidates across a set of normalized transactions.
// Heuristics used (deterministic):
//  - merchant appears repeatedly on monthly cadence within the lookback window
//  - description contains subscription-related keywords
export function detectRecurrenceCandidates(
  txs: NormalizedTransaction[],
  lookbackMonths = 6
) {
  if (!txs || txs.length === 0) return txs;

  // group by canonicalMerchant (fallback to merchant string)
  const groups: Record<string, NormalizedTransaction[]> = {};
  for (const t of txs) {
    const key = (t.canonicalMerchant || t.merchant || "__unknown").toString();
    groups[key] = groups[key] || [];
    groups[key].push(t);
  }

  const now = new Date();
  const earliest = new Date(now.getFullYear(), now.getMonth() - lookbackMonths + 1, 1);

  const results = txs.map((t) => ({ ...t }));

  for (const [key, items] of Object.entries(groups)) {
    const recent = items.filter((i) => i.date >= earliest).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (recent.length < 2) continue;

    // compute month buckets
    const months = new Set(recent.map((r) => `${r.date.getFullYear()}-${r.date.getMonth()}`));
    const monthCount = months.size;

    // average absolute amount
    const avg = recent.reduce((s, r) => s + Math.abs(r.normalizedAmount), 0) / recent.length;

    // compute consistency: how many transactions close to avg (within 10%)
    const consistentCount = recent.filter((r) => Math.abs(Math.abs(r.normalizedAmount) - avg) / (avg || 1) < 0.1).length;

    // basic score components
    const cadenceScore = Math.min(1, monthCount / Math.min(lookbackMonths, recent.length));
    const consistencyScore = Math.min(1, consistentCount / recent.length);

    const baseScore = 0.6 * cadenceScore + 0.4 * consistencyScore;

    // if description contains subscription-like tokens, boost
    const subscriptionTokens = ["subscription", "monthly", "recurring", "auto-renew", "auto renew", "membership"];
    const hasSubscriptionToken = recent.some((r) => {
      const desc = (r.raw.description || "").toLowerCase();
      return subscriptionTokens.some((tok) => desc.includes(tok));
    });

    const finalScore = Math.min(1, baseScore + (hasSubscriptionToken ? 0.2 : 0));

    // mark recent transactions in this group as recurrenceCandidate with confidence
    for (const r of recent) {
      const idx = results.findIndex((x) => x === r || x.id === r.id);
      if (idx >= 0) {
        results[idx].recurrenceCandidate = finalScore >= 0.5;
        results[idx].recurrenceConfidence = finalScore;
        // slightly raise overall normalization confidence if recurrence is strong
        results[idx].confidence = Math.min(1, results[idx].confidence + finalScore * 0.1);
      }
    }
  }

  return results;
}

export function summarizeTransactionForLog(t: NormalizedTransaction) {
  return `${t.date.toISOString().slice(0, 10)} ${t.direction} ${t.normalizedAmount} ${t.canonicalMerchant || t.merchant || "unknown"} (${t.category || "uncategorized"})`;
}

export default {
  normalizeTransaction,
  detectRecurrenceCandidates,
  canonicalizeMerchant,
  guessCategoryFromMerchant,
  summarizeTransactionForLog
};
