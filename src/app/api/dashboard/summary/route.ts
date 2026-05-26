import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCurrentMonthYear, getMonthRange } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

type DashboardBudgetItem = {
  id: string;
  category: {
    id: string;
    name: string;
  };
  limit: string;
  spent: string;
  remaining: string;
  progress: number;
};

type DashboardCategoryItem = {
  name: string;
  total: number;
};

const TOP_CATEGORY_COUNT = 3;
const TOP_BUDGET_COUNT = 3;

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function buildState(input: {
  net: number;
  utilization: number;
  topCategoryShare: number;
  topCategoryName?: string;
  topBudgetName?: string;
}) {
  const { net, utilization, topCategoryShare, topCategoryName, topBudgetName } = input;

  if (net <= 0) {
    return {
      label: "Overspending month",
      message: topBudgetName
        ? `Spending is running above income, and ${topBudgetName} is the first constraint to watch.`
        : "Spending is running above income this month."
    };
  }

  if (topCategoryShare > 0.6) {
    return {
      label: "Unbalanced spending",
      message: topCategoryName
        ? `${topCategoryName} is carrying more than most of your spending, which makes the month feel skewed.`
        : "One category is carrying too much of the month’s spending."
    };
  }

  if (utilization < 50) {
    return {
      label: "Strong month",
      message: "Your income is comfortably ahead of spending, with budget usage still well under control."
    };
  }

  return {
    label: "Healthy but controlled",
    message: "You’re ahead overall, but enough of the budget is in use that discipline still matters."
  };
}

function buildAlertMessage(item: DashboardBudgetItem) {
  if (item.progress >= 100) {
    return `You’ve exceeded the ${item.category.name} budget.`;
  }

  return `You’re close to exceeding the ${item.category.name} budget.`;
}

async function requireUser() {
  const session = await auth();

  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { month, year } = getCurrentMonthYear();
  const { start, end } = getMonthRange(year, month);

  const [transactions, budgets] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        occurredAt: {
          gte: start,
          lt: end
        }
      },
      select: {
        amount: true,
        type: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }),
    prisma.budget.findMany({
      where: {
        userId,
        month,
        year
      },
      select: {
        id: true,
        limit: true,
        category: {
          select: {
            id: true,
            name: true
          }
        },
        categoryId: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  const summary = transactions.reduce(
    (accumulator, transaction) => {
      const amount = Number(transaction.amount);

      if (transaction.type === "INCOME") {
        accumulator.income += amount;
      } else {
        accumulator.expenses += amount;
        const category = accumulator.categories.get(transaction.categoryId) ?? {
          name: transaction.category.name,
          total: 0
        };

        category.total += amount;
        accumulator.categories.set(transaction.categoryId, category);
      }

      return accumulator;
    },
    {
      income: 0,
      expenses: 0,
      categories: new Map<string, { name: string; total: number }>()
    }
  );

  const expenseTotalsByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE") {
      continue;
    }

    expenseTotalsByCategory.set(
      transaction.categoryId,
      (expenseTotalsByCategory.get(transaction.categoryId) ?? 0) + Number(transaction.amount)
    );
  }

  const budgetItems: DashboardBudgetItem[] = budgets.map((budget) => {
    const limit = Number(budget.limit);
    const spent = expenseTotalsByCategory.get(budget.categoryId) ?? 0;
    const remaining = limit - spent;

    return {
      id: budget.id,
      category: budget.category,
      limit: budget.limit.toString(),
      spent: spent.toFixed(2),
      remaining: remaining.toFixed(2),
      progress: limit <= 0 ? 0 : Math.min(100, (spent / limit) * 100)
    };
  });

  const totalBudget = budgetItems.reduce((total, item) => total + Number(item.limit), 0);
  const totalSpent = budgetItems.reduce((total, item) => total + Number(item.spent), 0);
  const utilization = totalBudget <= 0 ? 0 : (totalSpent / totalBudget) * 100;

  const topCategories: DashboardCategoryItem[] = Array.from(summary.categories.values())
    .sort((left, right) => right.total - left.total)
    .slice(0, TOP_CATEGORY_COUNT);

  const atRiskBudgets = budgetItems
    .filter((item) => item.progress >= 70)
    .sort((left, right) => right.progress - left.progress || Number(right.spent) - Number(left.spent))
    .slice(0, TOP_BUDGET_COUNT);

  const state = buildState({
    net: summary.income - summary.expenses,
    utilization,
    topCategoryShare: summary.expenses <= 0 ? 0 : Number(topCategories[0]?.total ?? 0) / summary.expenses,
    topCategoryName: topCategories[0]?.name,
    topBudgetName: atRiskBudgets[0]?.category.name
  });

  return NextResponse.json({
    month,
    year,
    state,
    totals: {
      income: summary.income,
      expenses: summary.expenses,
      net: summary.income - summary.expenses
    },
    highlights: {
      spendingPressure: topCategories,
      alerts: atRiskBudgets.map((item) => ({
        id: item.id,
        category: item.category,
        limit: toMoney(Number(item.limit)),
        spent: toMoney(Number(item.spent)),
        remaining: toMoney(Number(item.remaining)),
        progress: item.progress,
        message: buildAlertMessage(item)
      }))
    }
  });
}