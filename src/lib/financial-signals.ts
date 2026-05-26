import type { FinancialSnapshot } from "@/lib/financial-snapshot";

export type FinancialSignalType =
  | "budgetPressure"
  | "categoryDominance"
  | "cashFlowRisk"
  | "incomeInstability"
  | "spendingAcceleration"
  | "recurringExpense"
  | "savingsMomentum";

export type FinancialSignal = {
  type: FinancialSignalType;
  severity: number;
  confidence: number;
  persistence: number;
  recencyWeight?: number;
  direction?: "improving" | "worsening" | "stable";
  context?: {
    category?: string;
    merchant?: string;
    delta?: number;
  };
  title: string;
  detail: string;
  meaningVersion?: "v1" | "v2";
  meaning?: {
    version: "v1" | "v2";
    canonicalLabel: string;
    description: string;
    aliases: string[];
    compatibility: "compatible" | "partially compatible" | "breaking";
    impactScope: "signal-level" | "domain-level" | "system-level";
  };
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function buildAttentionScore(signal: FinancialSignal) {
  const recencyWeight = signal.recencyWeight ?? 1;

  return (
    signal.severity * 0.4 +
    signal.confidence * 0.25 +
    signal.persistence * 0.2 +
    clamp(recencyWeight) * 0.15
  );
}

function buildCashFlowRisk(snapshot: FinancialSnapshot): FinancialSignal | null {
  if (snapshot.net >= 0) {
    return null;
  }

  const severity = clamp(Math.abs(snapshot.net) / Math.max(snapshot.expenses || snapshot.income, 1));

  return {
    type: "cashFlowRisk",
    severity,
    confidence: clamp(0.82 + severity * 0.15),
    persistence: clamp(0.7 + severity * 0.2),
    direction: "worsening",
    context: {
      delta: snapshot.net
    },
    title: "Negative cashflow",
    detail: `Expenses exceed income by ${Math.abs(snapshot.net).toFixed(2)}.`
  };
}

function buildBudgetPressure(snapshot: FinancialSnapshot): FinancialSignal | null {
  if (snapshot.budgetUtilizationMax < 0.8) {
    return null;
  }

  const severity = clamp((snapshot.budgetUtilizationMax - 0.8) / 0.2);

  return {
    type: "budgetPressure",
    severity,
    confidence: clamp(0.75 + severity * 0.2),
    persistence: clamp(0.55 + severity * 0.35),
    direction: severity >= 0.5 ? "worsening" : "stable",
    context: {
      delta: snapshot.budgetUtilizationMax - 0.8
    },
    title: "Budget pressure increasing",
    detail: `Budgets are using ${Math.round(snapshot.budgetUtilizationMax * 100)}% of their limit at peak.`
  };
}

function buildCategoryDominance(snapshot: FinancialSnapshot): FinancialSignal | null {
  if (snapshot.categoryConcentration < 0.45) {
    return null;
  }

  const severity = clamp((snapshot.categoryConcentration - 0.45) / 0.25);
  const category = snapshot.topCategory ?? "one category";

  return {
    type: "categoryDominance",
    severity,
    confidence: clamp(0.7 + severity * 0.2),
    persistence: clamp(0.5 + severity * 0.35),
    direction: severity >= 0.5 ? "worsening" : "stable",
    context: {
      category,
      delta: snapshot.categoryConcentration - 0.45
    },
    title: "Spending concentration risk",
    detail: `About ${Math.round(snapshot.categoryConcentration * 100)}% of expenses are flowing through ${category}.`
  };
}

function buildSavingsMomentum(snapshot: FinancialSnapshot): FinancialSignal | null {
  if (snapshot.savingsRate < 0.2) {
    return null;
  }

  const severity = clamp((snapshot.savingsRate - 0.2) / 0.25);

  return {
    type: "savingsMomentum",
    severity,
    confidence: clamp(0.78 + severity * 0.15),
    persistence: clamp(0.5 + severity * 0.3),
    direction: "improving",
    context: {
      delta: snapshot.savingsRate - 0.2
    },
    title: "Positive savings rate",
    detail: `About ${Math.round(snapshot.savingsRate * 100)}% of income remains after spending.`
  };
}

export function buildFinancialSignals(snapshot: FinancialSnapshot): FinancialSignal[] {
  const signals = [
    buildCashFlowRisk(snapshot),
    buildBudgetPressure(snapshot),
    buildCategoryDominance(snapshot),
    buildSavingsMomentum(snapshot)
  ].filter((signal): signal is FinancialSignal => signal !== null);

  return signals.sort((left, right) => buildAttentionScore(right) - buildAttentionScore(left));
}

export function rankFinancialSignals(signals: FinancialSignal[]) {
  return [...signals].sort((left, right) => buildAttentionScore(right) - buildAttentionScore(left));
}

export function scoreFinancialSignal(signal: FinancialSignal) {
  return buildAttentionScore(signal);
}
