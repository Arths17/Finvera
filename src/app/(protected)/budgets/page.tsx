import { auth } from "@/lib/auth";
import BudgetsManager from "@/components/budgets/budgets-manager";
import { getCurrentMonthYear, getMonthRange } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

type BudgetsPageProps = {
  searchParams?: {
    month?: string | string[];
    year?: string | string[];
  };
};

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseMonthYear(searchValue: string | string[] | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(getQueryValue(searchValue));

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const categories = await prisma.category.findMany({
    where: {
      userId: session.user.id
    },
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: "asc"
    }
  });

  const currentMonthYear = getCurrentMonthYear();
  const month = parseMonthYear(searchParams?.month, currentMonthYear.month, 1, 12);
  const year = parseMonthYear(searchParams?.year, currentMonthYear.year, 2000, 2100);

  const budgets = await prisma.budget.findMany({
    where: {
      userId: session.user.id,
      month,
      year
    },
    include: {
      category: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const categoryIds = budgets.map((budget) => budget.categoryId);
  const { start, end } = getMonthRange(year, month);
  const spentRows = categoryIds.length
    ? await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId: session.user.id,
          type: "EXPENSE",
          categoryId: {
            in: categoryIds
          },
          occurredAt: {
            gte: start,
            lt: end
          }
        },
        _sum: {
          amount: true
        }
      })
    : [];

  const spentMap = new Map<string, number>(
    spentRows.map((row) => [row.categoryId, Number(row._sum.amount ?? 0)])
  );

  const serializedBudgets = budgets.map((budget) => {
    const limit = Number(budget.limit);
    const spent = spentMap.get(budget.categoryId) ?? 0;
    const remaining = limit - spent;

    return {
      id: budget.id,
      limit: budget.limit.toString(),
      month: budget.month,
      year: budget.year,
      category: {
        id: budget.category.id,
        name: budget.category.name
      },
      spent: spent.toFixed(2),
      remaining: remaining.toFixed(2),
      progress: limit <= 0 ? 0 : Math.min(100, (spent / limit) * 100)
    };
  });

  return (
    <BudgetsManager
      initialBudgets={serializedBudgets}
      categories={categories}
      selectedMonth={month}
      selectedYear={year}
    />
  );
}