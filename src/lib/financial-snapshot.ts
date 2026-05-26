export type FinancialSnapshot = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  budgetUtilizationMax: number;
  categoryConcentration: number;
  topCategory?: string;
};

export function buildFinancialSnapshot(input: {
  income: number;
  expenses: number;
  budgetUtilizationMax: number;
  categoryConcentration: number;
  topCategory?: string;
}): FinancialSnapshot {
  const net = input.income - input.expenses;
  const savingsRate = input.income > 0 ? net / input.income : 0;

  return {
    income: input.income,
    expenses: input.expenses,
    net,
    savingsRate,
    budgetUtilizationMax: input.budgetUtilizationMax,
    categoryConcentration: input.categoryConcentration,
    topCategory: input.topCategory
  };
}