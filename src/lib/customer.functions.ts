import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(24),
  country_id: z.string().uuid(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address_line1: z.string().trim().max(160).optional().nullable(),
  address_line2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  postal_code: z.string().trim().max(24).optional().nullable(),
  employment_status: z.string().trim().max(40).optional().nullable(),
  employer_name: z.string().trim().max(120).optional().nullable(),
  monthly_income: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
  monthly_debt_payments: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
  bank_name: z.string().trim().max(120).optional().nullable(),
  bank_account_name: z.string().trim().max(120).optional().nullable(),
  bank_account_number: z.string().trim().max(64).optional().nullable(),
  mobile_money_number: z.string().trim().max(32).optional().nullable(),
});

export const getReferenceData = createServerFn({ method: "GET" }).handler(async () => {
  const { loadReferenceData } = await import("./customer.server");
  return loadReferenceData();
});

export const getMyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCustomerOverview } = await import("./customer.server");
    return loadCustomerOverview(context.supabase as never, context.userId);
  });

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { persistProfile } = await import("./customer.server");
    return persistProfile(context.supabase as never, context.userId, data);
  });

export const submitKycForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { submitKyc } = await import("./customer.server");
    return submitKyc(context.supabase as never, context.userId);
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as never as ReturnType<typeof Object>)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ["from"]("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
