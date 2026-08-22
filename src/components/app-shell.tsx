import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
}

const CUSTOMER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview" },
  { to: "/documents", label: "Verification" },
  { to: "/profile", label: "Profile" },
];

const STAFF_NAV: NavItem[] = [
  { to: "/admin", label: "Admin overview" },
  { to: "/admin/kyc", label: "KYC queue" },
];

export function AppShell({
  children,
  isStaff = false,
  email,
  unread = 0,
}: {
  children: ReactNode;
  isStaff?: boolean;
  email?: string | null;
  unread?: number;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  const items = isStaff ? [...CUSTOMER_NAV, ...STAFF_NAV] : CUSTOMER_NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/dashboard" className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Credia
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                )}
              >
                {item.label}
                {item.to === "/dashboard" && unread > 0 ? (
                  <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {unread}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {email ? <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span> : null}
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
