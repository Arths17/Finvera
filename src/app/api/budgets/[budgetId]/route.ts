import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getMonthRange } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";
import { budgetUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    budgetId: string;
  }>;
};

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
  budget: Awaited<ReturnType<typeof prisma.budget.findFirst>> & Record<string, never>,
  spentAmount: number
) {
  if (!budget) {
    return null;
  }

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
  } satisfies BudgetResponse;
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

async function getSpentAmount(userId: string, categoryId: string, month: number, year: number) {
  const { start, end } = getMonthRange(year, month);

  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: "EXPENSE",
      categoryId,
      occurredAt: {
        gte: start,
        lt: end
      }
    },
    _sum: {
      amount: true
    }
  });

  return Number(result._sum.amount ?? 0);
}

export async function PUT(request: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { budgetId } = await context.params;
  const existingBudget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      userId
    }
  });

  if (!existingBudget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = budgetUpdateSchema.safeParse(body);

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
      year: parsed.data.year,
      NOT: {
        id: budgetId
      }
    }
  });

  if (duplicateBudget) {
    return NextResponse.json({ error: "A budget already exists for this category and month" }, { status: 409 });
  }

  const budget = await prisma.budget.update({
    where: {
      id: budgetId
    },
    data: {
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

  const spentAmount = await getSpentAmount(userId, budget.categoryId, budget.month, budget.year);

  return NextResponse.json({ budget: serializeBudget(budget, spentAmount) });
}

export async function DELETE(_: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { budgetId } = await context.params;
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      userId
    },
    select: {
      id: true
    }
  });

  if (!budget) {
    return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  }

  await prisma.budget.delete({
    where: {
      id: budgetId
    }
  });

  return NextResponse.json({ success: true });
}