import { z } from "zod";

const trimOptionalText = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const categoryCreateSchema = z.object({
  name: z.preprocess(trimOptionalText, z.string().min(2).max(80))
});

export const categoryUpdateSchema = categoryCreateSchema;

const monthSchema = z.coerce.number().int().min(1).max(12);
const yearSchema = z.coerce.number().int().min(2000).max(2100);

export const budgetCreateSchema = z.object({
  categoryId: z.preprocess(trimOptionalText, z.string().cuid()),
  limit: z.coerce.number().positive().max(999999999999.99),
  month: monthSchema,
  year: yearSchema
});

export const budgetUpdateSchema = budgetCreateSchema;

export const budgetQuerySchema = z.object({
  month: monthSchema.optional(),
  year: yearSchema.optional()
});

export const profileUpdateSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    image: z.string().url().optional()
  })
  .refine((value) => Boolean(value.name || value.image), {
    message: "At least one profile field must be provided"
  });

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const transactionCreateSchema = z.object({
  type: transactionTypeSchema,
  amount: z.coerce.number().positive().max(999999999999.99),
  description: z.preprocess(trimOptionalText, z.string().max(200).optional()),
  merchant: z.preprocess(trimOptionalText, z.string().max(120).optional()),
  categoryId: z.preprocess(trimOptionalText, z.string().cuid()),
  occurredAt: z.coerce.date()
});

export const transactionUpdateSchema = transactionCreateSchema;