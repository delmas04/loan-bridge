import { AppShell } from "@/components/app-shell";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";

/** Presentation-only shell for navigation destinations that are not built yet. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  const { data } = useOverview();
  return (
    <AppShell isStaff={isStaffRoles(data?.roles)} email={data?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            This section is not available yet. You will see it here as soon as it is enabled for your account.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
