import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadAdminOverview } = await import("./admin.server");
    return loadAdminOverview(context.supabase, context.userId);
  });

export const getKycQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadKycQueue } = await import("./admin.server");
    return loadKycQueue(context.supabase, context.userId);
  });

export const getCustomerDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadDossier } = await import("./admin.server");
    return loadDossier(context.supabase, context.userId, data.userId);
  });

export const reviewDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        documentId: uuid,
        decision: z.enum(["approved", "rejected", "under_review", "expired"]),
        reason: z.string().trim().max(500).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { decideDocument } = await import("./admin.server");
    return decideDocument(context.supabase, context.userId, data);
  });

export const decideKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: uuid,
        decision: z.enum(["approved", "rejected"]),
        notes: z.string().trim().max(1000).nullish(),
        reason: z.string().trim().max(500).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { applyKycDecision } = await import("./admin.server");
    return applyKycDecision(context.supabase, context.userId, data);
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: uuid,
        status: z.enum(["pending_verification", "verified", "rejected", "suspended", "blocked"]),
        reason: z.string().trim().max(500).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { applyAccountStatus } = await import("./admin.server");
    return applyAccountStatus(context.supabase, context.userId, data);
  });

export const getSignedDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ documentId: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { signDocument } = await import("./admin.server");
    return signDocument(context.supabase, context.userId, data.documentId);
  });
