import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TransactionsManager from "@/components/transactions/transactions-manager";

type SerializedTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string | null;
  merchant: string | null;
  occurredAt: string;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
};

type SerializedCategory = {
  id: string;
  name: string;
};

type TransactionsPageProps = {
  searchParams?: {
    categoryId?: string | string[];
  };
};

function serializeTransaction(transaction: Awaited<ReturnType<typeof prisma.transaction.findMany>>[number]): SerializedTransaction {
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

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
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

  const requestedCategoryId = getQueryValue(searchParams?.categoryId);
  const selectedCategoryId = categories.some((category) => category.id === requestedCategoryId)
    ? requestedCategoryId
    : "";

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: session.user.id,
      ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {})
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

  return (
    <TransactionsManager
      initialTransactions={transactions.map(serializeTransaction)}
      categories={categories as SerializedCategory[]}
      selectedCategoryId={selectedCategoryId}
    />
  );
}