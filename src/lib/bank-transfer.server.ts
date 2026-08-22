/**
 * Credia Stage 3 — manual bank-transfer payments (customer side).
 *
 * No automated payment provider is involved. The customer transfers money to a
 * Credia bank account configured by staff, then *declares* the transfer. A
 * declaration never moves a financial status: only an admin verification
 * (see `admin-payments.server.ts`) can mark money as received.
 *
 * The architecture is method-agnostic: `payment_method` on `payments` carries
 * `bank_transfer` today, and card / mobile money / provider methods can be
 * added later without changing the obligation or verification model.
 */
import type { UserClient } from "./customer.server";
import { notify, writeAudit } from "./audit.server";

export const PAYMENT_METHOD_BANK_TRANSFER = "bank_transfer";

export const PAYMENT_TYPES = [
  "guarantee_deposit",
  "loan_repayment",
  "guarantee_refund",
  "guarantee_release",
  "other",
] as const;

/** Statuses a bank-transfer payment can hold, in lifecycle order. */
export const BANK_TRANSFER_STATUSES = [
  "pending",
  "declared",
  "under_review",
  "verified",
  "rejected",
  "refunded",
] as const;

/** Customer-facing wording for each payment status. */
export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
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

const BANK_ACCOUNT_COLUMNS =
  "id, country_id, currency_code, label, bank_name, account_holder_name, account_number, iban, bic_swift, bank_address, payment_instructions, payment_method, display_order, is_active";

function pad(value: number | string | null | undefined, size: number): string {
  return String(value ?? 0).padStart(size, "0");
}

/** `CRD-G-000123` — a guarantee obligation. */
export function guaranteeReference(guaranteeNumber: number | null | undefined): string {
  return `CRD-G-${pad(guaranteeNumber ?? 0, 6)}`;
}

/** `CRD-L-000123-I01` — one installment of one loan. */
export function installmentReference(
  loanNumber: number | null | undefined,
  installmentNumber: number | null | undefined,
): string {
  return `CRD-L-${pad(loanNumber ?? 0, 6)}-I${pad(installmentNumber ?? 0, 2)}`;
}

/** `CRD-R-000123` / `CRD-S-000123` — outbound guarantee refund / release. */
export function guaranteeOutboundReference(
  kind: "refund" | "release",
  guaranteeNumber: number | null | undefined,
): string {
  return `CRD-${kind === "refund" ? "R" : "S"}-${pad(guaranteeNumber ?? 0, 6)}`;
}

function internalReference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PaymentObligation {
  kind: "guarantee" | "installment";
  targetId: string;
  paymentReference: string;
  title: string;
  description: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  currency: string;
  dueDate: string | null;
  status: string;
  applicationId: string | null;
  loanId: string | null;
  guaranteeId: string | null;
}

/**
 * Everything the customer payment centre needs: what is owed, where to send
 * the money, and the history of declared/verified transfers.
 */
export async function loadPaymentCenter(supabase: UserClient, userId: string) {
  const [{ data: profile }, guarantees, loans, installments, payments, bankAccounts, applications] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, country_id, country_code").eq("id", userId).maybeSingle(),
    supabase.from("guarantees").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("loan_installments").select("*").eq("user_id", userId).order("due_date", { ascending: true }),
    supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("bank_accounts").select(BANK_ACCOUNT_COLUMNS).eq("is_active", true).order("display_order"),
    supabase.from("loan_applications").select("id, reference, status, currency_code").eq("user_id", userId),
  ]);

  const loanRows = loans.data ?? [];
  const obligations: PaymentObligation[] = [];

  for (const guarantee of guarantees.data ?? []) {
    const outstanding = round(Number(guarantee.required_amount) - Number(guarantee.received_amount));
    if (outstanding <= 0.005) continue;
    if (["cancelled", "refunded", "released", "claimed"].includes(guarantee.status)) continue;
    const application = (applications.data ?? []).find((a) => a.id === guarantee.application_id);
    obligations.push({
      kind: "guarantee",
      targetId: guarantee.id,
      paymentReference: guaranteeReference(guarantee.guarantee_number),
      title: "Guarantee deposit",
      description: application ? `Application ${application.reference}` : "Loan application",
      amountDue: Number(guarantee.required_amount),
      amountPaid: Number(guarantee.received_amount),
      outstanding,
      currency: guarantee.currency_code,
      dueDate: null,
      status: guarantee.status,
      applicationId: guarantee.application_id,
      loanId: guarantee.loan_id,
      guaranteeId: guarantee.id,
    });
  }

  for (const installment of installments.data ?? []) {
    if (["paid", "waived", "cancelled"].includes(installment.status)) continue;
    const loan = loanRows.find((l) => l.id === installment.loan_id);
    if (!loan) continue;
    const due = round(Number(installment.total_payment) + Number(installment.late_fee));
    const outstanding = round(due - Number(installment.amount_paid));
    if (outstanding <= 0.005) continue;
    obligations.push({
      kind: "installment",
      targetId: installment.id,
      paymentReference: installmentReference(loan.loan_number, installment.installment_number),
      title: `Installment ${pad(installment.installment_number, 2)}`,
      description: `Loan ${loan.reference}`,
      amountDue: due,
      amountPaid: Number(installment.amount_paid),
      outstanding,
      currency: loan.currency_code,
      dueDate: installment.due_date,
      status: installment.status,
      applicationId: loan.application_id,
      loanId: loan.id,
      guaranteeId: null,
    });
  }

  return {
    profile: profile ?? null,
    obligations,
    bankAccounts: bankAccounts.data ?? [],
    payments: payments.data ?? [],
    guarantees: guarantees.data ?? [],
    loans: loanRows,
    applications: applications.data ?? [],
  };
}

export interface DeclarationInput {
  kind: "guarantee" | "installment";
  targetId: string;
  amount: number;
  currency: string;
  transferDate: string;
  senderName: string;
  senderBankName: string;
  bankTransactionReference?: string | null | undefined;
  bankAccountId?: string | null | undefined;
  proofFilePath?: string | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
}

/**
 * Records a customer's claim that they made a bank transfer. Creates a payment
 * row in `declared` status only — no guarantee, installment or loan balance is
 * touched here, and suspicious declarations are flagged for admin review.
 */
export async function declarePayment(supabase: UserClient, userId: string, input: DeclarationInput) {
  const amount = round(Number(input.amount));
  if (!(amount > 0)) throw new Error("Enter the amount you transferred.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, country_id")
    .eq("id", userId)
    .maybeSingle();

  let purpose: string;
  let currency: string;
  let expected: number;
  let applicationId: string | null = null;
  let loanId: string | null = null;
  let guaranteeId: string | null = null;
  let installmentId: string | null = null;
  let paymentReference: string;
  let label: string;

  if (input.kind === "guarantee") {
    const { data: guarantee } = await supabase
      .from("guarantees")
      .select("*")
      .eq("id", input.targetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!guarantee) throw new Error("Guarantee not found.");
    if (["cancelled", "refunded", "released", "claimed"].includes(guarantee.status)) {
      throw new Error("This guarantee is no longer awaiting a deposit.");
    }
    expected = round(Number(guarantee.required_amount) - Number(guarantee.received_amount));
    if (expected <= 0.005) throw new Error("This guarantee is already fully funded.");
    purpose = "guarantee_deposit";
    currency = guarantee.currency_code;
    applicationId = guarantee.application_id;
    loanId = guarantee.loan_id;
    guaranteeId = guarantee.id;
    paymentReference = guaranteeReference(guarantee.guarantee_number);
    label = "guarantee deposit";
  } else {
    const { data: installment } = await supabase
      .from("loan_installments")
      .select("*")
      .eq("id", input.targetId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!installment) throw new Error("Installment not found.");
    if (["paid", "waived", "cancelled"].includes(installment.status)) {
      throw new Error("This installment is not awaiting a payment.");
    }
    const { data: loan } = await supabase
      .from("loans")
      .select("id, reference, loan_number, currency_code, application_id")
      .eq("id", installment.loan_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!loan) throw new Error("Loan not found.");
    expected = round(
      Number(installment.total_payment) + Number(installment.late_fee) - Number(installment.amount_paid),
    );
    purpose = "loan_repayment";
    currency = loan.currency_code;
    applicationId = loan.application_id;
    loanId = loan.id;
    installmentId = installment.id;
    paymentReference = installmentReference(loan.loan_number, installment.installment_number);
    label = `installment ${pad(installment.installment_number, 2)}`;
  }

  const declaredCurrency = (input.currency || currency).toUpperCase();

  if (input.proofFilePath && !input.proofFilePath.startsWith(`${userId}/`)) {
    throw new Error("Invalid upload path.");
  }

  // Mismatch detection — surfaced to staff, never auto-applied.
  const flags: string[] = [];
  if (Math.abs(amount - expected) > 0.005) flags.push(amount > expected ? "overpayment" : "amount_mismatch");
  if (declaredCurrency !== currency) flags.push("currency_mismatch");
  const bankRef = input.bankTransactionReference?.trim() ?? "";
  if (bankRef.length === 0) flags.push("missing_bank_reference");

  const expectedSender = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim().toLowerCase();
  const declaredSender = input.senderName.trim().toLowerCase();
  if (expectedSender.length > 0 && declaredSender !== expectedSender) flags.push("unexpected_sender");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (bankRef.length > 0) {
    const { data: duplicates } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("bank_transaction_reference", bankRef)
      .limit(1);
    if ((duplicates ?? []).length > 0) flags.push("duplicate_bank_reference");
  }

  const { data: open } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("payment_reference", paymentReference)
    .in("status", ["declared", "under_review"])
    .limit(1);
  if ((open ?? []).length > 0) flags.push("possible_duplicate_payment");

  const now = new Date().toISOString();
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      transaction_reference: internalReference("BT"),
      payment_reference: paymentReference,
      user_id: userId,
      application_id: applicationId,
      loan_id: loanId,
      installment_id: installmentId,
      guarantee_id: guaranteeId,
      purpose,
      direction: "inbound",
      payment_method: PAYMENT_METHOD_BANK_TRANSFER,
      amount,
      declared_amount: amount,
      declared_currency: declaredCurrency,
      currency_code: currency,
      status: "declared",
      transfer_date: input.transferDate,
      sender_name: input.senderName.trim(),
      sender_bank_name: input.senderBankName.trim(),
      bank_transaction_reference: bankRef.length > 0 ? bankRef : null,
      bank_account_id: input.bankAccountId ?? null,
      proof_file_path: input.proofFilePath ?? null,
      declared_at: now,
      mismatch_flags: flags,
      metadata: { expected_amount: expected, declaration_kind: input.kind } as never,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // A declaration only signals intent: guarantees move to payment_pending so
  // staff know funds are expected, never to received.
  if (guaranteeId) {
    const { data: guarantee } = await supabaseAdmin
      .from("guarantees")
      .select("status")
      .eq("id", guaranteeId)
      .maybeSingle();
    if (guarantee && ["required", "payment_pending"].includes(guarantee.status)) {
      await supabaseAdmin.from("guarantees").update({ status: "payment_processing" }).eq("id", guaranteeId);
    }
  }

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "payment.declared",
    entityType: "payment",
    entityId: payment.id,
    after: {
      payment_reference: paymentReference,
      declared_amount: amount,
      declared_currency: declaredCurrency,
      expected_amount: expected,
      transfer_date: input.transferDate,
      bank_transaction_reference: bankRef || null,
      mismatch_flags: flags,
    },
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  if (flags.length > 0) {
    await writeAudit({
      actorId: userId,
      actorRole: "customer",
      action: "payment.mismatch_flagged",
      entityType: "payment",
      entityId: payment.id,
      after: { mismatch_flags: flags, expected_amount: expected, declared_amount: amount },
    });
  }

  await notify({
    userId,
    category: "payment_declared",
    title: "Payment declaration received",
    body: `Thank you. We recorded your declared transfer of ${amount} ${declaredCurrency} for your ${label} (reference ${paymentReference}). Our team will confirm it once the funds appear on our bank statement.`,
    link: "/payments",
  });

  return { paymentId: payment.id, paymentReference, status: "declared" as const, flags };
}

/** Short-lived link so a customer can re-check their own uploaded proof. */
export async function signOwnProof(supabase: UserClient, userId: string, paymentId: string) {
  const { data: payment } = await supabase
    .from("payments")
    .select("proof_file_path")
    .eq("id", paymentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!payment?.proof_file_path) throw new Error("No proof of payment on this record.");
  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(payment.proof_file_path, 120);
  if (error || !data) throw new Error(error?.message ?? "Could not create a preview link.");
  return { url: data.signedUrl };
}
