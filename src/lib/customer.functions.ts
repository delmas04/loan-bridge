import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(24),
  country_id: z.string().uuid(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address_line1: z.string().trim().max(160).nullish(),
  address_line2: z.string().trim().max(160).nullish(),
  city: z.string().trim().max(80).nullish(),
  postal_code: z.string().trim().max(24).nullish(),
  employment_status: z.string().trim().max(40).nullish(),
  employer_name: z.string().trim().max(120).nullish(),
  monthly_income: z.number().nonnegative().max(1_000_000_000).nullish(),
  monthly_debt_payments: z.number().nonnegative().max(1_000_000_000).nullish(),
  bank_name: z.string().trim().max(120).nullish(),
  bank_account_name: z.string().trim().max(120).nullish(),
  bank_account_number: z.string().trim().max(64).nullish(),
  mobile_money_number: z.string().trim().max(32).nullish(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const getReferenceData = createServerFn({ method: "GET" }).handler(async () => {
  const { loadReferenceData } = await import("./customer.server");
  return loadReferenceData();
});

export const getMyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCustomerOverview } = await import("./customer.server");
    return loadCustomerOverview(context.supabase, context.userId);
  });

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { persistProfile } = await import("./customer.server");
    return persistProfile(context.supabase, context.userId, data);
  });

export const submitKycForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { submitKyc } = await import("./customer.server");
    return submitKyc(context.supabase, context.userId);
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { markRead } = await import("./customer.server");
    return markRead(context.supabase, data.id);
  });
