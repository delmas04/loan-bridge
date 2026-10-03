import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import {
  finishGuaranteeOutbound,
  getBankTransferAdmin,
  getPaymentProofUrl,
  markRefundable,
  reviewPayment,
  startGuaranteeOutbound,
} from "@/lib/admin-payments.functions";
import { formatDate, formatMoney, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Bank transfers — Credia admin" },
      { name: "description", content: "Verify customer bank transfers, flag mismatches and process guarantee refunds." },
      { property: "og:title", content: "Bank transfers — Credia admin" },
      { property: "og:description", content: "Verify Credia bank transfers and refunds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BankTransfersAdmin,
});

const FLAG_LABELS: Record<string, string> = {
  amount_mismatch: "Wrong amount",
  overpayment: "Wrong amount (over)",
  currency_mismatch: "Wrong currency",
  missing_bank_reference: "Missing reference",
  duplicate_bank_reference: "Duplicate reference",
  possible_duplicate_payment: "Possible duplicate payment",
  unexpected_sender: "Unexpected sender",
  unknown_transaction: "Unknown transaction",
  not_found: "Declared but not found",
};

function BankTransfersAdmin() {
  const { data: session } = useOverview();
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(getBankTransferAdmin);
  const reviewFn = useServerFn(reviewPayment);
  const proofFn = useServerFn(getPaymentProofUrl);
  const refundableFn = useServerFn(markRefundable);
  const startFn = useServerFn(startGuaranteeOutbound);
  const finishFn = useServerFn(finishGuaranteeOutbound);
  const { data, isLoading } = useQuery({ queryKey: ["bank-transfer-admin"], queryFn: () => fetchFn() });

  const [filters, setFilters] = useState({ country: "", currency: "", type: "", status: "", date: "", q: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState({ amount: "", bankRef: "", note: "" });
  const [dest, setDest] = useState({ bank: "", holder: "", account: "", iban: "", bic: "" });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["bank-transfer-admin"] });
    queryClient.invalidateQueries({ queryKey: ["guarantee-admin"] });
  }
  const onError = (e: Error) => toast.error(e.message);

  const review = useMutation({
    mutationFn: (v: { paymentId: string; action: "start_review" | "confirm" | "reject" | "request_information" }) =>
      reviewFn({
        data: {
          ...v,
          verifiedAmount: action.amount ? Number(action.amount) : null,
          bankTransactionReference: action.bankRef || null,
          notes: action.note || null,
          reason: action.note || null,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Payment ${humanise(r.status).toLowerCase()}.`);
      setAction({ amount: "", bankRef: "", note: "" });
      refresh();
    },
    onError,
  });

  const refundable = useMutation({
    mutationFn: (guaranteeId: string) => refundableFn({ data: { guaranteeId } }),
    onSuccess: () => {
      toast.success("Guarantee marked refundable.");
      refresh();
    },
    onError,
  });

  const start = useMutation({
    mutationFn: (v: { kind: "refund" | "release"; guaranteeId: string }) =>
      startFn({
        data: {
          ...v,
          destinationBankName: dest.bank || null,
          destinationAccountHolder: dest.holder || null,
          destinationAccountNumber: dest.account || null,
          destinationIban: dest.iban || null,
          destinationBicSwift: dest.bic || null,
          notes: action.note || null,
        },
      }),
    onSuccess: () => {
      toast.success("Transfer initiated. Confirm it once the bank has sent it.");
      setDest({ bank: "", holder: "", account: "", iban: "", bic: "" });
      refresh();
    },
    onError,
  });

  const finish = useMutation({
    mutationFn: (v: { paymentId: string; outcome: "completed" | "failed" }) =>
      finishFn({ data: { ...v, bankTransactionReference: action.bankRef, notes: action.note || null } }),
    onSuccess: (r) => {
      toast.success(`Transfer ${r.status}.`);
      setAction({ amount: "", bankRef: "", note: "" });
      refresh();
    },
    onError,
  });

  const profiles = data?.profiles ?? [];
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "—" : "—";
  };

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return (data?.payments ?? []).filter((p) => {
      const profile = profiles.find((x) => x.id === p.user_id);
      if (filters.country && profile?.country_id !== filters.country) return false;
      if (filters.currency && p.currency_code !== filters.currency) return false;
      if (filters.type && p.purpose !== filters.type) return false;
      if (filters.status === "mismatch" && (p.mismatch_flags ?? []).length === 0) return false;
      if (filters.status && filters.status !== "mismatch" && p.status !== filters.status) return false;
      if (filters.date && !(p.transfer_date ?? p.created_at).startsWith(filters.date)) return false;
      if (q) {
        const hay = [
          p.payment_reference,
          p.transaction_reference,
          p.bank_transaction_reference,
          p.sender_name,
          profile?.email,
          profile?.first_name,
          profile?.last_name,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, filters, profiles]);

  const currencies = [...new Set((data?.payments ?? []).map((p) => p.currency_code))];
  const stats = data?.stats;
  const guarantees = data?.guarantees ?? [];
  const appOf = (id: string | null) => (data?.applications ?? []).find((a) => a.id === id);
  const refundCandidates = guarantees.filter(
    (g) =>
      ["eligible_for_refund", "eligible_for_release"].includes(g.status) ||
      (["received", "locked", "payment_processing"].includes(g.status) &&
        Number(g.received_amount) > 0 &&
        ["rejected", "cancelled"].includes(appOf(g.application_id)?.status ?? "")),
  );
  const selectedPayment = (data?.payments ?? []).find((p) => p.id === selected);

  const select = (cls: string, key: keyof typeof filters, opts: [string, string][], all: string) => (
    <select
      className={`h-9 rounded-md border border-input bg-background px-2 text-sm ${cls}`}
      value={filters[key]}
      onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
    >
      <option value="">{all}</option>
      {opts.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Payments · Bank transfers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm a payment only after the funds appear on the Credia bank statement. Proof uploads alone are not
            sufficient.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {[
            ["Pending", stats?.pending],
            ["Declared", stats?.declared],
            ["Under review", stats?.underReview],
            ["Verified", stats?.verified],
            ["Rejected", stats?.rejected],
            ["Refunds pending", stats?.refundsPending],
            ["Releases pending", stats?.releasesPending],
            ["Mismatches", stats?.mismatches],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-serif text-xl font-semibold">{value ?? "—"}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {select("", "country", (data?.countries ?? []).map((c) => [c.id, c.name]), "All countries")}
          {select("", "currency", currencies.map((c) => [c, c]), "All currencies")}
          {select(
            "",
            "type",
            ["guarantee_deposit", "loan_repayment", "guarantee_refund", "guarantee_release", "other"].map((t) => [
              t,
              humanise(t),
            ]),
            "All types",
          )}
          {select(
            "",
            "status",
            [
              ...["pending", "declared", "under_review", "verified", "rejected", "refunded", "failed"].map(
                (s) => [s, humanise(s)] as [string, string],
              ),
              ["mismatch", "Flagged mismatches"],
            ],
            "All statuses",
          )}
          <Input
            type="date"
            className="h-9 w-40"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
          <Input
            className="h-9 w-64"
            placeholder="Customer or reference"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Payment ref.</th>
                <th className="px-3 py-2">Bank ref.</th>
                <th className="px-3 py-2">Transfer date</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={`cursor-pointer hover:bg-secondary/40 ${selected === p.id ? "bg-secondary/60" : ""}`}
                  onClick={() => {
                    setSelected(p.id);
                    setAction({ amount: String(p.amount), bankRef: p.bank_transaction_reference ?? "", note: "" });
                  }}
                >
                  <td className="px-3 py-2">{nameOf(p.user_id)}</td>
                  <td className="px-3 py-2">
                    {humanise(p.purpose)}
                    {p.direction === "outbound" ? " ↗" : ""}
                  </td>
                  <td className="px-3 py-2">
                    {formatMoney(p.amount, p.currency_code)}
                    {p.declared_currency && p.declared_currency !== p.currency_code ? (
                      <span className="text-xs text-destructive"> ({p.declared_currency})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.payment_reference ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.bank_transaction_reference ?? "—"}</td>
                  <td className="px-3 py-2">{formatDate(p.transfer_date)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(p.mismatch_flags ?? []).map((f) => (
                        <span key={f} className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">
                          {FLAG_LABELS[f] ?? humanise(f)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-muted-foreground">
                    No transfers match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedPayment ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold">
                {selectedPayment.payment_reference ?? selectedPayment.transaction_reference}
              </h2>
              <StatusBadge status={selectedPayment.status} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {[
                ["Customer", nameOf(selectedPayment.user_id)],
                ["Type", humanise(selectedPayment.purpose)],
                ["Declared amount", formatMoney(selectedPayment.declared_amount ?? selectedPayment.amount, selectedPayment.declared_currency ?? selectedPayment.currency_code)],
                ["Expected", formatMoney((selectedPayment.metadata as { expected_amount?: number } | null)?.expected_amount ?? null, selectedPayment.currency_code)],
                ["Sender", selectedPayment.sender_name ?? "—"],
                ["Sender bank", selectedPayment.sender_bank_name ?? "—"],
                ["Declared", formatDate(selectedPayment.declared_at)],
                ["Verified", formatDate(selectedPayment.verified_at)],
                ["Notes", selectedPayment.review_notes ?? selectedPayment.rejection_reason ?? "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {selectedPayment.proof_file_path ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const { url } = await proofFn({ data: { paymentId: selectedPayment.id } });
                    window.open(url, "_blank", "noopener");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                View proof of payment
              </Button>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Amount actually received / sent</span>
                <Input type="number" value={action.amount} onChange={(e) => setAction({ ...action, amount: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Bank statement reference</span>
                <Input value={action.bankRef} onChange={(e) => setAction({ ...action, bankRef: e.target.value })} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Note / reason</span>
                <Input value={action.note} onChange={(e) => setAction({ ...action, note: e.target.value })} />
              </label>
            </div>

            {selectedPayment.direction === "inbound" &&
            ["pending", "declared", "under_review", "processing"].includes(selectedPayment.status) ? (
              <div className="flex flex-wrap gap-2">
                {selectedPayment.status === "declared" ? (
                  <Button
                    variant="secondary"
                    onClick={() => review.mutate({ paymentId: selectedPayment.id, action: "start_review" })}
                  >
                    Start review
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    if ((selectedPayment.mismatch_flags ?? []).length > 0 && !confirm("This payment is flagged. Confirm you verified the funds on the bank statement?")) return;
                    review.mutate({ paymentId: selectedPayment.id, action: "confirm" });
                  }}
                  disabled={review.isPending}
                >
                  Confirm payment received
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => review.mutate({ paymentId: selectedPayment.id, action: "request_information" })}
                >
                  Request information
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => review.mutate({ paymentId: selectedPayment.id, action: "reject" })}
                >
                  Reject
                </Button>
              </div>
            ) : null}

            {selectedPayment.direction === "outbound" && ["pending", "processing"].includes(selectedPayment.status) ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => finish.mutate({ paymentId: selectedPayment.id, outcome: "completed" })}>
                  Confirm transfer sent
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => finish.mutate({ paymentId: selectedPayment.id, outcome: "failed" })}
                >
                  Mark failed
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">Guarantee refunds &amp; releases</h2>
          <div className="grid gap-3 sm:grid-cols-5">
            {(
              [
                ["bank", "Destination bank"],
                ["holder", "Account holder"],
                ["account", "Account number"],
                ["iban", "IBAN"],
                ["bic", "BIC / SWIFT"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="space-y-1 text-sm">
                <span className="font-medium">{l}</span>
                <Input value={dest[k]} onChange={(e) => setDest({ ...dest, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <ul className="divide-y divide-border text-sm">
            {refundCandidates.length === 0 ? (
              <li className="py-2 text-muted-foreground">No guarantees awaiting refund or release.</li>
            ) : null}
            {refundCandidates.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {appOf(g.application_id)?.reference ?? "—"} · {nameOf(g.user_id)} ·{" "}
                  {formatMoney(Number(g.received_amount) - Number(g.refunded_amount), g.currency_code)}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={g.status} />
                  {g.status === "eligible_for_refund" ? (
                    <Button size="sm" onClick={() => start.mutate({ kind: "refund", guaranteeId: g.id })}>
                      Initiate refund
                    </Button>
                  ) : g.status === "eligible_for_release" ? (
                    <Button size="sm" onClick={() => start.mutate({ kind: "release", guaranteeId: g.id })}>
                      Initiate release
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => refundable.mutate(g.id)}>
                      Mark refundable
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            After initiating, select the outbound transfer in the table above and confirm it once your bank has sent
            it.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
