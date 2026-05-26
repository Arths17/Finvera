import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transactionCreateSchema } from "@/lib/validators";

function mapTransaction(transaction: Awaited<ReturnType<typeof prisma.transaction.findMany>>[number]) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount.toString(),
    description: transaction.description,
    merchant: transaction.merchant,
    occurredAt: transaction.occurredAt.toISOString(),
    importedAt: transaction.importedAt?.toISOString() ?? null,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    category: {
      id: transaction.category.id,
      name: transaction.category.name
    }
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
  const categoryId = searchParams.get("categoryId") ?? "";
  const ownedCategoryId = categoryId ? await getOwnedCategoryId(userId, categoryId) : null;

  if (categoryId && !ownedCategoryId) {
    return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(ownedCategoryId ? { categoryId: ownedCategoryId } : {})
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
      occurredAt: "desc"
    }
  });

  return NextResponse.json({ transactions: transactions.map(mapTransaction) });
}

export async function POST(request: Request) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = transactionCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid transaction payload",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const ownedCategoryId = await getOwnedCategoryId(userId, parsed.data.categoryId);

  if (!ownedCategoryId) {
    return NextResponse.json({ error: "Category not found" }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: parsed.data.type,
      amount: new Prisma.Decimal(parsed.data.amount),
      description: parsed.data.description,
      merchant: parsed.data.merchant,
      categoryId: ownedCategoryId,
      occurredAt: parsed.data.occurredAt
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

  return NextResponse.json({ transaction: mapTransaction(transaction) }, { status: 201 });
}