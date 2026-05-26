import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryCreateSchema } from "@/lib/validators";

type CategoryResponse = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  transactionCount: number;
  budgetCount: number;
};

function serializeCategory(category: Awaited<ReturnType<typeof prisma.category.findMany>>[number]): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    transactionCount: category._count.transactions,
    budgetCount: category._count.budgets
  };
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return session.user.id;
}

export async function GET() {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: {
      userId
    },
    include: {
      _count: {
        select: {
          transactions: true,
          budgets: true
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return NextResponse.json({ categories: categories.map(serializeCategory) });
}

export async function POST(request: Request) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = categoryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload" }, { status: 400 });
  }

  const existingCategory = await prisma.category.findFirst({
    where: {
      userId,
      name: parsed.data.name
    }
  });

  if (existingCategory) {
    return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: {
      userId,
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

  return NextResponse.json({ category: serializeCategory(category) }, { status: 201 });
}