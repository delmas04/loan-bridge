import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();
const opt = (max: number) => z.string().trim().max(max).nullish();

const bankAccountSchema = z.object({
  id: uuid.nullish(),
  country_id: uuid.nullish(),
  currency_code: z.string().trim().length(3),
  label: opt(120),
  bank_name: z.string().trim().min(2).max(160),
  account_holder_name: z.string().trim().min(2).max(160),
  account_number: opt(60),
  iban: opt(40),
  bic_swift: opt(20),
  bank_address: opt(300),
  payment_instructions: z.string().trim().max(2000),
  display_order: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

export const getBankAccountAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadBankAccountAdmin } = await import("./admin-payments.server");
    return loadBankAccountAdmin(context.supabase, context.userId);
  });

export const upsertBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bankAccountSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { saveBankAccount } = await import("./admin-payments.server");
    return saveBankAccount(context.supabase, context.userId, data);
  });

export const setBankAccountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid, isActive: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { toggleBankAccount } = await import("./admin-payments.server");
    return toggleBankAccount(context.supabase, context.userId, data.id, data.isActive);
  });

export const getBankTransferAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadBankTransferAdmin } = await import("./admin-payments.server");
    return loadBankTransferAdmin(context.supabase, context.userId);
  });

export const getPaymentProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ paymentId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { signPaymentProof } = await import("./admin-payments.server");
    return signPaymentProof(context.supabase, context.userId, data.paymentId);
  });

export const reviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        paymentId: uuid,
        action: z.enum(["start_review", "confirm", "reject", "request_information"]),
        verifiedAmount: z.number().positive().max(1_000_000_000).nullish(),
        bankTransactionReference: opt(120),
        notes: opt(1000),
        reason: opt(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { reviewBankTransfer } = await import("./admin-payments.server");
    return reviewBankTransfer(context.supabase, context.userId, data);
  });

export const markRefundable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ guaranteeId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { markGuaranteeRefundable } = await import("./admin-payments.server");
    return markGuaranteeRefundable(context.supabase, context.userId, data.guaranteeId);
  });

export const startGuaranteeOutbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        kind: z.enum(["refund", "release"]),
        guaranteeId: uuid,
        destinationBankName: opt(160),
        destinationAccountHolder: opt(160),
        destinationAccountNumber: opt(60),
        destinationIban: opt(40),
        destinationBicSwift: opt(20),
        notes: opt(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { initiateGuaranteeOutbound } = await import("./admin-payments.server");
    const { kind, ...rest } = data;
    return initiateGuaranteeOutbound(context.supabase, context.userId, kind, rest);
  });

export const finishGuaranteeOutbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        paymentId: uuid,
        bankTransactionReference: z.string().trim().max(120),
        outcome: z.enum(["completed", "failed"]),
        notes: opt(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { completeGuaranteeOutbound } = await import("./admin-payments.server");
    return completeGuaranteeOutbound(context.supabase, context.userId, {
      ...data,
      notes: data.notes ?? null,
    });
  });
