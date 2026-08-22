import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { useLending } from "@/hooks/use-lending";
import { startGuaranteeDeposit } from "@/lib/lending.functions";
import { formatDate, formatMoney, formatPercent, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/guarantee")({
  head: () => ({
    meta: [
      { title: "Guarantee deposits — Credia" },
      {
        name: "description",
        content: "Manage your refundable Credia guarantee deposit, held separately from your loan repayments.",
      },
      { property: "og:title", content: "Guarantee deposits — Credia" },
      { property: "og:description", content: "Manage your refundable Credia guarantee deposit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuaranteePage,
});

const METHODS = ["bank_transfer", "card", "mobile_money", "local_provider"] as const;

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5">{children}</div>;
}

function GuaranteePage() {
  const { data: session } = useOverview();
  const { data, isLoading } = useLending();
  const queryClient = useQueryClient();
  const depositFn = useServerFn(startGuaranteeDeposit);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("bank_transfer");

  const deposit = useMutation({
    mutationFn: (guaranteeId: string) => depositFn({ data: { guaranteeId, method } }),
    onSuccess: (result) => {
      toast.success(
        `Deposit instructions created. Reference ${result.paymentReference} for ${result.amount} ${result.currency}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["my-lending"] });
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const guarantees = data?.guarantees ?? [];
  const transactions = data?.transactions ?? [];
  const applications = data?.applications ?? [];

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Guarantee deposits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your guarantee is a refundable security deposit held separately from your loan. It is never applied to your
            installments and is released once your loan completes.
          </p>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {!isLoading && guarantees.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground">
              No guarantee is required yet. One is created when you submit an application —{" "}
              <Link to="/apply" className="text-primary underline">
                apply for a loan
              </Link>
              .
            </p>
          </Card>
        ) : null}

        {guarantees.map((guarantee) => {
          const application = applications.find((a) => a.id === guarantee.application_id);
          const outstanding = Number(guarantee.required_amount) - Number(guarantee.received_amount);
          const payable = ["required", "payment_pending", "payment_processing"].includes(guarantee.status) && outstanding > 0;
          return (
            <Card key={guarantee.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{application?.reference ?? "Application"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(guarantee.percentage, 0)} of the loan amount · created{" "}
                    {formatDate(guarantee.created_at)}
                  </p>
                </div>
                <StatusBadge status={guarantee.status} />
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["Required", formatMoney(guarantee.required_amount, guarantee.currency_code)],
                  ["Received", formatMoney(guarantee.received_amount, guarantee.currency_code)],
                  ["Outstanding", formatMoney(outstanding > 0 ? outstanding : 0, guarantee.currency_code)],
                  ["Refunded", formatMoney(guarantee.refunded_amount, guarantee.currency_code)],
                  ["Claimed", formatMoney(guarantee.claimed_amount, guarantee.currency_code)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {payable ? (
                <div className="mt-4 space-y-3 rounded-md bg-secondary/50 p-4">
                  <p className="text-sm font-medium">Pay your guarantee deposit</p>
                  <div className="flex flex-wrap gap-2">
                    {METHODS.map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        variant={method === option ? "default" : "secondary"}
                        onClick={() => setMethod(option)}
                      >
                        {humanise(option)}
                      </Button>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => deposit.mutate(guarantee.id)} disabled={deposit.isPending}>
                    {deposit.isPending ? "Creating…" : "Generate payment reference"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Your deposit is confirmed by Credia once the funds are reconciled. It is recorded as a liability to
                    you, not revenue.
                  </p>
                </div>
              ) : null}

              {guarantee.notes ? (
                <p className="mt-3 rounded-md bg-secondary p-3 text-sm text-muted-foreground">{guarantee.notes}</p>
              ) : null}
            </Card>
          );
        })}

        {transactions.length > 0 ? (
          <Card>
            <h2 className="font-serif text-lg font-semibold">Guarantee activity</h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {transactions.map((tx) => (
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
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
