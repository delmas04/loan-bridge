import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import {
  decideKyc,
  getCustomerDossier,
  getSignedDocumentUrl,
  reviewDocument,
  setAccountStatus,
} from "@/lib/admin.functions";
import { documentLabel, formatDate, formatDateTime, formatMoney, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/customers/$userId")({
  head: () => ({
    meta: [
      { title: "Customer dossier — Credia" },
      { name: "description", content: "Review a Credia customer's profile, documents, score and lending history." },
      { property: "og:title", content: "Customer dossier — Credia" },
      { property: "og:description", content: "Review a customer's profile, documents, score and lending history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerDossier,
});

const ACCOUNT_STATUSES = ["pending_verification", "verified", "suspended", "blocked", "rejected"] as const;

function CustomerDossier() {
  const { userId } = Route.useParams();
  const { data: session } = useOverview();
  const queryClient = useQueryClient();

  const dossierFn = useServerFn(getCustomerDossier);
  const docFn = useServerFn(reviewDocument);
  const kycFn = useServerFn(decideKyc);
  const statusFn = useServerFn(setAccountStatus);
  const urlFn = useServerFn(getSignedDocumentUrl);

  const [decisionNotes, setDecisionNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [statusReason, setStatusReason] = useState("");

  const { data, error, isLoading } = useQuery({
    queryKey: ["dossier", userId],
    queryFn: () => dossierFn({ data: { userId } }),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["dossier", userId] });
    queryClient.invalidateQueries({ queryKey: ["kyc-queue"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  }

  const docDecision = useMutation({
    mutationFn: (input: { documentId: string; decision: "approved" | "rejected"; reason?: string }) =>
      docFn({ data: input }),
    onSuccess: () => {
      toast.success("Document decision recorded");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const kycDecision = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      kycFn({
        data: {
          userId,
          decision,
          notes: decisionNotes || null,
          reason: decision === "rejected" ? rejectReason : null,
        },
      }),
    onSuccess: () => {
      toast.success("KYC decision recorded");
      setDecisionNotes("");
      setRejectReason("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const statusChange = useMutation({
    mutationFn: (status: (typeof ACCOUNT_STATUSES)[number]) =>
      statusFn({ data: { userId, status, reason: statusReason || null } }),
    onSuccess: () => {
      toast.success("Account status updated");
      setStatusReason("");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function preview(documentId: string) {
    try {
      const { url } = await urlFn({ data: { documentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document");
    }
  }

  const profile = data?.profile;
  const currency = profile?.income_currency ?? profile?.credit_limit_currency ?? "EUR";

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading dossier…</p> : null}
      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

      {data && profile ? (
        <div className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight">
                {profile.first_name} {profile.last_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.email} · {profile.phone ?? "no phone"} · {profile.country_code ?? "no country"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={profile.account_status} />
              <StatusBadge status={data.kyc?.status ?? "pending"} />
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Date of birth" value={formatDate(profile.date_of_birth)} />
            <Fact label="Employment" value={humanise(profile.employment_status)} />
            <Fact label="Monthly income" value={formatMoney(profile.monthly_income, currency)} />
            <Fact label="Existing debt" value={formatMoney(profile.monthly_debt_payments, currency)} />
            <Fact
              label="Address"
              value={[profile.address_line1, profile.city, profile.postal_code].filter(Boolean).join(", ") || "—"}
            />
            <Fact label="Bank" value={profile.bank_name ?? "—"} />
            <Fact label="Mobile money" value={profile.mobile_money_number ?? "—"} />
            <Fact
              label="Indicative score"
              value={
                data.indicativeScore ? `${data.indicativeScore.score} (${data.indicativeScore.band})` : "—"
              }
            />
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold">Documents</h2>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {data.documents.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                data.documents.map((doc) => (
                  <div key={doc.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-48 flex-1">
                      <p className="text-sm font-medium">{documentLabel(doc.document_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_name} · {formatDateTime(doc.created_at)}
                      </p>
                      {doc.rejection_reason ? (
                        <p className="text-xs text-destructive">{doc.rejection_reason}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={doc.status} />
                    <Button size="sm" variant="ghost" onClick={() => void preview(doc.id)}>
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={docDecision.isPending}
                      onClick={() => docDecision.mutate({ documentId: doc.id, decision: "approved" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={docDecision.isPending}
                      onClick={() => {
                        const reason = window.prompt("Reason for rejecting this document?")?.trim();
                        if (!reason) return;
                        docDecision.mutate({ documentId: doc.id, decision: "rejected", reason });
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-semibold">KYC decision</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Internal notes (not shown to the customer)</Label>
                <Textarea
                  maxLength={1000}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Checks performed, sources verified…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rejection reason (shown to the customer)</Label>
                <Textarea
                  maxLength={500}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Required when rejecting"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={kycDecision.isPending} onClick={() => kycDecision.mutate("approved")}>
                Approve verification
              </Button>
              <Button
                variant="outline"
                disabled={kycDecision.isPending || !rejectReason.trim()}
                onClick={() => kycDecision.mutate("rejected")}
              >
                Reject verification
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-semibold">Account status</h2>
            <div className="mt-4 space-y-1.5">
              <Label>Reason (shown to the customer)</Label>
              <Textarea
                maxLength={500}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Optional context for the change"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {ACCOUNT_STATUSES.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={profile.account_status === status ? "default" : "outline"}
                  disabled={statusChange.isPending}
                  onClick={() => statusChange.mutate(status)}
                >
                  {humanise(status)}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold">Lending history</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Fact label="Applications" value={data.applications.length} />
              <Fact label="Loans" value={data.loans.length} />
              <Fact label="Completed loans" value={profile.successful_loans_count ?? 0} />
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm text-foreground">{value}</p>
    </div>
  );
}
