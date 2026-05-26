import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const profileUpdateSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    image: z.string().url().optional()
  })
  .refine((value) => Boolean(value.name || value.image), {
    message: "At least one profile field must be provided"
  });