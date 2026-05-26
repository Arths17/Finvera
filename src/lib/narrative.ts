import type { FinancialSnapshot } from "@/lib/financial-snapshot";
import { buildFinancialSignals, rankFinancialSignals, type FinancialSignal } from "@/lib/financial-signals";

export type FinancialNarrative = {
  mood: "positive" | "neutral" | "warning";

  headline: string;
  insight: string;

  primarySignal: string;
  secondarySignals: string[];

  flags: {
    overspending: boolean;
    budgetPressure: boolean;
    concentrationRisk: boolean;
  };
};

function buildNarrativeFromSignals(snapshot: FinancialSnapshot, signals: FinancialSignal[]): FinancialNarrative {
  const rankedSignals = rankFinancialSignals(signals);
  const topSignal = rankedSignals[0];
  const topCategory = snapshot.topCategory ?? "one category";

  const explainSignal = (signal?: FinancialSignal) => signal?.meaning?.description ?? signal?.detail ?? "";

  let mood: FinancialNarrative["mood"] = "neutral";
  if (topSignal?.type === "cashFlowRisk" || topSignal?.type === "budgetPressure" || topSignal?.type === "categoryDominance") {
    mood = "warning";
  } else if (topSignal?.type === "savingsMomentum" && topSignal.direction === "improving") {
    mood = "positive";
  }

  let headline = "Income and spending are broadly balanced this month";
  if (topSignal?.type === "cashFlowRisk") {
    headline = "Spending is running ahead of income this month";
  } else if (topSignal?.type === "budgetPressure") {
    headline = "Several budgets are running close to their limits";
  } else if (topSignal?.type === "categoryDominance") {
    headline = `Spending is becoming concentrated in ${topCategory}`;
  } else if (topSignal?.type === "savingsMomentum") {
    headline = "Income is comfortably ahead of spending this month";
  }

  let insight = "No high-confidence signals are currently standing out.";
  if (topSignal) {
    insight = explainSignal(topSignal);
    if (rankedSignals.length > 1) {
      insight = `${explainSignal(topSignal)} ${explainSignal(rankedSignals[1])}`;
    }
  } else if (snapshot.savingsRate >= 0.2) {
    insight = "Income is leaving room after spending, while category mix stays broad.";
  }

  const primarySignal = topSignal?.title ?? "Stable financial balance";
  const secondarySignals = rankedSignals.slice(1, 4).map((signal) => signal.title);

  const flags = {
    overspending: rankedSignals.some((signal) => signal.type === "cashFlowRisk"),
    budgetPressure: rankedSignals.some((signal) => signal.type === "budgetPressure"),
    concentrationRisk: rankedSignals.some((signal) => signal.type === "categoryDominance")
  };

  return {
    mood,
    headline,
    insight,
    primarySignal,
    secondarySignals,
    flags
  };
}

export function generateFinancialNarrative(
  snapshot: FinancialSnapshot,
  signals: FinancialSignal[] = buildFinancialSignals(snapshot)
): FinancialNarrative {
  return buildNarrativeFromSignals(snapshot, signals);
}
