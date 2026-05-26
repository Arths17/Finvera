import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transactionUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

function mapTransaction(transaction: Awaited<ReturnType<typeof prisma.transaction.findFirst>> & Record<string, never>) {
  if (!transaction) {
    return null;
  }

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

export async function GET(_: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionId } = await context.params;

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId
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

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ transaction: mapTransaction(transaction) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionId } = await context.params;
  const existingTransaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId
    }
  });

  if (!existingTransaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = transactionUpdateSchema.safeParse(body);

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

  const transaction = await prisma.transaction.update({
    where: {
      id: transactionId
    },
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount !== undefined ? new Prisma.Decimal(parsed.data.amount) : undefined,
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

  return NextResponse.json({ transaction: mapTransaction(transaction) });
}

export async function DELETE(_: Request, context: RouteContext) {
  const userId = await requireUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transactionId } = await context.params;
  const existingTransaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId
    },
    select: {
      id: true
    }
  });

  if (!existingTransaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  await prisma.transaction.delete({
    where: {
      id: transactionId
    }
  });

  return NextResponse.json({ success: true });
}