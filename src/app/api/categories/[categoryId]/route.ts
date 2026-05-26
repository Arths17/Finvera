import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    categoryId: string;
  }>;
};

type CategoryResponse = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  transactionCount: number;
  budgetCount: number;
};

function serializeCategory(category: Awaited<ReturnType<typeof prisma.category.findFirst>> & Record<string, never>) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    transactionCount: category._count.transactions,
    budgetCount: category._count.budgets
  } satisfies CategoryResponse;
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return session.user.id;
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryId } = await context.params;
  const existingCategory = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId
    }
  });

  if (!existingCategory) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload" }, { status: 400 });
  }

  const duplicateCategory = await prisma.category.findFirst({
    where: {
      userId,
      name: parsed.data.name,
      NOT: {
        id: categoryId
      }
    }
  });

  if (duplicateCategory) {
    return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
  }

  const category = await prisma.category.update({
    where: {
      id: categoryId
    },
    data: {
      name: parsed.data.name
    },
    include: {
      _count: {
        select: {
          transactions: true,
          budgets: true
        }
      }
    }
  });

  return NextResponse.json({ category: serializeCategory(category) });
}

export async function DELETE(_: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryId } = await context.params;
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId
    },
    include: {
      _count: {
        select: {
          transactions: true,
          budgets: true
        }
      }
    }
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (category._count.transactions > 0 || category._count.budgets > 0) {
    return NextResponse.json(
      {
        error: "Delete linked transactions and budgets before removing this category"
      },
      { status: 409 }
    );
  }

  await prisma.category.delete({
    where: {
      id: categoryId
    }
  });

  return NextResponse.json({ success: true });
}