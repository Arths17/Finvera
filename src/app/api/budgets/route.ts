import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCurrentMonthYear, getMonthRange } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";
import { budgetCreateSchema, budgetQuerySchema } from "@/lib/validators";

type BudgetResponse = {
  id: string;
  limit: string;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
  spent: string;
  remaining: string;
  progress: number;
};

function serializeBudget(
  budget: Awaited<ReturnType<typeof prisma.budget.findMany>>[number],
  spentAmount: number
): BudgetResponse {
  const limit = Number(budget.limit);
  const remaining = limit - spentAmount;

  return {
    id: budget.id,
    limit: budget.limit.toString(),
    month: budget.month,
    year: budget.year,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    category: {
      id: budget.category.id,
      name: budget.category.name
    },
    spent: spentAmount.toFixed(2),
    remaining: remaining.toFixed(2),
    progress: limit <= 0 ? 0 : Math.min(100, (spentAmount / limit) * 100)
  };
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return session.user.id;
}

async function getOwnedCategoryId(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId
    },
    select: {
      id: true
    }
  });

  return category?.id ?? null;
}

export async function GET(request: Request) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = budgetQuerySchema.safeParse({
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid budget filter" }, { status: 400 });
  }

  const currentMonthYear = getCurrentMonthYear();
  const month = parsedQuery.data.month ?? currentMonthYear.month;
  const year = parsedQuery.data.year ?? currentMonthYear.year;
  const { start, end } = getMonthRange(year, month);

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
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
  const spentRows = categoryIds.length
    ? await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId,
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

  return NextResponse.json({
    budgets: budgets.map((budget) => serializeBudget(budget, spentMap.get(budget.categoryId) ?? 0)),
    month,
    year
  });
}

export async function POST(request: Request) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = budgetCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid budget payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const ownedCategoryId = await getOwnedCategoryId(userId, parsed.data.categoryId);

  if (!ownedCategoryId) {
    return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  const duplicateBudget = await prisma.budget.findFirst({
    where: {
      userId,
      categoryId: ownedCategoryId,
      month: parsed.data.month,
      year: parsed.data.year
    }
  });

  if (duplicateBudget) {
    return NextResponse.json({ error: "A budget already exists for this category and month" }, { status: 409 });
  }

  try {
    const budget = await prisma.budget.create({
      data: {
        userId,
        categoryId: ownedCategoryId,
        limit: new Prisma.Decimal(parsed.data.limit),
        month: parsed.data.month,
        year: parsed.data.year
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ budget: serializeBudget(budget, 0) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create budget" }, { status: 500 });
  }
}