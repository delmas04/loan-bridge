import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

const declarationSchema = z.object({
  kind: z.enum(["guarantee", "installment"]),
  targetId: uuid,
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().trim().length(3),
  transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid transfer date."),
  senderName: z.string().trim().min(2).max(160),
  senderBankName: z.string().trim().min(2).max(160),
  bankTransactionReference: z.string().trim().max(120).nullish(),
  bankAccountId: uuid.nullish(),
  proofFilePath: z.string().trim().max(400).nullish(),
});

export const getPaymentCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadPaymentCenter } = await import("./bank-transfer.server");
    return loadPaymentCenter(context.supabase, context.userId);
  });

export const declareBankTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => declarationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { declarePayment } = await import("./bank-transfer.server");
    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    return declarePayment(context.supabase, context.userId, { ...data, ip, userAgent });
  });

export const getMyProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ paymentId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { signOwnProof } = await import("./bank-transfer.server");
    return signOwnProof(context.supabase, context.userId, data.paymentId);
  });
