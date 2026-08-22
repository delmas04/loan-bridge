import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { supabase } from "@/integrations/supabase/client";
import { deleteDocument, getMyDocumentUrl, recordDocument } from "@/lib/kyc.functions";
import { submitKycForReview } from "@/lib/customer.functions";
import { documentLabel, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Identity verification — Credia" },
      { name: "description", content: "Upload your identity, address and income documents for Credia verification." },
      { property: "og:title", content: "Identity verification — Credia" },
      { property: "og:description", content: "Upload your identity, address and income documents for verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentsPage,
});

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function DocumentsPage() {
  const { data } = useOverview();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  const recordFn = useServerFn(recordDocument);
  const deleteFn = useServerFn(deleteDocument);
  const urlFn = useServerFn(getMyDocumentUrl);
  const submitFn = useServerFn(submitKycForReview);

  const required = data?.requiredDocuments ?? [];
  const kycStatus = data?.kyc?.status ?? "pending";
  const locked = kycStatus === "approved" || kycStatus === "under_review";

  const submit = useMutation({
    mutationFn: () => submitFn(),
    onSuccess: () => {
      toast.success("Submitted for review");
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not submit"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Document removed");
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove"),
  });

  async function handleUpload(type: string, file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Upload a JPG, PNG, WebP or PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Files must be 10 MB or smaller.");
      return;
    }
    const userId = data?.profile?.id;
    if (!userId) return;

    setUploading(type);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
      const path = `${userId}/${type}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      await recordFn({
        data: {
          document_type: type as never,
          file_path: path,
          file_name: file.name.slice(0, 200),
          mime_type: file.type,
          file_size: file.size,
        },
      });
      toast.success(`${documentLabel(type)} uploaded`);
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function preview(id: string) {
    try {
      const { url } = await urlFn({ data: { id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open document");
    }
  }

  const docsByType = new Map<string, NonNullable<typeof data>["documents"]>();
  for (const doc of data?.documents ?? []) {
    const list = docsByType.get(doc.document_type) ?? [];
    list.push(doc);
    docsByType.set(doc.document_type, list);
  }

  const satisfied = required.every((type) =>
    (docsByType.get(type) ?? []).some((d) => d.status !== "rejected" && d.status !== "expired"),
  );

  return (
    <AppShell isStaff={isStaffRoles(data?.roles)} email={data?.profile?.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Identity verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Documents are stored in a private vault. Only Credia compliance staff can open them, and every view is
            recorded in the audit trail.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={kycStatus} />
            {data?.kyc?.rejection_reason ? (
              <span className="text-sm text-destructive">{data.kyc.rejection_reason}</span>
            ) : null}
          </div>
        </div>

        {required.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Set your country of residence in your profile to see which documents are required for your market.
          </p>
        ) : null}

        <div className="space-y-4">
          {required.map((type) => {
            const docs = docsByType.get(type) ?? [];
            return (
              <section key={type} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-foreground">{documentLabel(type)}</h2>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP or PDF · up to 10 MB</p>
                  </div>
                  {!locked ? (
                    <div>
                      <Label htmlFor={`file-${type}`} className="sr-only">
                        Upload {documentLabel(type)}
                      </Label>
                      <input
                        id={`file-${type}`}
                        type="file"
                        accept={ACCEPTED.join(",")}
                        disabled={uploading === type}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleUpload(type, file);
                          event.target.value = "";
                        }}
                        className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                      />
                    </div>
                  ) : null}
                </div>

                {docs.length > 0 ? (
                  <ul className="mt-4 divide-y divide-border border-t border-border">
                    {docs.map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                        <span className="flex-1 text-sm">{doc.file_name}</span>
                        <StatusBadge status={doc.status} />
                        <span className="text-xs text-muted-foreground">{formatDateTime(doc.created_at)}</span>
                        <Button size="sm" variant="ghost" onClick={() => void preview(doc.id)}>
                          View
                        </Button>
                        {doc.status !== "approved" && !locked ? (
                          <Button size="sm" variant="ghost" onClick={() => remove.mutate(doc.id)}>
                            Remove
                          </Button>
                        ) : null}
                        {doc.rejection_reason ? (
                          <p className="w-full text-xs text-destructive">{doc.rejection_reason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Not uploaded yet.</p>
                )}
              </section>
            );
          })}
        </div>

        {required.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!satisfied || locked || submit.isPending} onClick={() => submit.mutate()}>
              {kycStatus === "approved"
                ? "Verified"
                : kycStatus === "under_review"
                  ? "Under review"
                  : "Submit for review"}
            </Button>
            {!satisfied ? (
              <span className="text-sm text-muted-foreground">Upload every required document to submit.</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
