import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { BankDetails } from "@/components/bank-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStaffRoles, useOverview } from "@/hooks/use-overview";
import { supabase } from "@/integrations/supabase/client";
import { declareBankTransfer, getPaymentCenter, getMyProofUrl } from "@/lib/bank-transfer.functions";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Credia" },
      { name: "description", content: "Bank details, payment references and the status of your Credia transfers." },
      { property: "og:title", content: "Payments — Credia" },
      { property: "og:description", content: "Pay your Credia guarantee and installments by bank transfer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaymentsPage,
});

const LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  declared: "Payment declared",
  processing: "Under review",
  under_review: "Under review",
  verified: "Payment confirmed",
  successful: "Payment confirmed",
  rejected: "Payment rejected",
  failed: "Payment rejected",
  cancelled: "Cancelled",
  refunded: "Refund completed",
};

function customerLabel(status: string, direction: string) {
  if (direction === "outbound") {
    if (status === "verified" || status === "successful") return "Refund completed";
    if (status === "failed") return "Refund failed";
    return "Refund pending";
  }
  return LABELS[status] ?? humanise(status);
}

function toneFor(label: string) {
  if (label.includes("confirmed") || label.includes("completed")) return "bg-success/10 text-success";
  if (label.includes("rejected") || label.includes("failed")) return "bg-destructive/10 text-destructive";
  if (label.includes("review") || label.includes("declared")) return "bg-primary/10 text-primary";
  return "bg-warning/15 text-warning";
}

function Pill({ label }: { label: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", toneFor(label))}>{label}</span>;
}

type Center = Awaited<ReturnType<typeof getPaymentCenter>>;
type Obligation = Center["obligations"][number];

function PaymentsPage() {
  const { data: session } = useOverview();
  const fetchCenter = useServerFn(getPaymentCenter);
  const proofFn = useServerFn(getMyProofUrl);
  const { data, isLoading } = useQuery({ queryKey: ["payment-center"], queryFn: () => fetchCenter() });
  const [open, setOpen] = useState<string | null>(null);

  const profileCountry = data?.profile?.country_id ?? null;
  function accountFor(o: Obligation) {
    const all = (data?.bankAccounts ?? []).filter((a) => a.currency_code === o.currency);
    return all.find((a) => a.country_id === profileCountry) ?? all.find((a) => !a.country_id) ?? all[0] ?? null;
  }

  const payments = data?.payments ?? [];

  return (
    <AppShell isStaff={isStaffRoles(session?.roles)} email={session?.profile?.email}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay by bank transfer using the details below. Always include the payment reference. Your payment is
            confirmed only once Credia sees the funds on its bank account.
          </p>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {!isLoading && (data?.obligations ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            You have no payment due right now.
          </div>
        ) : null}

        {(data?.obligations ?? []).map((o) => {
          const account = accountFor(o);
          const openDecl = payments.find(
            (p) => p.payment_reference === o.paymentReference && ["declared", "under_review"].includes(p.status),
          );
          return (
            <div key={o.targetId} className="space-y-4 rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.description}
                    {o.dueDate ? ` · due ${formatDate(o.dueDate)}` : ""} · Payment method: Bank transfer
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-xl font-semibold">{formatMoney(o.outstanding, o.currency)}</p>
                  {o.amountPaid > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(o.amountPaid, o.currency)} of {formatMoney(o.amountDue, o.currency)} confirmed
                    </p>
                  ) : null}
                  <div className="mt-1">
                    <Pill label={openDecl ? customerLabel(openDecl.status, "inbound") : "Awaiting payment"} />
                  </div>
                </div>
              </div>

              {account ? (
                <BankDetails
                  account={account}
                  amount={formatMoney(o.outstanding, o.currency)}
                  reference={o.paymentReference}
                />
              ) : (
                <p className="rounded-md bg-warning/15 p-3 text-sm text-warning">
                  Bank details for {o.currency} are being set up. Please contact support before making a transfer.
                </p>
              )}

              {account ? (
                open === o.targetId ? (
                  <DeclareForm
                    obligation={o}
                    bankAccountId={account.id}
                    userId={data?.profile?.id ?? ""}
                    defaultSender={`${data?.profile?.first_name ?? ""} ${data?.profile?.last_name ?? ""}`.trim()}
                    onDone={() => setOpen(null)}
                  />
                ) : (
                  <Button onClick={() => setOpen(o.targetId)}>
                    {o.kind === "guarantee" ? "I have made the bank transfer" : "I have made the payment"}
                  </Button>
                )
              ) : null}
            </div>
          );
        })}

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">Payment history</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {payments.length === 0 ? <li className="py-2 text-muted-foreground">No payments yet.</li> : null}
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">
                    {humanise(p.purpose)} · <span className="font-mono">{p.payment_reference ?? p.transaction_reference}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.transfer_date ? `Sent ${formatDate(p.transfer_date)} · ` : ""}
                    Recorded {formatDate(p.created_at)}
                    {p.rejection_reason ? ` · ${p.rejection_reason}` : ""}
                    {p.status === "under_review" && p.review_notes ? ` · ${p.review_notes}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-3">
                  {formatMoney(p.amount, p.currency_code)}
                  <Pill label={customerLabel(p.status, p.direction)} />
                  {p.proof_file_path ? (
                    <button
                      className="text-xs text-primary underline"
                      onClick={async () => {
                        try {
                          const { url } = await proofFn({ data: { paymentId: p.id } });
                          window.open(url, "_blank", "noopener");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Proof
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function DeclareForm({
  obligation,
  bankAccountId,
  userId,
  defaultSender,
  onDone,
}: {
  obligation: Obligation;
  bankAccountId: string;
  userId: string;
  defaultSender: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const declareFn = useServerFn(declareBankTransfer);
  const [form, setForm] = useState({
    amount: String(obligation.outstanding),
    currency: obligation.currency,
    transferDate: new Date().toISOString().slice(0, 10),
    senderName: defaultSender,
    senderBankName: "",
    bankTransactionReference: "",
    paymentReference: obligation.paymentReference,
  });
  const [file, setFile] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      let proofFilePath: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Proof file must be under 10 MB.");
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/payments/${Date.now()}-${safe}`;
        const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
        if (error) throw new Error(error.message);
        proofFilePath = path;
      }
      return declareFn({
        data: {
          kind: obligation.kind,
          targetId: obligation.targetId,
          amount: Number(form.amount),
          currency: form.currency,
          transferDate: form.transferDate,
          senderName: form.senderName,
          senderBankName: form.senderBankName,
          bankTransactionReference: form.bankTransactionReference || null,
          bankAccountId,
          proofFilePath,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payment declared. We will confirm it once the funds arrive.");
      queryClient.invalidateQueries({ queryKey: ["payment-center"] });
      queryClient.invalidateQueries({ queryKey: ["my-lending"] });
      queryClient.invalidateQueries({ queryKey: ["my-overview"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof typeof form, label: string, type = "text", readOnly = false) => (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type={type}
        value={form[key]}
        readOnly={readOnly}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <form
      className="space-y-3 rounded-md border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <p className="text-sm font-medium">Declare your transfer</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("amount", "Amount sent", "number")}
        {field("currency", "Currency")}
        {field("transferDate", "Transfer date", "date")}
        {field("senderName", "Sender name")}
        {field("senderBankName", "Your bank name")}
        {field("bankTransactionReference", "Bank transaction / reference number")}
        {field("paymentReference", "Payment reference", "text", true)}
        <label className="space-y-1 text-sm">
          <span className="font-medium">Proof of payment (optional)</span>
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? "Submitting…" : "Submit declaration"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
