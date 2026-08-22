import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getGuaranteeAdmin, manageGuaranteeRelease, verifyGuaranteeDeposit } from "@/lib/admin-lending.functions";
import { formatDate, formatMoney, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/guarantees")({
  head: () => ({
    meta: [
      { title: "Guarantee ledger — Credia admin" },
      { name: "description", content: "Reconcile Credia guarantee deposits, locks, refunds and releases." },
      { property: "og:title", content: "Guarantee ledger — Credia admin" },
      { property: "og:description", content: "Reconcile Credia guarantee deposits and releases." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuaranteeAdmin,
});

function GuaranteeAdmin() {
  const { data: session } = useOverview();
  const queryClient = useQueryClient();
  const fetchAdmin = useServerFn(getGuaranteeAdmin);
  const verifyFn = useServerFn(verifyGuaranteeDeposit);
  const releaseFn = useServerFn(manageGuaranteeRelease);
  const [reference, setReference] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["guarantee-admin"], queryFn: () => fetchAdmin() });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["guarantee-admin"] });
    queryClient.invalidateQueries({ queryKey: ["application-queue"] });
  }

  const verify = useMutation({
    mutationFn: (paymentId: string) => verifyFn({ data: { paymentId, providerReference: reference.trim() } }),
    onSuccess: () => {
      toast.success("Deposit confirmed and guarantee locked.");
      setReference("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const release = useMutation({
    mutationFn: (vars: { guaranteeId: string; action: "start_release" | "confirm_release" }) =>
      releaseFn({ data: { ...vars, providerReference: reference.trim() || null } }),
    onSuccess: () => {
      toast.success("Guarantee updated.");
      setReference("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const guarantees = data?.guarantees ?? [];
  const pendingDeposits = (data?.depositPayments ?? []).filter((p) => p.status !== "successful");

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Guarantee ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposits are customer funds held separately from loan revenue. Confirm receipts and process releases here.
          </p>
        </div>

        <div className="max-w-sm space-y-2">
          <label htmlFor="reference" className="text-sm font-medium">
            Provider reference (used for the next action)
          </label>
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">Deposits awaiting confirmation</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {pendingDeposits.map((payment) => {
              const profile = (data?.profiles ?? []).find((p) => p.id === payment.user_id);
              const application = (data?.applications ?? []).find((a) => a.id === payment.application_id);
              return (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{payment.transaction_reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {application?.reference ?? "—"} ·{" "}
                      {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email : "—"} ·{" "}
                      {humanise(payment.payment_method ?? "")} · {formatDate(payment.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatMoney(payment.amount, payment.currency_code)}</span>
                    <StatusBadge status={payment.status} />
                    <Button
                      size="sm"
                      onClick={() => verify.mutate(payment.id)}
                      disabled={verify.isPending || reference.trim().length < 3}
                    >
                      Confirm receipt
                    </Button>
                  </div>
                </li>
              );
            })}
            {pendingDeposits.length === 0 && !isLoading ? (
              <li className="py-3 text-muted-foreground">No deposits awaiting confirmation.</li>
            ) : null}
          </ul>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left">
              <tr>
                <th className="px-3 py-2">Application</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Required</th>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Refunded</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {guarantees.map((guarantee) => {
                const application = (data?.applications ?? []).find((a) => a.id === guarantee.application_id);
                const profile = (data?.profiles ?? []).find((p) => p.id === guarantee.user_id);
                return (
                  <tr key={guarantee.id}>
                    <td className="px-3 py-2">
                      {application ? (
                        <Link
                          to="/admin/applications/$applicationId"
                          params={{ applicationId: application.id }}
                          className="text-primary underline"
                        >
                          {application.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email : "—"}
                    </td>
                    <td className="px-3 py-2">{formatMoney(guarantee.required_amount, guarantee.currency_code)}</td>
                    <td className="px-3 py-2">{formatMoney(guarantee.received_amount, guarantee.currency_code)}</td>
                    <td className="px-3 py-2">{formatMoney(guarantee.refunded_amount, guarantee.currency_code)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={guarantee.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {guarantee.status === "eligible_for_release" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => release.mutate({ guaranteeId: guarantee.id, action: "start_release" })}
                        >
                          Start release
                        </Button>
                      ) : null}
                      {guarantee.status === "release_pending" ? (
                        <Button
                          size="sm"
                          onClick={() => release.mutate({ guaranteeId: guarantee.id, action: "confirm_release" })}
                        >
                          Confirm release
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
