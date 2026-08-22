import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { Bell, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useOverview } from "@/hooks/use-overview";
import { markNotificationRead } from "@/lib/customer.functions";
import { formatDateTime, humanise } from "@/lib/format";

export interface NavItem {
  to: string;
  label: string;
}

const CUSTOMER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview" },
  { to: "/documents", label: "Verification" },
  { to: "/profile", label: "Profile" },
  { to: "/loans", label: "My Loans" },
  { to: "/repayments", label: "Repayments" },
  { to: "/guarantee", label: "Guarantee" },
  { to: "/my-documents", label: "Documents" },
  { to: "/support", label: "Support" },
];

const STAFF_NAV: NavItem[] = [
  { to: "/admin", label: "Admin overview" },
  { to: "/admin/kyc", label: "KYC queue" },
];

export function AppShell({
  children,
  isStaff = false,
  email,
  unread,
}: {
  children: ReactNode;
  isStaff?: boolean | undefined;
  email?: string | null | undefined;
  unread?: number | undefined;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data } = useOverview();
  const notifications = data?.notifications ?? [];
  const unreadCount = unread ?? notifications.filter((n) => !n.read_at).length;

  const readFn = useServerFn(markNotificationRead);
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await readFn({ data: { id } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-overview"] }),
  });

  async function signOut() {
    setMenuOpen(false);
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
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Credia
          </Link>
          <div className="flex flex-1 items-center justify-end gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Notifications</p>
                  {unreadCount > 0 ? (
                    <button
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        markRead.mutate(notifications.filter((n) => !n.read_at).map((n) => n.id))
                      }
                    >
                      Mark all as read
                    </button>
                  ) : null}
                </div>
                <div className="max-h-80 divide-y divide-border overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">You have no notifications yet.</p>
                  ) : (
                    notifications.map((note) => (
                      <div
                        key={note.id}
                        className={note.read_at ? "px-4 py-3" : "bg-secondary/40 px-4 py-3"}
                      >
                        <p className="text-sm font-medium text-foreground">
                          {note.title}
                          {!note.read_at ? <span className="ml-2 text-xs text-primary">New</span> : null}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {humanise(note.category)} · {formatDateTime(note.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(20rem,100vw)]">
                <SheetHeader>
                  <SheetTitle className="font-serif">Menu</SheetTitle>
                </SheetHeader>
                {email ? <p className="mt-1 text-xs text-muted-foreground">{email}</p> : null}
                <nav className="mt-6 flex flex-col gap-1">
                  {items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={signOut}
                    className="mt-4 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Sign out
                  </button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
