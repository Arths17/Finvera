export type FinancialInputs = {
  income: number;
  expenses: number;
  net: number;

  budgetUtilizationMax: number; // 0..1
  categoryConcentration: number; // 0..1
  expenseGrowthRate?: number;
};

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

export function generateFinancialNarrative(input: FinancialInputs): FinancialNarrative {
  const { income, expenses, net, budgetUtilizationMax, categoryConcentration } = input;

  const savingsRate = income > 0 ? net / income : 0;
  const isOverspending = net < 0;
  const isHighBudgetPressure = budgetUtilizationMax >= 0.8;
  const isUnbalanced = categoryConcentration >= 0.5;

  // Mood
  let mood: FinancialNarrative["mood"] = "neutral";

  if (isOverspending) mood = "warning";
  else if (savingsRate > 0.2 && !isHighBudgetPressure) mood = "positive";
  else mood = "neutral";

  // Headline (strict templates)
  let headline = "Your finances are stable but watchful";

  if (isOverspending) headline = "You spent more than you earned this month";
  else if (mood === "positive") headline = "You’re in a strong financial position this month";

  // Insight (deterministic framing)
  let insight = "Your spending remains well distributed across categories.";

  if (isOverspending)
    insight = "Your expenses exceeded income, mainly driven by high spending concentration.";
  else if (isUnbalanced)
    insight = "Spending is heavily concentrated in one category this month.";
  else if (isHighBudgetPressure)
    insight = "Several budgets are approaching their limits.";

  // Primary signal (priority)
  let primarySignal = "Healthy financial balance";

  if (isOverspending) primarySignal = "Negative cashflow";
  else if (isHighBudgetPressure) primarySignal = "Budget pressure increasing";
  else if (isUnbalanced) primarySignal = "Spending concentration risk";

  // Secondary signals (pick up to 2 relevant)
  const secondaries: string[] = [];

  if (isUnbalanced) secondaries.push("High category concentration");
  if (isHighBudgetPressure) secondaries.push("Budget utilization above 80%");
  if (savingsRate > 0.2) secondaries.push("Positive savings rate");
  if (secondaries.length === 0) secondaries.push("Stable spending distribution");

  const secondarySignals = secondaries.slice(0, 2);

  const flags = {
    overspending: isOverspending,
    budgetPressure: isHighBudgetPressure,
    concentrationRisk: isUnbalanced
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
