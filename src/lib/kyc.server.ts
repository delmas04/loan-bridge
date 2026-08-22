import { notify, writeAudit } from "./audit.server";
import type { UserClient } from "./customer.server";

export interface DocumentRecord {
  document_type: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
}

/** Records metadata for a file the customer already uploaded to their own storage folder. */
export async function saveDocumentRecord(supabase: UserClient, userId: string, input: DocumentRecord) {
  if (!input.file_path.startsWith(`${userId}/`)) {
    throw new Error("Invalid upload path");
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      document_type: input.document_type,
      file_path: input.file_path,
      file_name: input.file_name,
      mime_type: input.mime_type,
      file_size: input.file_size,
      status: "pending_review",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "document.uploaded",
    entityType: "document",
    entityId: data?.id ?? null,
    after: { document_type: input.document_type, file_name: input.file_name },
  });

  return { ok: true, id: data?.id ?? null };
}

export async function removeDocument(supabase: UserClient, userId: string, id: string) {
  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_path, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!doc) throw new Error("Document not found");
  if (doc.status === "approved") throw new Error("Approved documents cannot be removed.");

  await supabase.storage.from("kyc-documents").remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "document.deleted",
    entityType: "document",
    entityId: id,
    before: doc,
  });

  return { ok: true };
}

export async function signOwnDocument(supabase: UserClient, userId: string, id: string) {
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!doc) throw new Error("Document not found");

  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(doc.file_path, 120);
  if (error || !data) throw new Error(error?.message ?? "Could not create a preview link");
  return { url: data.signedUrl };
}

export async function remindKycPending(userId: string) {
  await notify({
    userId,
    category: "kyc_reminder",
    title: "Finish your verification",
    body: "Upload the remaining documents so we can verify your identity.",
    link: "/documents",
  });
}
