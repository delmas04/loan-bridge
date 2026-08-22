import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import {
  decideLoanApplication,
  disburseApplication,
  getApplicationDetail,
  manageGuaranteeRelease,
  postRepayment,
  verifyGuaranteeDeposit,
} from "@/lib/admin-lending.functions";
import { documentLabel, formatDate, formatMoney, formatPercent, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/applications/$applicationId")({
  head: () => ({
    meta: [
      { title: "Application review — Credia admin" },
      { name: "description", content: "Review a Credia loan application, its quote, guarantee and repayment record." },
      { property: "og:title", content: "Application review — Credia admin" },
      { property: "og:description", content: "Review a Credia loan application and record a decision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplicationDetail,
});

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5">{children}</div>;
}

const METHODS = ["bank_transfer", "card", "mobile_money", "local_provider"] as const;

function ApplicationDetail() {
  const { applicationId } = useParams({ from: "/_authenticated/admin/applications/$applicationId" });
  const { data: session } = useOverview();
  const queryClient = useQueryClient();

  const fetchDetail = useServerFn(getApplicationDetail);
  const decideFn = useServerFn(decideLoanApplication);
  const verifyFn = useServerFn(verifyGuaranteeDeposit);
  const disburseFn = useServerFn(disburseApplication);
  const repayFn = useServerFn(postRepayment);
  const releaseFn = useServerFn(manageGuaranteeRelease);

  const { data, isLoading, error } = useQuery({
    queryKey: ["application-detail", applicationId],
    queryFn: () => fetchDetail({ data: { applicationId } }),
  });

  const [approvedAmount, setApprovedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayReference, setRepayReference] = useState("");
  const [repayMethod, setRepayMethod] = useState<(typeof METHODS)[number]>("bank_transfer");
  const [installmentId, setInstallmentId] = useState("");

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["application-detail", applicationId] });
    queryClient.invalidateQueries({ queryKey: ["application-queue"] });
    queryClient.invalidateQueries({ queryKey: ["guarantee-admin"] });
  }

  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject" | "request_information") =>
      decideFn({
        data: {
          applicationId,
          decision,
          approvedAmount: approvedAmount ? Number(approvedAmount) : null,
          notes: notes.trim() || null,
          reason: reason.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      setReason("");
      setNotes("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verify = useMutation({
    mutationFn: (paymentId: string) =>
      verifyFn({ data: { paymentId, providerReference: providerReference.trim() } }),
    onSuccess: () => {
      toast.success("Guarantee deposit confirmed.");
      setProviderReference("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disburse = useMutation({
    mutationFn: () => disburseFn({ data: { applicationId } }),
    onSuccess: () => {
      toast.success("Loan disbursed and repayment schedule generated.");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const repay = useMutation({
    mutationFn: () =>
      repayFn({
        data: {
          installmentId,
          amount: Number(repayAmount),
          providerReference: repayReference.trim(),
          method: repayMethod,
        },
      }),
    onSuccess: () => {
      toast.success("Repayment recorded.");
      setRepayAmount("");
      setRepayReference("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const release = useMutation({
    mutationFn: (action: "start_release" | "confirm_release") =>
      releaseFn({
        data: {
          guaranteeId: data!.guarantee!.id,
          action,
          providerReference: providerReference.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Guarantee updated.");
      setProviderReference("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
        <p className="text-sm text-destructive">{(error as Error)?.message ?? "Application not found."}</p>
      </AppShell>
    );
  }

  const app = data.application;
  const c = app.currency_code;
  const guarantee = data.guarantee;
  const pendingDeposit = data.payments.find(
    (p) => p.purpose === "guarantee_deposit" && p.application_id === app.id && p.status !== "successful",
  );
  const openInstallments = data.installments.filter((i) => i.status !== "paid");

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{app.reference}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.product?.name ?? "Loan"} · submitted {formatDate(app.submitted_at ?? app.created_at)} · SLA{" "}
              {formatDate(app.sla_due_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={app.status} />
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/customers/$userId" params={{ userId: app.user_id }}>
                Customer dossier
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-serif text-lg font-semibold">Requested terms</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Requested", formatMoney(app.requested_amount, c)],
                ["Approved", app.approved_amount ? formatMoney(app.approved_amount, c) : "—"],
                ["Duration", `${app.duration_months} months`],
                ["Frequency", humanise(app.repayment_frequency)],
                ["Interest", formatPercent(app.annual_interest_rate)],
                ["Installment", app.installment_amount ? formatMoney(app.installment_amount, c) : "—"],
                ["Total repayable", app.total_repayable ? formatMoney(app.total_repayable, c) : "—"],
                ["Purpose", humanise(app.purpose)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <h2 className="font-serif text-lg font-semibold">Affordability & identity</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Declared income", formatMoney(app.declared_monthly_income, c)],
                ["Declared expenses", formatMoney(app.declared_monthly_expenses, c)],
                ["Declared debt", formatMoney(app.declared_monthly_debt, c)],
                ["Employment", humanise(app.employment_status)],
                ["Employer", app.employer_name ?? "—"],
                ["KYC", humanise(data.kyc?.status ?? "not_started")],
                ["Credit score", data.profile?.credit_score ? String(data.profile.credit_score) : "—"],
                ["Account status", humanise(data.profile?.account_status ?? "")],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {app.other_obligations ? (
              <p className="mt-3 rounded-md bg-secondary p-3 text-sm text-muted-foreground">{app.other_obligations}</p>
            ) : null}
          </Card>
        </div>

        <Card>
          <h2 className="font-serif text-lg font-semibold">Documents</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{documentLabel(doc.document_type)}</span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={doc.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                </span>
              </li>
            ))}
            {data.documents.length === 0 ? <li className="py-2 text-muted-foreground">No documents on file.</li> : null}
          </ul>
        </Card>

        <Card>
          <h2 className="font-serif text-lg font-semibold">Decision</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="approved">Approved amount ({c}) — leave blank to keep requested</Label>
              <Input
                id="approved"
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Customer-visible reason</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Internal notes</Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => decide.mutate("approve")} disabled={decide.isPending}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => decide.mutate("request_information")} disabled={decide.isPending}>
              Request information
            </Button>
            <Button variant="destructive" onClick={() => decide.mutate("reject")} disabled={decide.isPending}>
              Reject
            </Button>
          </div>
          {data.decisions.length > 0 ? (
            <ul className="mt-4 divide-y divide-border text-sm">
              {data.decisions.map((decision) => (
                <li key={decision.id} className="py-2">
                  <span className="font-medium">{humanise(decision.decision)}</span>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(decision.created_at)}
                    {decision.notes ? ` · ${decision.notes}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {guarantee ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold">Guarantee</h2>
              <StatusBadge status={guarantee.status} />
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Required", formatMoney(guarantee.required_amount, guarantee.currency_code)],
                ["Received", formatMoney(guarantee.received_amount, guarantee.currency_code)],
                ["Refunded", formatMoney(guarantee.refunded_amount, guarantee.currency_code)],
                ["Claimed", formatMoney(guarantee.claimed_amount, guarantee.currency_code)],
                ["Locked", formatDate(guarantee.locked_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 space-y-3 rounded-md bg-secondary/50 p-4">
              <div className="space-y-2">
                <Label htmlFor="provider-ref">Provider reference</Label>
                <Input
                  id="provider-ref"
                  value={providerReference}
                  onChange={(e) => setProviderReference(e.target.value)}
                  placeholder="Bank or provider transaction reference"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingDeposit ? (
                  <Button size="sm" onClick={() => verify.mutate(pendingDeposit.id)} disabled={verify.isPending}>
                    Confirm deposit {pendingDeposit.transaction_reference}
                  </Button>
                ) : null}
                {guarantee.status === "eligible_for_release" ? (
                  <Button size="sm" variant="secondary" onClick={() => release.mutate("start_release")}>
                    Start release
                  </Button>
                ) : null}
                {guarantee.status === "release_pending" ? (
                  <Button size="sm" onClick={() => release.mutate("confirm_release")}>
                    Confirm release
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Guarantee funds are a customer liability held separately from repayments — never recognised as revenue.
              </p>
            </div>

            {data.transactions.length > 0 ? (
              <ul className="mt-4 divide-y divide-border text-sm">
                {data.transactions.map((tx) => (
                  <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {humanise(tx.transaction_type)}
                      {tx.notes ? <span className="text-muted-foreground"> · {tx.notes}</span> : null}
                    </span>
                    <span className="flex items-center gap-3">
                      {formatMoney(tx.amount, tx.currency_code)}
                      <StatusBadge status={tx.status} />
                      <span className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg font-semibold">Contract & disbursement</h2>
            {data.contract ? <StatusBadge status={data.contract.status} /> : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.contract
              ? `Contract version ${data.contract.version} · ${
                  data.contract.accepted_at ? `accepted ${formatDate(data.contract.accepted_at)}` : "awaiting customer signature"
                }`
              : "A contract is generated once the guarantee deposit is confirmed."}
          </p>
          {app.status === "ready_for_disbursement" ? (
            <Button className="mt-3" onClick={() => disburse.mutate()} disabled={disburse.isPending}>
              {disburse.isPending ? "Disbursing…" : "Disburse loan"}
            </Button>
          ) : null}
        </Card>

        {data.loan ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold">Loan {data.loan.reference}</h2>
              <div className="flex items-center gap-2">
                <StatusBadge status={data.loan.risk_status} />
                <StatusBadge status={data.loan.status} />
              </div>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Principal", formatMoney(data.loan.principal_amount, c)],
                ["Paid", formatMoney(data.loan.amount_paid, c)],
                ["Outstanding", formatMoney(data.loan.outstanding_balance, c)],
                ["Days overdue", String(data.loan.days_overdue)],
                ["Final due", formatDate(data.loan.final_due_date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.installments.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">{row.installment_number}</td>
                      <td className="px-3 py-2">{formatDate(row.due_date)}</td>
                      <td className="px-3 py-2">{formatMoney(row.total_payment, c)}</td>
                      <td className="px-3 py-2">{formatMoney(row.amount_paid, c)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {openInstallments.length > 0 ? (
              <div className="mt-4 grid gap-3 rounded-md bg-secondary/50 p-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="installment">Installment</Label>
                  <select
                    id="installment"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={installmentId}
                    onChange={(e) => setInstallmentId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {openInstallments.map((row) => (
                      <option key={row.id} value={row.id}>
                        #{row.installment_number} · {formatDate(row.due_date)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repay-amount">Amount ({c})</Label>
                  <Input
                    id="repay-amount"
                    type="number"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repay-ref">Provider reference</Label>
                  <Input
                    id="repay-ref"
                    value={repayReference}
                    onChange={(e) => setRepayReference(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repay-method">Method</Label>
                  <select
                    id="repay-method"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={repayMethod}
                    onChange={(e) => setRepayMethod(e.target.value as (typeof METHODS)[number])}
                  >
                    {METHODS.map((option) => (
                      <option key={option} value={option}>
                        {humanise(option)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <Button
                    size="sm"
                    onClick={() => repay.mutate()}
                    disabled={repay.isPending || !installmentId || !repayAmount || repayReference.length < 3}
                  >
                    {repay.isPending ? "Recording…" : "Record repayment"}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
