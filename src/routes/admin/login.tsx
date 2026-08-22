import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminAccess } from "@/lib/admin-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({ denied: z.boolean().optional() });

export const Route = createFileRoute("/admin/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Administrator sign in — Credia" },
      {
        name: "description",
        content: "Restricted sign-in for Credia staff administrators managing verification, lending and guarantees.",
      },
      { property: "og:title", content: "Administrator sign in — Credia" },
      {
        property: "og:description",
        content: "Restricted sign-in for Credia staff administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const { denied } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (denied) toast.error("This account does not have administrator access.");
  }, [denied]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw error;

      const access = await getMyAdminAccess();
      if (!access.isAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account does not have administrator access.");
      }
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="font-serif text-xl font-semibold tracking-tight">
          Credia
        </Link>
        <h1 className="mt-6 font-serif text-xl font-semibold text-foreground">Administrator sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restricted area. Administrator credentials are required — customer accounts cannot access it.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Work email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              maxLength={255}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={72}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Sign in to admin
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Customer account?{" "}
          <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
