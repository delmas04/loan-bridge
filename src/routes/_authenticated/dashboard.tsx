import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { markNotificationRead } from "@/lib/customer.functions";
import { documentLabel, formatDateTime, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Credia dashboard" },
      { name: "description", content: "Track verification progress, loan applications and repayments in Credia." },
      { property: "og:title", content: "Your Credia dashboard" },
      { property: "og:description", content: "Track verification progress, loan applications and repayments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, error } = useOverview();
  const queryClient = useQueryClient();
  const readFn = useServerFn(markNotificationRead);
  const markRead = useMutation({
    mutationFn: (id: string) => readFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-overview"] }),
  });

  const unread = (data?.notifications ?? []).filter((n) => !n.read_at).length;
  const profile = data?.profile;
  const kycStatus = data?.kyc?.status ?? "pending";
  const missingDocs = (data?.requiredDocuments ?? []).filter(
    (type) => !(data?.documents ?? []).some((d) => d.document_type === type && d.status !== "rejected"),
  );

  return (
    <AppShell isStaff={isStaffRoles(data?.roles)} email={profile?.email} unread={unread}>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading your account…</p> : null}
      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

      {data ? (
        <div className="space-y-8">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.country
                ? `${data.country.name} · loans priced in ${data.country.default_currency}`
                : "Set your country of residence to see the products available to you."}
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-3">
            <Card label="Account status">
              <StatusBadge status={profile?.account_status} />
              {profile?.status_reason ? (
                <p className="mt-2 text-xs text-muted-foreground">{profile.status_reason}</p>
              ) : null}
            </Card>
            <Card label="Identity verification">
              <StatusBadge status={kycStatus} />
              {data.kyc?.rejection_reason ? (
                <p className="mt-2 text-xs text-destructive">{data.kyc.rejection_reason}</p>
              ) : null}
            </Card>
            <Card label="Credit limit">
              <p className="font-mono text-lg font-semibold">
                {profile?.credit_limit
                  ? `${Number(profile.credit_limit).toLocaleString()} ${profile.credit_limit_currency ?? ""}`
                  : "Not yet assigned"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Score {profile?.credit_score ?? "—"} · {profile?.successful_loans_count ?? 0} completed loans
              </p>
            </Card>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-serif text-lg font-semibold">Next steps</h2>
            <ol className="mt-4 space-y-3 text-sm">
              <Step
                done={Boolean(profile?.first_name && profile?.country_id && profile?.date_of_birth)}
                title="Complete your profile"
                action={<Link className="text-primary hover:underline" to="/profile">Open profile</Link>}
              />
              <Step
                done={missingDocs.length === 0 && (data.requiredDocuments?.length ?? 0) > 0}
                title={
                  missingDocs.length === 0
                    ? "Required documents uploaded"
                    : `Upload ${missingDocs.length} required document${missingDocs.length === 1 ? "" : "s"}: ${missingDocs
                        .map(documentLabel)
                        .join(", ")}`
                }
                action={<Link className="text-primary hover:underline" to="/documents">Open verification</Link>}
              />
              <Step
                done={kycStatus === "approved"}
                title={
                  kycStatus === "approved"
                    ? "Identity verified"
                    : kycStatus === "under_review"
                      ? "Identity documents under review"
                      : "Submit your documents for review"
                }
                action={<Link className="text-primary hover:underline" to="/documents">Review status</Link>}
              />
              <Step
                done={false}
                title="Apply for your first loan (available once verified)"
                action={<span className="text-xs text-muted-foreground">Coming in the next stage</span>}
              />
            </ol>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold">Notifications</h2>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {data.notifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                data.notifications.map((note) => (
                  <div key={note.id} className="flex flex-wrap items-start gap-3 p-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {note.title}
                        {!note.read_at ? <span className="ml-2 text-xs text-primary">New</span> : null}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {humanise(note.category)} · {formatDateTime(note.created_at)}
                      </p>
                    </div>
                    {!note.read_at ? (
                      <Button size="sm" variant="ghost" onClick={() => markRead.mutate(note.id)}>
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Step({ done, title, action }: { done: boolean; title: string; action: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3">
      <span
        className={
          done
            ? "flex size-5 items-center justify-center rounded-full bg-success/15 text-xs text-success"
            : "flex size-5 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
        }
      >
        {done ? "✓" : "•"}
      </span>
      <span className={done ? "flex-1 text-muted-foreground" : "flex-1 text-foreground"}>{title}</span>
      {action}
    </li>
  );
}
