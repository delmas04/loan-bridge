import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Checkbox } from "@/components/ui/checkbox";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { getApplyContext, requestQuote, acceptQuoteAndSubmit } from "@/lib/lending.functions";
import { documentLabel, formatDate, formatMoney, formatPercent, humanise } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/apply")({
  head: () => ({
    meta: [
      { title: "Apply for a loan — Credia" },
      {
        name: "description",
        content: "Request a Credia loan quote, review your repayment schedule and submit your application.",
      },
      { property: "og:title", content: "Apply for a loan — Credia" },
      { property: "og:description", content: "Request a quote and submit your Credia loan application." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApplyPage,
});

const PURPOSES = [
  "personal",
  "education",
  "business",
  "medical",
  "emergency",
  "home_improvement",
  "other",
] as const;

const EMPLOYMENT = ["employed", "self_employed", "business_owner", "student", "retired", "unemployed"];

type Frequency = "weekly" | "biweekly" | "monthly";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>{children}</div>;
}

function ApplyPage() {
  const { data: session } = useOverview();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchContext = useServerFn(getApplyContext);
  const quoteFn = useServerFn(requestQuote);
  const submitFn = useServerFn(acceptQuoteAndSubmit);

  const { data, isLoading } = useQuery({ queryKey: ["apply-context"], queryFn: () => fetchContext() });

  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof requestQuote>>["quote"] | null>(null);

  const [purpose, setPurpose] = useState<string>("personal");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("employed");
  const [employerName, setEmployerName] = useState("");
  const [monthlyExpenses, setMonthlyExpenses] = useState("");
  const [existingDebt, setExistingDebt] = useState("");
  const [otherObligations, setOtherObligations] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const products = data?.products ?? [];
  const product = products.find((p) => p.id === productId) ?? null;
  const kycApproved = data?.kyc?.status === "approved";
  const lendingEnabled = data?.country?.lending_enabled === true;
  const currency = product?.currency_code ?? data?.country?.default_currency ?? "EUR";

  const createQuote = useMutation({
    mutationFn: async () =>
      quoteFn({
        data: {
          productId: productId!,
          amount: Number(amount),
          durationMonths: Number(duration),
          frequency,
        },
      }),
    onSuccess: (result) => {
      setQuote(result.quote);
      setStep(3);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: async () =>
      submitFn({
        data: {
          quoteId: quote!.id,
          purpose: purpose as (typeof PURPOSES)[number],
          monthlyIncome: Number(monthlyIncome || 0),
          employmentStatus,
          employerName: employerName.trim() || null,
          monthlyExpenses: Number(monthlyExpenses || 0),
          existingDebt: Number(existingDebt || 0),
          otherObligations: otherObligations.trim() || null,
          acceptTerms,
        },
      }),
    onSuccess: (result) => {
      toast.success(`Application ${result.application.reference} submitted.`);
      queryClient.invalidateQueries({ queryKey: ["my-lending"] });
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
      navigate({ to: "/loans" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const missingDocuments = product
    ? ((product.required_documents ?? []) as string[]).filter(
        (type) => !(data?.documents ?? []).some((d) => d.document_type === type && d.status === "approved"),
      )
    : [];

  const blocked = !kycApproved || !lendingEnabled || products.length === 0;

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Apply for a loan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your quote, repayment schedule and guarantee amount are calculated by Credia from the product terms in
            your country.
          </p>
        </div>

        <ol className="flex flex-wrap gap-2 text-xs">
          {["Product", "Amount & terms", "Your details", "Review & submit"].map((label, index) => (
            <li
              key={label}
              className={
                step === index + 1
                  ? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
                  : "rounded-full bg-secondary px-3 py-1 text-muted-foreground"
              }
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading products…</p> : null}

        {!isLoading && blocked ? (
          <Card>
            <h2 className="font-serif text-lg font-semibold">Before you can apply</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {!data?.profile?.country_id ? (
                <li>
                  Add your country of residence in your{" "}
                  <Link to="/profile" className="text-primary underline">
                    profile
                  </Link>
                  .
                </li>
              ) : null}
              {!kycApproved ? (
                <li>
                  Your identity verification must be approved. Track it in{" "}
                  <Link to="/documents" className="text-primary underline">
                    Verification
                  </Link>
                  .
                </li>
              ) : null}
              {!lendingEnabled ? <li>Lending is not yet open in your country. We will notify you when it is.</li> : null}
              {lendingEnabled && products.length === 0 ? (
                <li>No loan products are currently published for your country.</li>
              ) : null}
            </ul>
          </Card>
        ) : null}

        {!isLoading && !blocked ? (
          <>
            {step === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {products.map((p) => (
                  <Card
                    key={p.id}
                    className={productId === p.id ? "ring-2 ring-primary" : ""}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-serif text-lg font-semibold">{p.name}</h2>
                      <span className="text-xs text-muted-foreground">{p.processing_time}</span>
                    </div>
                    {p.description ? <p className="mt-2 text-sm text-muted-foreground">{p.description}</p> : null}
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Amount</dt>
                        <dd>
                          {formatMoney(p.min_amount, p.currency_code)} – {formatMoney(p.max_amount, p.currency_code)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Duration</dt>
                        <dd>
                          {p.min_duration_months}–{p.max_duration_months} months
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Interest (annual)</dt>
                        <dd>{formatPercent(p.annual_interest_rate)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Guarantee deposit</dt>
                        <dd>{formatPercent(p.guarantee_percentage, 0)}</dd>
                      </div>
                    </dl>
                    {((p.eligibility_requirements ?? []) as string[]).length > 0 ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {((p.eligibility_requirements ?? []) as string[]).map((req) => (
                          <li key={req}>{req}</li>
                        ))}
                      </ul>
                    ) : null}
                    <Button
                      className="mt-4 w-full"
                      variant={productId === p.id ? "default" : "secondary"}
                      onClick={() => {
                        setProductId(p.id);
                        setAmount(String(p.min_amount));
                        setDuration(String(p.min_duration_months));
                        const allowed = (p.allowed_frequencies ?? []) as Frequency[];
                        setFrequency(allowed.includes("monthly") ? "monthly" : (allowed[0] ?? "monthly"));
                        setQuote(null);
                        setStep(2);
                      }}
                    >
                      Choose this product
                    </Button>
                  </Card>
                ))}
              </div>
            ) : null}

            {step === 2 && product ? (
              <Card className="max-w-xl space-y-4">
                <h2 className="font-serif text-lg font-semibold">{product.name}</h2>
                {missingDocuments.length > 0 ? (
                  <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">
                    These documents must be approved before you can submit:{" "}
                    {missingDocuments.map((type) => documentLabel(type)).join(", ")}.
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({product.currency_code})</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={product.min_amount}
                    max={product.max_amount}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Between {formatMoney(product.min_amount, product.currency_code)} and{" "}
                    {formatMoney(product.max_amount, product.currency_code)}.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (months)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={product.min_duration_months}
                    max={product.max_duration_months}
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Repayment frequency</Label>
                  <div className="flex flex-wrap gap-2">
                    {((product.allowed_frequencies ?? []) as Frequency[]).map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={frequency === option ? "default" : "secondary"}
                        onClick={() => setFrequency(option)}
                      >
                        {humanise(option)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>
                    {createQuote.isPending ? "Pricing…" : "Get my quote"}
                  </Button>
                </div>
              </Card>
            ) : null}

            {step === 3 && quote ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                <Card className="space-y-4">
                  <h2 className="font-serif text-lg font-semibold">Your details</h2>
                  <div className="space-y-2">
                    <Label>Loan purpose</Label>
                    <div className="flex flex-wrap gap-2">
                      {PURPOSES.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={purpose === option ? "default" : "secondary"}
                          onClick={() => setPurpose(option)}
                        >
                          {humanise(option)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="income">Monthly income ({currency})</Label>
                      <Input
                        id="income"
                        type="number"
                        value={monthlyIncome}
                        onChange={(event) => setMonthlyIncome(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expenses">Monthly expenses ({currency})</Label>
                      <Input
                        id="expenses"
                        type="number"
                        value={monthlyExpenses}
                        onChange={(event) => setMonthlyExpenses(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="debt">Existing monthly debt payments ({currency})</Label>
                      <Input
                        id="debt"
                        type="number"
                        value={existingDebt}
                        onChange={(event) => setExistingDebt(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employer">Employer / business name</Label>
                      <Input
                        id="employer"
                        value={employerName}
                        onChange={(event) => setEmployerName(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Employment status</Label>
                    <div className="flex flex-wrap gap-2">
                      {EMPLOYMENT.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={employmentStatus === option ? "default" : "secondary"}
                          onClick={() => setEmploymentStatus(option)}
                        >
                          {humanise(option)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="obligations">Other obligations (optional)</Label>
                    <Textarea
                      id="obligations"
                      rows={3}
                      value={otherObligations}
                      onChange={(event) => setOtherObligations(event.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(4)} disabled={!monthlyIncome}>
                      Review terms
                    </Button>
                  </div>
                </Card>
                <QuoteSummary quote={quote} />
              </div>
            ) : null}

            {step === 4 && quote ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                <Card className="space-y-4">
                  <h2 className="font-serif text-lg font-semibold">Review and submit</h2>
                  <p className="text-sm text-muted-foreground">
                    Your guarantee deposit of {formatMoney(quote.guarantee_amount, quote.currency_code)} is held
                    separately from your loan repayments. It is never used as a repayment and is refundable once your
                    loan completes, subject to the product terms.
                  </p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/50 text-left">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Due date</th>
                          <th className="px-3 py-2">Payment</th>
                          <th className="px-3 py-2">Principal</th>
                          <th className="px-3 py-2">Interest</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {((quote.schedule ?? []) as unknown as ScheduleRow[]).map((row) => (
                          <tr key={row.installmentNumber}>
                            <td className="px-3 py-2">{row.installmentNumber}</td>
                            <td className="px-3 py-2">{formatDate(row.dueDate)}</td>
                            <td className="px-3 py-2">{formatMoney(row.totalPayment, quote.currency_code)}</td>
                            <td className="px-3 py-2">{formatMoney(row.principalPortion, quote.currency_code)}</td>
                            <td className="px-3 py-2">{formatMoney(row.interestPortion, quote.currency_code)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <Checkbox
                      checked={acceptTerms}
                      onCheckedChange={(value) => setAcceptTerms(value === true)}
                      aria-label="Accept loan terms"
                    />
                    <span className="text-muted-foreground">
                      I accept the loan terms (version {quote.terms_version}), the repayment schedule above and the
                      separate refundable guarantee deposit.
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(3)}>
                      Back
                    </Button>
                    <Button onClick={() => submit.mutate()} disabled={!acceptTerms || submit.isPending}>
                      {submit.isPending ? "Submitting…" : "Accept and submit application"}
                    </Button>
                  </div>
                </Card>
                <QuoteSummary quote={quote} />
              </div>
            ) : null}
          </>
        ) : null}

        {(data?.openApplications ?? []).length > 0 ? (
          <Card>
            <h2 className="font-serif text-lg font-semibold">Applications in progress</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(data?.openApplications ?? []).map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-3">
                  <span>
                    {app.reference} · {formatMoney(app.requested_amount, app.currency_code)}
                  </span>
                  <StatusBadge status={app.status} />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

interface ScheduleRow {
  installmentNumber: number;
  dueDate: string;
  totalPayment: string | number;
  principalPortion: string | number;
  interestPortion: string | number;
  remainingPrincipal: string | number;
}

function QuoteSummary({ quote }: { quote: NonNullable<Awaited<ReturnType<typeof requestQuote>>["quote"]> }) {
  const c = quote.currency_code;
  return (
    <Card className="h-fit space-y-3">
      <h2 className="font-serif text-lg font-semibold">Quote summary</h2>
      <dl className="space-y-2 text-sm">
        {[
          ["Loan amount", formatMoney(quote.amount, c)],
          ["Interest rate (annual)", formatPercent(quote.annual_interest_rate)],
          ["Installments", `${quote.installment_count} × ${formatMoney(quote.installment_amount, c)}`],
          ["Frequency", humanise(quote.repayment_frequency)],
          ["Total interest", formatMoney(quote.total_interest, c)],
          ["Total repayable", formatMoney(quote.total_repayable, c)],
          ["First payment", formatDate(quote.first_due_date)],
          ["Final payment", formatDate(quote.final_due_date)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-md bg-secondary p-3 text-sm">
        <p className="font-medium">Guarantee deposit (separate)</p>
        <p className="mt-1 text-muted-foreground">
          {formatMoney(quote.guarantee_amount, c)} ({formatPercent(quote.guarantee_percentage, 0)}) — refundable, not a
          repayment.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Quote expires {formatDate(quote.expires_at)}.</p>
    </Card>
  );
}
