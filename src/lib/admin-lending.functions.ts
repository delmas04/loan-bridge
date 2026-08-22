import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

const productSchema = z.object({
  id: uuid.nullish(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullish(),
  country_id: uuid,
  currency_code: z.string().trim().min(3).max(3),
  min_amount: z.number().positive().max(1_000_000_000),
  max_amount: z.number().positive().max(1_000_000_000),
  min_duration_months: z.number().int().min(1).max(120),
  max_duration_months: z.number().int().min(1).max(120),
  annual_interest_rate: z.number().min(0).max(2),
  origination_fee_rate: z.number().min(0).max(1),
  guarantee_percentage: z.number().min(0).max(1),
  allowed_frequencies: z.array(z.enum(["weekly", "biweekly", "monthly"])).min(1),
  required_documents: z.array(z.string().trim().min(1).max(60)),
  eligibility_requirements: z.array(z.string().trim().min(1).max(200)),
  processing_time: z.string().trim().min(2).max(120),
  is_active: z.boolean(),
});

export const getProductAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadProductAdmin } = await import("./admin-lending.server");
    return loadProductAdmin(context.supabase, context.userId);
  });

export const upsertLoanProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => productSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { saveProduct } = await import("./admin-lending.server");
    return saveProduct(context.supabase, context.userId, data);
  });

export const setProductActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: uuid, isActive: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { toggleProduct } = await import("./admin-lending.server");
    return toggleProduct(context.supabase, context.userId, data.id, data.isActive);
  });

export const getApplicationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadApplicationQueue } = await import("./admin-lending.server");
    return loadApplicationQueue(context.supabase, context.userId);
  });

export const getApplicationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ applicationId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadApplicationDetail } = await import("./admin-lending.server");
    return loadApplicationDetail(context.supabase, context.userId, data.applicationId);
  });

export const decideLoanApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: uuid,
        decision: z.enum(["approve", "reject", "request_information"]),
        approvedAmount: z.number().positive().max(1_000_000_000).nullish(),
        notes: z.string().trim().max(1000).nullish(),
        reason: z.string().trim().max(1000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideApplication } = await import("./admin-lending.server");
    return decideApplication(context.supabase, context.userId, data);
  });

export const verifyGuaranteeDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        paymentId: uuid,
        providerReference: z.string().trim().min(3).max(120),
        amount: z.number().positive().max(1_000_000_000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { confirmGuaranteeDeposit } = await import("./admin-lending.server");
    return confirmGuaranteeDeposit(context.supabase, context.userId, data);
  });

export const disburseApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ applicationId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { disburseLoan } = await import("./admin-lending.server");
    return disburseLoan(context.supabase, context.userId, data.applicationId);
  });

export const postRepayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        installmentId: uuid,
        amount: z.number().positive().max(1_000_000_000),
        providerReference: z.string().trim().min(3).max(120),
        method: z.enum(["bank_transfer", "card", "mobile_money", "local_provider"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { recordRepayment } = await import("./admin-lending.server");
    return recordRepayment(context.supabase, context.userId, data);
  });

export const manageGuaranteeRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        guaranteeId: uuid,
        action: z.enum(["start_release", "confirm_release"]),
        providerReference: z.string().trim().max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { releaseGuarantee } = await import("./admin-lending.server");
    return releaseGuarantee(context.supabase, context.userId, data);
  });

export const getGuaranteeAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadGuaranteeAdmin } = await import("./admin-lending.server");
    return loadGuaranteeAdmin(context.supabase, context.userId);
  });
