import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getKycQueue } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  head: () => ({
    meta: [
      { title: "KYC review queue — Credia" },
      { name: "description", content: "Compliance queue for reviewing Credia customer identity documents." },
      { property: "og:title", content: "KYC review queue — Credia" },
      { property: "og:description", content: "Compliance queue for reviewing customer identity documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KycQueue,
});

const FILTERS = ["under_review", "pending", "approved", "rejected", "all"] as const;

function KycQueue() {
  const { data: session } = useOverview();
  const fetchQueue = useServerFn(getKycQueue);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("under_review");

  const { data, error, isLoading } = useQuery({
    queryKey: ["kyc-queue"],
    queryFn: () => fetchQueue(),
  });

  const rows = (data ?? []).filter((row) => {
    const status = row.kyc?.status ?? "pending";
    return filter === "all" ? true : status === filter;
  });

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">KYC review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Oldest submissions first. Open a customer to inspect documents and record a decision.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? "default" : "outline"}
              onClick={() => setFilter(option)}
            >
              {option.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading queue…</p> : null}
        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Country</th>
                <th className="px-4 py-2 text-left font-medium">KYC</th>
                <th className="px-4 py-2 text-left font-medium">Account</th>
                <th className="px-4 py-2 text-left font-medium">Docs</th>
                <th className="px-4 py-2 text-left font-medium">Submitted</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                    Nothing in this view.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.profile.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {row.profile.first_name} {row.profile.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.profile.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.profile.country_code ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.kyc?.status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.profile.account_status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.documents.filter((d) => d.status === "approved").length}/{row.documents.length} approved
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.kyc?.submitted_at ? formatDateTime(row.kyc.submitted_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/customers/$userId"
                      params={{ userId: row.profile.id }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
