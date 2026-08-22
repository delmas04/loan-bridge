import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getAdminOverview } from "@/lib/admin.functions";
import { formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — Credia" },
      { name: "description", content: "Portfolio, verification and payment metrics for Credia staff." },
      { property: "og:title", content: "Admin overview — Credia" },
      { property: "og:description", content: "Portfolio, verification and payment metrics for Credia staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const { data: session } = useOverview();
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Admin overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate figures across every market. Amounts are summed per record currency and shown unconverted.
          </p>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading metrics…</p> : null}
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

        {data ? (
          <>
            <Group title="Customers">
              <Metric label="Total" value={data.customers.total} />
              <Metric label="Verified" value={data.customers.verified} />
              <Metric label="Awaiting KYC review" value={data.customers.pendingKyc} />
              <Metric label="Suspended / blocked" value={data.customers.suspended} />
            </Group>

            <Group title="Applications">
              <Metric label="Created today" value={data.applications.today} />
              <Metric label="Pending decision" value={data.applications.pending} />
              <Metric label="Approved" value={data.applications.approved} />
              <Metric label="Rejected" value={data.applications.rejected} />
            </Group>

            <Group title="Portfolio">
              <Metric label="Active loans" value={data.portfolio.activeLoans} />
              <Metric label="Disbursed" value={Math.round(data.portfolio.totalDisbursed).toLocaleString()} />
              <Metric label="Outstanding" value={Math.round(data.portfolio.totalOutstanding).toLocaleString()} />
              <Metric label="Default rate" value={formatPercent(data.portfolio.defaultRate)} />
            </Group>

            <Group title="Guarantees and payments">
              <Metric label="Guarantees held" value={Math.round(data.guarantees.held).toLocaleString()} />
              <Metric label="Guarantees released" value={Math.round(data.guarantees.released).toLocaleString()} />
              <Metric label="Payments successful" value={data.payments.successful} />
              <Metric label="Payments failed" value={data.payments.failed} />
            </Group>

            <Link to="/admin/kyc" className="inline-block text-sm font-medium text-primary hover:underline">
              Open the KYC review queue →
            </Link>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
