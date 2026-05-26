import CategoriesManager from "@/components/categories/categories-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Category = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  transactionCount: number;
  budgetCount: number;
};

export default async function CategoriesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const categories = await prisma.category.findMany({
    where: {
      userId: session.user.id
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

  const serializedCategories: Category[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    transactionCount: category._count.transactions,
    budgetCount: category._count.budgets
  }));

  return <CategoriesManager initialCategories={serializedCategories} />;
}