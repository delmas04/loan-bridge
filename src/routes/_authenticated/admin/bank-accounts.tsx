import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getBankAccountAdmin, setBankAccountActive, upsertBankAccount } from "@/lib/admin-payments.functions";

export const Route = createFileRoute("/_authenticated/admin/bank-accounts")({
  head: () => ({
    meta: [
      { title: "Bank accounts — Credia admin" },
      { name: "description", content: "Configure the Credia bank accounts customers pay into, by country and currency." },
      { property: "og:title", content: "Bank accounts — Credia admin" },
      { property: "og:description", content: "Configure Credia receiving bank accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BankAccountsAdmin,
});

const EMPTY = {
  id: null as string | null,
  country_id: "" as string,
  currency_code: "EUR",
  label: "",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  iban: "",
  bic_swift: "",
  bank_address: "",
  payment_instructions: "",
  display_order: 0,
  is_active: true,
};

function BankAccountsAdmin() {
  const { data: session } = useOverview();
  const queryClient = useQueryClient();
  const fetchFn = useServerFn(getBankAccountAdmin);
  const saveFn = useServerFn(upsertBankAccount);
  const toggleFn = useServerFn(setBankAccountActive);
  const { data, isLoading } = useQuery({ queryKey: ["bank-accounts-admin"], queryFn: () => fetchFn() });
  const [form, setForm] = useState({ ...EMPTY });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...form,
          country_id: form.country_id || null,
          display_order: Number(form.display_order) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Bank account saved.");
      setForm({ ...EMPTY });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggleFn({ data: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-accounts-admin"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const countries = data?.countries ?? [];
  const text = (key: keyof typeof EMPTY, label: string) => (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Bank accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers see the active account matching their country and loan currency. Accounts without a country act
            as the fallback for that currency.
          </p>
        </div>

        <form
          className="space-y-3 rounded-lg border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="font-serif text-lg font-semibold">{form.id ? "Edit account" : "Add account"}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Country</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.country_id}
                onChange={(e) => setForm({ ...form, country_id: e.target.value })}
              >
                <option value="">Any country (fallback)</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Currency</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.currency_code}
                onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
              >
                {(data?.currencies ?? []).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            {text("label", "Internal label")}
            {text("bank_name", "Bank name")}
            {text("account_holder_name", "Account holder")}
            {text("account_number", "Account number")}
            {text("iban", "IBAN")}
            {text("bic_swift", "BIC / SWIFT")}
            {text("bank_address", "Bank address")}
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Payment instructions</span>
            <Textarea
              value={form.payment_instructions}
              onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              Save account
            </Button>
            {form.id ? (
              <Button type="button" variant="secondary" onClick={() => setForm({ ...EMPTY })}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left">
              <tr>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Bank</th>
                <th className="px-3 py-2">Holder</th>
                <th className="px-3 py-2">IBAN / Account</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.accounts ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">{countries.find((c) => c.id === a.country_id)?.name ?? "Any"}</td>
                  <td className="px-3 py-2">{a.currency_code}</td>
                  <td className="px-3 py-2">{a.bank_name}</td>
                  <td className="px-3 py-2">{a.account_holder_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.iban ?? a.account_number}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={a.is_active ? "active" : "inactive"} />
                  </td>
                  <td className="space-x-2 px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setForm({
                          ...EMPTY,
                          ...a,
                          country_id: a.country_id ?? "",
                          label: a.label ?? "",
                          account_number: a.account_number ?? "",
                          iban: a.iban ?? "",
                          bic_swift: a.bic_swift ?? "",
                          bank_address: a.bank_address ?? "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: a.id, isActive: !a.is_active })}>
                      {a.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {(data?.accounts ?? []).length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                    No bank accounts configured yet.
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
