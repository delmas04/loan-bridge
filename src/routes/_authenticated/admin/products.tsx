import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getProductAdmin, setProductActive, upsertLoanProduct } from "@/lib/admin-lending.functions";
import { documentLabel, formatMoney, formatPercent, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Loan products — Credia admin" },
      { name: "description", content: "Configure Credia loan products, rates and guarantee percentages by country." },
      { property: "og:title", content: "Loan products — Credia admin" },
      { property: "og:description", content: "Configure Credia loan products by country and currency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductAdmin,
});

const FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
const DOC_TYPES = [
  "government_id",
  "selfie",
  "proof_of_address",
  "proof_of_income",
  "bank_account",
  "mobile_money_account",
  "employment_proof",
];

interface FormState {
  id: string | null;
  name: string;
  description: string;
  country_id: string;
  currency_code: string;
  min_amount: string;
  max_amount: string;
  min_duration_months: string;
  max_duration_months: string;
  annual_interest_rate: string;
  origination_fee_rate: string;
  guarantee_percentage: string;
  allowed_frequencies: string[];
  required_documents: string[];
  eligibility_requirements: string;
  processing_time: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  id: null,
  name: "",
  description: "",
  country_id: "",
  currency_code: "",
  min_amount: "500",
  max_amount: "10000",
  min_duration_months: "3",
  max_duration_months: "24",
  annual_interest_rate: "12",
  origination_fee_rate: "0",
  guarantee_percentage: "15",
  allowed_frequencies: ["monthly"],
  required_documents: ["government_id", "proof_of_address", "proof_of_income"],
  eligibility_requirements: "",
  processing_time: "48 hours",
  is_active: true,
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-5">{children}</div>;
}

function ProductAdmin() {
  const { data: session } = useOverview();
  const queryClient = useQueryClient();
  const fetchAdmin = useServerFn(getProductAdmin);
  const saveFn = useServerFn(upsertLoanProduct);
  const toggleFn = useServerFn(setProductActive);

  const { data, isLoading } = useQuery({ queryKey: ["product-admin"], queryFn: () => fetchAdmin() });
  const [form, setForm] = useState<FormState | null>(null);

  const save = useMutation({
    mutationFn: async (state: FormState) =>
      saveFn({
        data: {
          id: state.id,
          name: state.name.trim(),
          description: state.description.trim() || null,
          country_id: state.country_id,
          currency_code: state.currency_code,
          min_amount: Number(state.min_amount),
          max_amount: Number(state.max_amount),
          min_duration_months: Number(state.min_duration_months),
          max_duration_months: Number(state.max_duration_months),
          annual_interest_rate: Number(state.annual_interest_rate) / 100,
          origination_fee_rate: Number(state.origination_fee_rate) / 100,
          guarantee_percentage: Number(state.guarantee_percentage) / 100,
          allowed_frequencies: state.allowed_frequencies as ("weekly" | "biweekly" | "monthly")[],
          required_documents: state.required_documents,
          eligibility_requirements: state.eligibility_requirements
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          processing_time: state.processing_time.trim(),
          is_active: state.is_active,
        },
      }),
    onSuccess: () => {
      toast.success("Product saved.");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["product-admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["product-admin"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const countries = data?.countries ?? [];
  const products = data?.products ?? [];
  const isAdmin = data?.isAdmin === true;

  function edit(productId: string | null) {
    if (!productId) {
      const first = countries[0];
      setForm({
        ...EMPTY,
        country_id: first?.id ?? "",
        currency_code: first?.default_currency ?? "EUR",
      });
      return;
    }
    const p = products.find((item) => item.id === productId);
    if (!p) return;
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      country_id: p.country_id,
      currency_code: p.currency_code,
      min_amount: String(p.min_amount),
      max_amount: String(p.max_amount),
      min_duration_months: String(p.min_duration_months),
      max_duration_months: String(p.max_duration_months),
      annual_interest_rate: String(Number(p.annual_interest_rate) * 100),
      origination_fee_rate: String(Number(p.origination_fee_rate) * 100),
      guarantee_percentage: String(Number(p.guarantee_percentage) * 100),
      allowed_frequencies: (p.allowed_frequencies ?? []) as string[],
      required_documents: (p.required_documents ?? []) as string[],
      eligibility_requirements: ((p.eligibility_requirements ?? []) as string[]).join("\n"),
      processing_time: p.processing_time,
      is_active: p.is_active,
    });
  }

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">Loan products</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rates, limits and guarantee percentages are configured per country and currency. Existing applications
              keep the terms they were priced with.
            </p>
          </div>
          {isAdmin ? <Button onClick={() => edit(null)}>New product</Button> : null}
        </div>

        {!isAdmin && !isLoading ? (
          <p className="text-sm text-muted-foreground">You have read-only access to product configuration.</p>
        ) : null}

        {form ? (
          <Card>
            <h2 className="font-serif text-lg font-semibold">{form.id ? "Edit product" : "New product"}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.country_id}
                  onChange={(e) => {
                    const country = countries.find((c) => c.id === e.target.value);
                    setForm({
                      ...form,
                      country_id: e.target.value,
                      currency_code: country?.default_currency ?? form.currency_code,
                    });
                  }}
                >
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name} ({country.code}) {country.lending_enabled ? "" : "— lending off"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.currency_code}
                  onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
                >
                  {(data?.currencies ?? []).map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="processing">Processing time</Label>
                <Input
                  id="processing"
                  value={form.processing_time}
                  onChange={(e) => setForm({ ...form, processing_time: e.target.value })}
                />
              </div>
              {(
                [
                  ["min_amount", "Minimum amount"],
                  ["max_amount", "Maximum amount"],
                  ["min_duration_months", "Minimum duration (months)"],
                  ["max_duration_months", "Maximum duration (months)"],
                  ["annual_interest_rate", "Annual interest rate (%)"],
                  ["origination_fee_rate", "Origination fee (%)"],
                  ["guarantee_percentage", "Guarantee deposit (%)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Allowed frequencies</Label>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCIES.map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      variant={form.allowed_frequencies.includes(option) ? "default" : "secondary"}
                      onClick={() =>
                        setForm({
                          ...form,
                          allowed_frequencies: form.allowed_frequencies.includes(option)
                            ? form.allowed_frequencies.filter((f) => f !== option)
                            : [...form.allowed_frequencies, option],
                        })
                      }
                    >
                      {humanise(option)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Required documents</Label>
                <div className="flex flex-wrap gap-2">
                  {DOC_TYPES.map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      variant={form.required_documents.includes(option) ? "default" : "secondary"}
                      onClick={() =>
                        setForm({
                          ...form,
                          required_documents: form.required_documents.includes(option)
                            ? form.required_documents.filter((d) => d !== option)
                            : [...form.required_documents, option],
                        })
                      }
                    >
                      {documentLabel(option)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="eligibility">Eligibility requirements (one per line)</Label>
                <Textarea
                  id="eligibility"
                  rows={3}
                  value={form.eligibility_requirements}
                  onChange={(e) => setForm({ ...form, eligibility_requirements: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => save.mutate(form)} disabled={save.isPending || !isAdmin}>
                {save.isPending ? "Saving…" : "Save product"}
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Published (visible to customers)
              </label>
            </div>
          </Card>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        <div className="space-y-3">
          {products.map((product) => {
            const country = countries.find((c) => c.id === product.country_id);
            return (
              <Card key={product.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {country?.name ?? "—"} · {product.currency_code} · {product.processing_time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={product.is_active ? "approved" : "cancelled"} />
                    <Button size="sm" variant="secondary" onClick={() => edit(product.id)}>
                      Edit
                    </Button>
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggle.mutate({ id: product.id, isActive: !product.is_active })}
                      >
                        {product.is_active ? "Unpublish" : "Publish"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    [
                      "Amount",
                      `${formatMoney(product.min_amount, product.currency_code)} – ${formatMoney(product.max_amount, product.currency_code)}`,
                    ],
                    ["Duration", `${product.min_duration_months}–${product.max_duration_months} months`],
                    ["Interest", formatPercent(product.annual_interest_rate)],
                    ["Guarantee", formatPercent(product.guarantee_percentage, 0)],
                    ["Frequencies", ((product.allowed_frequencies ?? []) as string[]).map(humanise).join(", ")],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
