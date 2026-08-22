import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const documentSchema = z.object({
  document_type: z.enum([
    "government_id",
    "selfie",
    "proof_of_address",
    "proof_of_income",
    "bank_account",
    "mobile_money_account",
    "employment_proof",
    "other",
  ]),
  file_path: z.string().trim().min(1).max(400),
  file_name: z.string().trim().min(1).max(200),
  mime_type: z.string().trim().max(120),
  file_size: z.number().int().positive().max(15 * 1024 * 1024),
});

export const recordDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => documentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { saveDocumentRecord } = await import("./kyc.server");
    return saveDocumentRecord(context.supabase, context.userId, data);
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { removeDocument } = await import("./kyc.server");
    return removeDocument(context.supabase, context.userId, data.id);
  });

export const getMyDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { signOwnDocument } = await import("./kyc.server");
    return signOwnDocument(context.supabase, context.userId, data.id);
  });
