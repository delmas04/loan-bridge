import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { useContracts, useLending } from "@/hooks/use-lending";
import { acceptLoanContract } from "@/lib/lending.functions";
import { formatDate, formatMoney, formatPercent, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({
    meta: [
      { title: "My loans — Credia" },
      { name: "description", content: "View your Credia loan applications, contracts and active loans in one place." },
      { property: "og:title", content: "My loans — Credia" },
      { property: "og:description", content: "View your Credia loan applications and active loans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyLoans,
});

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5">{children}</div>;
}

function MyLoans() {
  const { data: session } = useOverview();
  const { data, isLoading } = useLending();
  const { data: contracts } = useContracts();
  const queryClient = useQueryClient();
  const acceptFn = useServerFn(acceptLoanContract);

  const accept = useMutation({
    mutationFn: (contractId: string) => acceptFn({ data: { contractId } }),
    onSuccess: () => {
      toast.success("Contract accepted. Your loan is queued for disbursement.");
      queryClient.invalidateQueries({ queryKey: ["my-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["my-lending"] });
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applications = data?.applications ?? [];
  const loans = data?.loans ?? [];
  const products = data?.products ?? [];
  const pendingContracts = (contracts ?? []).filter((c) => c.status === "pending_acceptance");

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">My loans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Applications, signed contracts and active loans, with the terms Credia priced for you.
            </p>
          </div>
          <Button asChild>
            <Link to="/apply">Apply for a loan</Link>
          </Button>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {pendingContracts.length > 0 ? (
          <Card>
            <h2 className="font-serif text-lg font-semibold">Contract awaiting your signature</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {pendingContracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Contract version {contract.version} · issued {formatDate(contract.created_at)}
                  </span>
                  <Button size="sm" onClick={() => accept.mutate(contract.id)} disabled={accept.isPending}>
                    Accept contract
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {loans.length > 0 ? (
          <div className="space-y-4">
            <h2 className="font-serif text-lg font-semibold">Active and past loans</h2>
            {loans.map((loan) => (
              <Card key={loan.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{loan.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      Disbursed {formatDate(loan.disbursed_at)} · {humanise(loan.repayment_frequency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={loan.risk_status} />
                    <StatusBadge status={loan.status} />
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  {[
                    ["Principal", formatMoney(loan.principal_amount, loan.currency_code)],
                    ["Interest rate", formatPercent(loan.annual_interest_rate)],
                    ["Installment", formatMoney(loan.installment_amount, loan.currency_code)],
                    ["Paid to date", formatMoney(loan.amount_paid, loan.currency_code)],
                    ["Outstanding balance", formatMoney(loan.outstanding_balance, loan.currency_code)],
                    ["Total repayable", formatMoney(loan.total_repayable, loan.currency_code)],
                    ["Final due date", formatDate(loan.final_due_date)],
                    ["Missed installments", String(loan.missed_installments)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Button asChild variant="secondary" size="sm" className="mt-4">
                  <Link to="/repayments">View repayment schedule</Link>
                </Button>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="space-y-4">
          <h2 className="font-serif text-lg font-semibold">Applications</h2>
          {applications.length === 0 && !isLoading ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                You have no applications yet.{" "}
                <Link to="/apply" className="text-primary underline">
                  Start an application
                </Link>
                .
              </p>
            </Card>
          ) : null}
          {applications.map((app) => {
            const product = products.find((p) => p.id === app.product_id);
            return (
              <Card key={app.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {app.reference} · {product?.name ?? "Loan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(app.submitted_at ?? app.created_at)} · {humanise(app.purpose)}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  {[
                    ["Requested", formatMoney(app.requested_amount, app.currency_code)],
                    ["Approved", app.approved_amount ? formatMoney(app.approved_amount, app.currency_code) : "—"],
                    ["Duration", `${app.duration_months} months`],
                    ["Frequency", humanise(app.repayment_frequency)],
                    [
                      "Installment",
                      app.installment_amount ? formatMoney(app.installment_amount, app.currency_code) : "—",
                    ],
                    ["Total repayable", app.total_repayable ? formatMoney(app.total_repayable, app.currency_code) : "—"],
                    ["Guarantee", app.guarantee_amount ? formatMoney(app.guarantee_amount, app.currency_code) : "—"],
                    ["Decision", formatDate(app.decision_at)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                {app.status_reason ? (
                  <p className="mt-3 rounded-md bg-secondary p-3 text-sm text-muted-foreground">{app.status_reason}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
