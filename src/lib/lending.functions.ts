import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

const quoteSchema = z.object({
  productId: uuid,
  amount: z.number().positive().max(1_000_000_000),
  durationMonths: z.number().int().min(1).max(120),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
});

const submitSchema = z.object({
  quoteId: uuid,
  purpose: z.enum(["personal", "education", "business", "medical", "emergency", "home_improvement", "other"]),
  monthlyIncome: z.number().nonnegative().max(1_000_000_000),
  employmentStatus: z.string().trim().min(1).max(40),
  employerName: z.string().trim().max(120).nullish(),
  monthlyExpenses: z.number().nonnegative().max(1_000_000_000),
  existingDebt: z.number().nonnegative().max(1_000_000_000),
  otherObligations: z.string().trim().max(1000).nullish(),
  acceptTerms: z.boolean(),
});

export const getApplyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadApplyContext } = await import("./lending.server");
    return loadApplyContext(context.supabase, context.userId);
  });

export const requestQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => quoteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createQuote } = await import("./lending.server");
    return createQuote(context.supabase, context.userId, data);
  });

export const acceptQuoteAndSubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { submitApplication } = await import("./lending.server");
    const ip =
      getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    return submitApplication(context.supabase, context.userId, { ...data, ip, userAgent });
  });

export const getMyLending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadMyLending } = await import("./lending.server");
    return loadMyLending(context.supabase, context.userId);
  });

export const startGuaranteeDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        guaranteeId: uuid,
        providerId: uuid.nullish(),
        method: z.enum(["bank_transfer", "card", "mobile_money", "local_provider"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { initiateGuaranteeDeposit } = await import("./lending.server");
    return initiateGuaranteeDeposit(context.supabase, context.userId, data);
  });
