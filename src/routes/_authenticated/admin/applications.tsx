import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getApplicationQueue } from "@/lib/admin-lending.functions";
import { formatDate, formatMoney, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/applications")({
  head: () => ({
    meta: [
      { title: "Application queue — Credia admin" },
      { name: "description", content: "Underwriting queue for Credia loan applications across all countries." },
      { property: "og:title", content: "Application queue — Credia admin" },
      { property: "og:description", content: "Underwriting queue for Credia loan applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplicationQueue,
});

const FILTERS = [
  "submitted",
  "under_review",
  "guarantee_pending",
  "contract_pending",
  "ready_for_disbursement",
  "disbursed",
  "rejected",
  "all",
] as const;

function ApplicationQueue() {
  const { data: session } = useOverview();
  const fetchQueue = useServerFn(getApplicationQueue);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("submitted");

  const { data, isLoading, error } = useQuery({ queryKey: ["application-queue"], queryFn: () => fetchQueue() });

  const rows = (data?.applications ?? []).filter((app) => (filter === "all" ? true : app.status === filter));

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Application queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open an application to review the customer dossier, the priced quote and record a decision.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? "default" : "secondary"}
              onClick={() => setFilter(option)}
            >
              {humanise(option)}
            </Button>
          ))}
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left">
              <tr>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Requested</th>
                <th className="px-3 py-2">Terms</th>
                <th className="px-3 py-2">Guarantee</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((app) => {
                const profile = (data?.profiles ?? []).find((p) => p.id === app.user_id);
                const guarantee = (data?.guarantees ?? []).find((g) => g.application_id === app.id);
                return (
                  <tr key={app.id}>
                    <td className="px-3 py-2 font-medium">{app.reference}</td>
                    <td className="px-3 py-2">
                      {profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email : "—"}
                    </td>
                    <td className="px-3 py-2">{formatMoney(app.requested_amount, app.currency_code)}</td>
                    <td className="px-3 py-2">
                      {app.duration_months} months · {humanise(app.repayment_frequency)}
                    </td>
                    <td className="px-3 py-2">
                      {guarantee ? (
                        <span className="flex items-center gap-2">
                          {formatMoney(guarantee.received_amount, guarantee.currency_code)} /{" "}
                          {formatMoney(guarantee.required_amount, guarantee.currency_code)}
                          <StatusBadge status={guarantee.status} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDate(app.submitted_at ?? app.created_at)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/admin/applications/$applicationId" params={{ applicationId: app.id }}>
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    No applications with this status.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
