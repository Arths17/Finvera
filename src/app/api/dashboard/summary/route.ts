import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCurrentMonthYear, getMonthRange, shiftMonthYear } from "@/lib/budgets";
import { buildFinancialSnapshot } from "@/lib/financial-snapshot";
import { buildFinancialSignals } from "@/lib/financial-signals";
import { buildFinancialSignalMemory } from "@/lib/financial-signal-memory";
import { resolveSignalDominance } from "@/lib/signal-dominance";
import { prisma } from "@/lib/prisma";
import { generateFinancialNarrative } from "@/lib/narrative";

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

type MonthlyDashboardContext = {
  month: number;
  year: number;
  snapshot: ReturnType<typeof buildFinancialSnapshot>;
  signals: ReturnType<typeof buildFinancialSignals>;
  highlights: {
    spendingPressure: DashboardCategoryItem[];
    alerts: Array<{
      id: string;
      category: {
        id: string;
        name: string;
      };
      limit: number;
      spent: number;
      remaining: number;
      progress: number;
      message: string;
    }>;
  };
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
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

async function loadMonthlyDashboardContext(userId: string, month: number, year: number): Promise<MonthlyDashboardContext> {
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

  const topCategories: DashboardCategoryItem[] = Array.from(summary.categories.values())
    .sort((left, right) => right.total - left.total)
    .slice(0, TOP_CATEGORY_COUNT);

  const atRiskBudgets = budgetItems
    .filter((item) => item.progress >= 70)
    .sort((left, right) => right.progress - left.progress || Number(right.spent) - Number(left.spent))
    .slice(0, TOP_BUDGET_COUNT);

  const budgetUtilizationMax = budgetItems.length === 0 ? 0 : Math.max(...budgetItems.map((b) => b.progress)) / 100;
  const categoryConcentration = summary.expenses <= 0 ? 0 : Number(topCategories[0]?.total ?? 0) / summary.expenses;

  const snapshot = buildFinancialSnapshot({
    income: summary.income,
    expenses: summary.expenses,
    budgetUtilizationMax,
    categoryConcentration,
    topCategory: topCategories[0]?.name
  });

  const signals = buildFinancialSignals(snapshot);

  return {
    month,
    year,
    snapshot,
    signals,
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
  };
}

export async function GET() {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { month, year } = getCurrentMonthYear();
  const historicalPeriods = Array.from({ length: 5 }, (_, index) => shiftMonthYear(month, year, -(index + 1))).reverse();

  const monthlyContexts = await Promise.all(
    historicalPeriods.map((period) => loadMonthlyDashboardContext(userId, period.month, period.year))
  );
  const currentContext = await loadMonthlyDashboardContext(userId, month, year);
  const signalMemory = buildFinancialSignalMemory([
    ...monthlyContexts.map((context) => ({
      month: context.month,
      year: context.year,
      signals: context.signals
    })),
    {
      month: currentContext.month,
      year: currentContext.year,
      signals: currentContext.signals
    }
  ]);
  const signalSurface = resolveSignalDominance(currentContext.signals, signalMemory.current);
  const narrative = generateFinancialNarrative(currentContext.snapshot, signalSurface.dominant);

  return NextResponse.json({
    month,
    year,
    snapshot: currentContext.snapshot,
    signals: currentContext.signals,
    signalSurface,
    narrative,
    signalMemory,
    highlights: {
      spendingPressure: currentContext.highlights.spendingPressure,
      alerts: currentContext.highlights.alerts
    }
  });
}