import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getReferenceData, saveMyProfile } from "@/lib/customer.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Credia profile" },
      { name: "description", content: "Keep your personal, employment and payout details up to date in Credia." },
      { property: "og:title", content: "Your Credia profile" },
      { property: "og:description", content: "Keep your personal, employment and payout details up to date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const EMPLOYMENT = ["employed", "self_employed", "business_owner", "student", "retired", "unemployed"];

type FormState = {
  first_name: string;
  last_name: string;
  phone: string;
  country_id: string;
  date_of_birth: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  employment_status: string;
  employer_name: string;
  monthly_income: string;
  monthly_debt_payments: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  mobile_money_number: string;
};

const EMPTY: FormState = {
  first_name: "",
  last_name: "",
  phone: "",
  country_id: "",
  date_of_birth: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postal_code: "",
  employment_status: "",
  employer_name: "",
  monthly_income: "",
  monthly_debt_payments: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  mobile_money_number: "",
};

function ProfilePage() {
  const { data } = useOverview();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: reference } = useQuery({ queryKey: ["reference-data"], queryFn: () => getReferenceData() });
  const saveFn = useServerFn(saveMyProfile);

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      phone: p.phone ?? "",
      country_id: p.country_id ?? "",
      date_of_birth: p.date_of_birth ?? "",
      address_line1: p.address_line1 ?? "",
      address_line2: p.address_line2 ?? "",
      city: p.city ?? "",
      postal_code: p.postal_code ?? "",
      employment_status: p.employment_status ?? "",
      employer_name: p.employer_name ?? "",
      monthly_income: p.monthly_income ? String(p.monthly_income) : "",
      monthly_debt_payments: p.monthly_debt_payments ? String(p.monthly_debt_payments) : "",
      bank_name: p.bank_name ?? "",
      bank_account_name: p.bank_account_name ?? "",
      bank_account_number: p.bank_account_number ?? "",
      mobile_money_number: p.mobile_money_number ?? "",
    });
  }, [data?.profile]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          country_id: form.country_id,
          date_of_birth: form.date_of_birth,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          postal_code: form.postal_code || null,
          employment_status: form.employment_status || null,
          employer_name: form.employer_name || null,
          monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
          monthly_debt_payments: form.monthly_debt_payments ? Number(form.monthly_debt_payments) : null,
          bank_name: form.bank_name || null,
          bank_account_name: form.bank_account_name || null,
          bank_account_number: form.bank_account_number || null,
          mobile_money_number: form.mobile_money_number || null,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const currency =
    (reference?.countries ?? []).find((c) => c.id === form.country_id)?.default_currency ?? "";

  return (
    <AppShell isStaff={isStaffRoles(data?.roles)} email={data?.profile?.email}>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            These details are used for identity verification, affordability checks and disbursement.
          </p>
        </div>

        <Section title="Personal details">
          <Field label="First name">
            <Input required maxLength={80} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input required maxLength={80} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Date of birth">
            <Input type="date" required value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </Field>
          <Field label="Phone number">
            <Input required maxLength={24} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Country of residence">
            <select
              required
              value={form.country_id}
              onChange={(e) => setForm({ ...form, country_id: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a country</option>
              {(reference?.countries ?? []).map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name} ({country.default_currency})
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Address">
          <Field label="Address line 1">
            <Input maxLength={160} value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
          </Field>
          <Field label="Address line 2">
            <Input maxLength={160} value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
          </Field>
          <Field label="City">
            <Input maxLength={80} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Postal code">
            <Input maxLength={24} value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </Field>
        </Section>

        <Section title="Income and employment">
          <Field label="Employment status">
            <select
              value={form.employment_status}
              onChange={(e) => setForm({ ...form, employment_status: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select</option>
              {EMPLOYMENT.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employer or business name">
            <Input maxLength={120} value={form.employer_name} onChange={(e) => setForm({ ...form, employer_name: e.target.value })} />
          </Field>
          <Field label={`Monthly income ${currency ? `(${currency})` : ""}`}>
            <Input type="number" min={0} step="0.01" value={form.monthly_income} onChange={(e) => setForm({ ...form, monthly_income: e.target.value })} />
          </Field>
          <Field label={`Existing monthly debt payments ${currency ? `(${currency})` : ""}`}>
            <Input type="number" min={0} step="0.01" value={form.monthly_debt_payments} onChange={(e) => setForm({ ...form, monthly_debt_payments: e.target.value })} />
          </Field>
        </Section>

        <Section title="Payout details">
          <Field label="Bank name">
            <Input maxLength={120} value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
          </Field>
          <Field label="Account holder name">
            <Input maxLength={120} value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} />
          </Field>
          <Field label="Account number / IBAN">
            <Input maxLength={64} value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
          </Field>
          <Field label="Mobile money number">
            <Input maxLength={32} value={form.mobile_money_number} onChange={(e) => setForm({ ...form, mobile_money_number: e.target.value })} />
          </Field>
        </Section>

        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
