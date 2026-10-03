/**
 * Credia Stage 3 — staff-side bank-transfer operations.
 *
 * Bank account configuration, payment verification, and guarantee refund /
 * release transfers. Financial state (guarantee received/locked, installment
 * paid, loan balances) changes ONLY inside this module, after a staff member
 * confirms the funds actually landed on the Credia bank statement.
 */
import type { UserClient } from "./customer.server";
import { assertStaff, hasRole, notify, writeAudit } from "./audit.server";
import { guaranteeOutboundReference } from "./bank-transfer.server";

const BANK_ACCOUNT_COLUMNS =
  "id, country_id, currency_code, label, bank_name, account_holder_name, account_number, iban, bic_swift, bank_address, payment_instructions, payment_method, display_order, is_active, created_at, updated_at";

function internalReference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function assertAdmin(supabase: UserClient, userId: string) {
  const admin = await hasRole(supabase as never, userId, "admin");
  if (!admin) throw new Error("Forbidden: administrator access required");
}

/* ------------------------------------------------------------------ */
/* Bank account configuration                                          */
/* ------------------------------------------------------------------ */

export interface BankAccountInput {
  id?: string | null | undefined;
  country_id?: string | null | undefined;
  currency_code: string;
  label?: string | null | undefined;
  bank_name: string;
  account_holder_name: string;
  account_number?: string | null | undefined;
  iban?: string | null | undefined;
  bic_swift?: string | null | undefined;
  bank_address?: string | null | undefined;
  payment_instructions: string;
  display_order: number;
  is_active: boolean;
}

export async function loadBankAccountAdmin(supabase: UserClient, userId: string) {
  await assertStaff(supabase as never, userId);
  const [accounts, countries, currencies] = await Promise.all([
    supabase.from("bank_accounts").select(BANK_ACCOUNT_COLUMNS).order("display_order"),
    supabase.from("countries").select("id, code, name, default_currency, is_active").order("name"),
    supabase.from("currencies").select("code, name, symbol").eq("is_active", true).order("code"),
  ]);
  return {
    accounts: accounts.data ?? [],
    countries: countries.data ?? [],
    currencies: currencies.data ?? [],
  };
}

export async function saveBankAccount(supabase: UserClient, userId: string, input: BankAccountInput) {
  await assertAdmin(supabase, userId);
  if (!input.account_number?.trim() && !input.iban?.trim()) {
    throw new Error("Provide an account number or an IBAN.");
  }

  const row = {
    country_id: input.country_id ?? null,
    currency_code: input.currency_code.toUpperCase(),
    label: input.label?.trim() || null,
    bank_name: input.bank_name.trim(),
    account_holder_name: input.account_holder_name.trim(),
    account_number: input.account_number?.trim() || null,
    iban: input.iban?.trim() || null,
    bic_swift: input.bic_swift?.trim() || null,
    bank_address: input.bank_address?.trim() || null,
    payment_instructions: input.payment_instructions.trim(),
    payment_method: "bank_transfer",
    display_order: input.display_order,
    is_active: input.is_active,
  };

  if (input.id) {
    const { data: before } = await supabase.from("bank_accounts").select("*").eq("id", input.id).maybeSingle();
    const { error } = await supabase.from("bank_accounts").update(row).eq("id", input.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: userId,
      actorRole: "staff",
      action: "bank_account.updated",
      entityType: "bank_account",
      entityId: input.id,
      before,
      after: row,
    });
    return { id: input.id };
  }

  const { data, error } = await supabase.from("bank_accounts").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: "bank_account.created",
    entityType: "bank_account",
    entityId: data.id,
    after: row,
  });
  return { id: data.id };
}

export async function toggleBankAccount(supabase: UserClient, userId: string, id: string, isActive: boolean) {
  await assertAdmin(supabase, userId);
  const { error } = await supabase.from("bank_accounts").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: isActive ? "bank_account.activated" : "bank_account.deactivated",
    entityType: "bank_account",
    entityId: id,
    after: { is_active: isActive },
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Bank transfer queue                                                 */
/* ------------------------------------------------------------------ */

export async function loadBankTransferAdmin(supabase: UserClient, userId: string) {
  await assertStaff(supabase as never, userId);

  const [payments, profiles, guarantees, installments, loans, applications, accounts, countries] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id, first_name, last_name, email, country_id, country_code"),
    supabase.from("guarantees").select("*"),
    supabase
      .from("loan_installments")
      .select("id, loan_id, installment_number, due_date, total_payment, late_fee, amount_paid, status"),
    supabase.from("loans").select("id, reference, loan_number, currency_code, status, user_id, application_id"),
    supabase.from("loan_applications").select("id, reference, status, user_id, currency_code"),
    supabase.from("bank_accounts").select(BANK_ACCOUNT_COLUMNS).order("display_order"),
    supabase.from("countries").select("id, code, name"),
  ]);

  const rows = payments.data ?? [];
  const count = (predicate: (p: (typeof rows)[number]) => boolean) => rows.filter(predicate).length;

  const stats = {
    pending: count((p) => p.status === "pending"),
    declared: count((p) => p.status === "declared"),
    underReview: count((p) => p.status === "under_review" || p.status === "processing"),
    verified: count((p) => p.status === "verified" || p.status === "successful"),
    rejected: count((p) => p.status === "failed"),
    refundsPending: (guarantees.data ?? []).filter((g) => ["eligible_for_refund", "refund_pending"].includes(g.status))
      .length,
    releasesPending: (guarantees.data ?? []).filter((g) =>
      ["eligible_for_release", "release_pending"].includes(g.status),
    ).length,
    mismatches: count((p) => (p.mismatch_flags ?? []).length > 0 && ["declared", "under_review"].includes(p.status)),
  };

  return {
    payments: rows,
    profiles: profiles.data ?? [],
    guarantees: guarantees.data ?? [],
    installments: installments.data ?? [],
    loans: loans.data ?? [],
    applications: applications.data ?? [],
    bankAccounts: accounts.data ?? [],
    countries: countries.data ?? [],
    stats,
  };
}

/** Staff preview of a customer's uploaded proof of payment. */
export async function signPaymentProof(supabase: UserClient, userId: string, paymentId: string) {
  await assertStaff(supabase as never, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("proof_file_path")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment?.proof_file_path) throw new Error("No proof of payment on this record.");
  const { data, error } = await supabaseAdmin.storage
    .from("kyc-documents")
    .createSignedUrl(payment.proof_file_path, 300);
  if (error || !data) throw new Error(error?.message ?? "Could not create a preview link.");
  return { url: data.signedUrl };
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Guarantee: verified funds → received → locked (or refundable if rejected). */
async function applyGuaranteeDeposit(
  admin: AdminClient,
  staffId: string,
  payment: { id: string; guarantee_id: string | null; amount: number | string; currency_code: string },
  amount: number,
) {
  const { data: guarantee } = await admin.from("guarantees").select("*").eq("id", payment.guarantee_id!).maybeSingle();
  if (!guarantee) throw new Error("Linked guarantee not found.");

  const now = new Date().toISOString();
  const received = round(Number(guarantee.received_amount) + amount);
  const required = Number(guarantee.required_amount);
  const fullyFunded = received >= required - 0.005;

  const { data: application } = guarantee.application_id
    ? await admin
        .from("loan_applications")
        .select("id, reference, status, user_id")
        .eq("id", guarantee.application_id)
        .maybeSingle()
    : { data: null };

  const rejectedApplication = application?.status === "rejected" || application?.status === "cancelled";

  // Step 1 — money received.
  await admin
    .from("guarantees")
    .update({
      received_amount: received,
      status: fullyFunded ? "received" : "payment_processing",
      received_at: fullyFunded ? now : guarantee.received_at,
    })
    .eq("id", guarantee.id);

  await admin.from("guarantee_transactions").insert({
    guarantee_id: guarantee.id,
    user_id: guarantee.user_id,
    application_id: guarantee.application_id,
    loan_id: guarantee.loan_id,
    payment_id: payment.id,
    transaction_type: "deposit",
    amount,
    currency_code: guarantee.currency_code,
    previous_status: guarantee.status,
    new_status: fullyFunded ? "received" : "payment_processing",
    status: "verified",
    performed_by: staffId,
    payment_reference: null,
    notes: "Bank transfer verified against the Credia bank statement",
  });

  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: "guarantee.marked_received",
    entityType: "guarantee",
    entityId: guarantee.id,
    before: { status: guarantee.status, received_amount: guarantee.received_amount },
    after: { status: fullyFunded ? "received" : "payment_processing", received_amount: received },
  });

  if (!fullyFunded) {
    await notify({
      userId: guarantee.user_id,
      category: "guarantee_partially_received",
      title: "Partial guarantee deposit confirmed",
      body: `We confirmed ${amount} ${guarantee.currency_code} of your guarantee. ${round(required - received)} ${guarantee.currency_code} remains outstanding.`,
      link: "/payments",
    });
    return { guaranteeStatus: "payment_processing" as const, received };
  }

  // Step 2 — fully funded guarantees lock (or become refundable when the
  // application did not go ahead).
  const nextStatus = rejectedApplication ? "eligible_for_refund" : "locked";
  await admin
    .from("guarantees")
    .update({ status: nextStatus, locked_at: nextStatus === "locked" ? now : guarantee.locked_at })
    .eq("id", guarantee.id);

  await admin.from("guarantee_transactions").insert({
    guarantee_id: guarantee.id,
    user_id: guarantee.user_id,
    application_id: guarantee.application_id,
    loan_id: guarantee.loan_id,
    payment_id: payment.id,
    transaction_type: nextStatus === "locked" ? "lock" : "adjustment",
    amount: received,
    currency_code: guarantee.currency_code,
    previous_status: "received",
    new_status: nextStatus,
    status: "verified",
    performed_by: staffId,
    notes: nextStatus === "locked" ? "Guarantee locked for the loan term" : "Application not proceeding — refundable",
  });

  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: nextStatus === "locked" ? "guarantee.locked" : "guarantee.eligible_for_refund",
    entityType: "guarantee",
    entityId: guarantee.id,
    after: { status: nextStatus, received_amount: received },
  });

  if (nextStatus === "locked" && application) {
    await admin.from("loan_applications").update({ status: "contract_pending" }).eq("id", application.id);

    const { data: quote } = await admin
      .from("loan_quotes")
      .select("*")
      .eq("application_id", application.id)
      .maybeSingle();
    const { data: existing } = await admin
      .from("contracts")
      .select("id")
      .eq("application_id", application.id)
      .maybeSingle();
    if (!existing) {
      await admin.from("contracts").insert({
        application_id: application.id,
        user_id: application.user_id,
        version: quote?.terms_version ?? "v1",
        status: "pending_acceptance",
        terms: (quote ?? {}) as never,
      });
    }
  }

  await notify({
    userId: guarantee.user_id,
    category: nextStatus === "locked" ? "guarantee_received" : "guarantee_refundable",
    title: nextStatus === "locked" ? "Guarantee received and locked" : "Guarantee refundable",
    body:
      nextStatus === "locked"
        ? `We confirmed receipt of your guarantee deposit of ${received} ${guarantee.currency_code}. It is held separately from your loan and refundable per the product terms. Next: accept your loan contract.`
        : `Your guarantee of ${received} ${guarantee.currency_code} is refundable. Our team will arrange the bank transfer back to you.`,
    link: nextStatus === "locked" ? "/loans" : "/payments",
  });

  return { guaranteeStatus: nextStatus, received };
}

/** Repayment: verified funds → installment paid/partially paid → loan recalculated. */
async function applyRepayment(
  admin: AdminClient,
  staffId: string,
  payment: { id: string; installment_id: string | null },
  amount: number,
) {
  const { data: installment } = await admin
    .from("loan_installments")
    .select("*")
    .eq("id", payment.installment_id!)
    .maybeSingle();
  if (!installment) throw new Error("Linked installment not found.");

  const { data: loan } = await admin.from("loans").select("*").eq("id", installment.loan_id).maybeSingle();
  if (!loan) throw new Error("Loan not found.");

  const now = new Date().toISOString();
  const paid = round(Number(installment.amount_paid) + amount);
  const due = round(Number(installment.total_payment) + Number(installment.late_fee));
  const settled = paid >= due - 0.005;

  await admin
    .from("loan_installments")
    .update({
      amount_paid: paid,
      status: settled ? "paid" : "partially_paid",
      paid_at: settled ? now : installment.paid_at,
    })
    .eq("id", installment.id);

  const principalApplied = Math.min(amount, Number(installment.principal_portion));
  const outstandingPrincipal = Math.max(0, round(Number(loan.outstanding_principal) - principalApplied));
  const outstandingBalance = Math.max(0, round(Number(loan.outstanding_balance) - amount));
  const amountPaid = round(Number(loan.amount_paid) + amount);

  const { data: remaining } = await admin
    .from("loan_installments")
    .select("id")
    .eq("loan_id", loan.id)
    .not("status", "in", "(paid,waived,cancelled)");

  const completed = (remaining ?? []).length === 0 && outstandingBalance <= 0.005;

  await admin
    .from("loans")
    .update({
      amount_paid: amountPaid,
      outstanding_principal: outstandingPrincipal,
      outstanding_balance: outstandingBalance,
      status: completed ? "completed" : loan.status,
      completed_at: completed ? now : loan.completed_at,
      risk_status: completed ? "normal" : loan.risk_status,
    })
    .eq("id", loan.id);

  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: settled ? "installment.marked_paid" : "installment.partially_paid",
    entityType: "loan_installment",
    entityId: installment.id,
    before: { amount_paid: installment.amount_paid, status: installment.status },
    after: { amount_paid: paid, status: settled ? "paid" : "partially_paid", payment_id: payment.id },
  });

  await notify({
    userId: loan.user_id,
    category: "payment_verified",
    title: settled ? "Installment paid" : "Partial payment confirmed",
    body: settled
      ? `We confirmed ${amount} ${loan.currency_code} for installment ${installment.installment_number} of loan ${loan.reference}. It is now marked as paid.`
      : `We confirmed ${amount} ${loan.currency_code} for installment ${installment.installment_number}. ${round(due - paid)} ${loan.currency_code} remains outstanding.`,
    link: "/repayments",
  });

  if (completed) {
    await admin.from("loan_applications").update({ status: "completed" }).eq("id", loan.application_id);
    const { data: guarantee } = await admin.from("guarantees").select("*").eq("loan_id", loan.id).maybeSingle();
    if (guarantee && ["locked", "received"].includes(guarantee.status)) {
      await admin.from("guarantees").update({ status: "eligible_for_release" }).eq("id", guarantee.id);
      await admin.from("guarantee_transactions").insert({
        guarantee_id: guarantee.id,
        user_id: guarantee.user_id,
        application_id: guarantee.application_id,
        loan_id: loan.id,
        transaction_type: "adjustment",
        amount: Number(guarantee.received_amount),
        currency_code: guarantee.currency_code,
        previous_status: guarantee.status,
        new_status: "eligible_for_release",
        status: "verified",
        performed_by: staffId,
        notes: "Loan fully repaid — guarantee eligible for release",
      });
      await writeAudit({
        actorId: staffId,
        actorRole: "staff",
        action: "guarantee.eligible_for_release",
        entityType: "guarantee",
        entityId: guarantee.id,
        after: { status: "eligible_for_release" },
      });
      await notify({
        userId: guarantee.user_id,
        category: "guarantee_eligible_for_release",
        title: "Guarantee eligible for release",
        body: `Loan ${loan.reference} is fully repaid. Your guarantee of ${guarantee.received_amount} ${guarantee.currency_code} is now eligible for release back to you.`,
        link: "/payments",
      });
    }
  }

  return { settled, loanCompleted: completed, installmentPaid: paid, outstandingBalance };
}

export interface ReviewInput {
  paymentId: string;
  action: "start_review" | "confirm" | "reject" | "request_information";
  verifiedAmount?: number | null | undefined;
  bankTransactionReference?: string | null | undefined;
  notes?: string | null | undefined;
  reason?: string | null | undefined;
}

/**
 * The single gate through which declared bank transfers become money.
 * `confirm` requires a staff member to have seen the funds on the statement.
 */
export async function reviewBankTransfer(supabase: UserClient, staffId: string, input: ReviewInput) {
  await assertStaff(supabase as never, staffId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin.from("payments").select("*").eq("id", input.paymentId).maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  if (payment.direction !== "inbound") throw new Error("Use the refund tools for outbound transfers.");
  if (["verified", "successful", "refunded"].includes(payment.status)) {
    throw new Error("This payment has already been verified.");
  }

  const now = new Date().toISOString();

  if (input.action === "start_review") {
    await supabaseAdmin
      .from("payments")
      .update({ status: "under_review", reviewed_at: now, reviewed_by: staffId, review_notes: input.notes ?? null })
      .eq("id", payment.id);
    await writeAudit({
      actorId: staffId,
      actorRole: "staff",
      action: "payment.reviewed",
      entityType: "payment",
      entityId: payment.id,
      before: { status: payment.status },
      after: { status: "under_review", notes: input.notes ?? null },
    });
    return { status: "under_review" as const };
  }

  if (input.action === "request_information") {
    if (!input.reason?.trim()) throw new Error("Explain what the customer must provide.");
    await supabaseAdmin
      .from("payments")
      .update({
        status: "under_review",
        reviewed_at: now,
        reviewed_by: staffId,
        review_notes: input.reason.trim(),
      })
      .eq("id", payment.id);
    await writeAudit({
      actorId: staffId,
      actorRole: "staff",
      action: "payment.information_requested",
      entityType: "payment",
      entityId: payment.id,
      after: { status: "under_review", request: input.reason.trim() },
    });
    await notify({
      userId: payment.user_id,
      category: "payment_information_required",
      title: "More information needed about your transfer",
      body: `${input.reason.trim()} (payment reference ${payment.payment_reference ?? payment.transaction_reference})`,
      link: "/payments",
    });
    return { status: "under_review" as const };
  }

  if (input.action === "reject") {
    if (!input.reason?.trim()) throw new Error("A rejection reason is required.");
    await supabaseAdmin
      .from("payments")
      .update({
        status: "failed",
        reviewed_at: now,
        reviewed_by: staffId,
        rejection_reason: input.reason.trim(),
      })
      .eq("id", payment.id);

    if (payment.guarantee_id) {
      const { data: guarantee } = await supabaseAdmin
        .from("guarantees")
        .select("status, received_amount")
        .eq("id", payment.guarantee_id)
        .maybeSingle();
      if (guarantee && guarantee.status === "payment_processing" && Number(guarantee.received_amount) <= 0) {
        await supabaseAdmin.from("guarantees").update({ status: "required" }).eq("id", payment.guarantee_id);
      }
    }

    await writeAudit({
      actorId: staffId,
      actorRole: "staff",
      action: "payment.rejected",
      entityType: "payment",
      entityId: payment.id,
      before: { status: payment.status },
      after: { status: "rejected", reason: input.reason.trim() },
    });
    await notify({
      userId: payment.user_id,
      category: "payment_rejected",
      title: "Payment declaration rejected",
      body: `We could not confirm the transfer for reference ${payment.payment_reference ?? payment.transaction_reference}: ${input.reason.trim()}`,
      link: "/payments",
    });
    return { status: "rejected" as const };
  }

  // confirm — funds seen on the Credia bank statement
  const amount = round(
    input.verifiedAmount && input.verifiedAmount > 0 ? Number(input.verifiedAmount) : Number(payment.amount),
  );
  if (!(amount > 0)) throw new Error("Enter the amount actually received.");

  const bankRef = input.bankTransactionReference?.trim() || payment.bank_transaction_reference;
  if (!bankRef) throw new Error("Record the bank transaction reference from your statement.");

  await supabaseAdmin
    .from("payments")
    .update({
      status: "verified",
      amount,
      bank_transaction_reference: bankRef,
      verified_at: now,
      verified_by: staffId,
      reviewed_at: payment.reviewed_at ?? now,
      reviewed_by: payment.reviewed_by ?? staffId,
      confirmed_at: now,
      review_notes: input.notes?.trim() || payment.review_notes,
    })
    .eq("id", payment.id);

  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: "payment.verified",
    entityType: "payment",
    entityId: payment.id,
    before: { status: payment.status, amount: payment.amount },
    after: { status: "verified", amount, bank_transaction_reference: bankRef },
  });

  if (payment.purpose === "guarantee_deposit" && payment.guarantee_id) {
    const result = await applyGuaranteeDeposit(supabaseAdmin, staffId, payment, amount);
    return { status: "verified" as const, ...result };
  }

  if (payment.purpose === "loan_repayment" && payment.installment_id) {
    const result = await applyRepayment(supabaseAdmin, staffId, payment, amount);
    return { status: "verified" as const, ...result };
  }

  return { status: "verified" as const };
}

/* ------------------------------------------------------------------ */
/* Guarantee refunds and releases                                      */
/* ------------------------------------------------------------------ */

export interface OutboundInput {
  guaranteeId: string;
  destinationBankName?: string | null | undefined;
  destinationAccountHolder?: string | null | undefined;
  destinationAccountNumber?: string | null | undefined;
  destinationIban?: string | null | undefined;
  destinationBicSwift?: string | null | undefined;
  notes?: string | null | undefined;
}

/** Marks a fully-funded guarantee on a rejected application as refundable. */
export async function markGuaranteeRefundable(supabase: UserClient, staffId: string, guaranteeId: string) {
  await assertStaff(supabase as never, staffId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: guarantee } = await supabaseAdmin.from("guarantees").select("*").eq("id", guaranteeId).maybeSingle();
  if (!guarantee) throw new Error("Guarantee not found.");
  if (Number(guarantee.received_amount) <= 0) throw new Error("No funds have been received for this guarantee.");
  if (!["received", "locked", "payment_processing"].includes(guarantee.status)) {
    throw new Error("This guarantee cannot be marked refundable from its current status.");
  }

  await supabaseAdmin.from("guarantees").update({ status: "eligible_for_refund" }).eq("id", guaranteeId);
  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: "guarantee.eligible_for_refund",
    entityType: "guarantee",
    entityId: guaranteeId,
    before: { status: guarantee.status },
    after: { status: "eligible_for_refund" },
  });
  await notify({
    userId: guarantee.user_id,
    category: "guarantee_refundable",
    title: "Guarantee refundable",
    body: `Your guarantee of ${guarantee.received_amount} ${guarantee.currency_code} is refundable. Our team will arrange the bank transfer.`,
    link: "/payments",
  });
  return { status: "eligible_for_refund" as const };
}

/**
 * Starts an outbound bank transfer back to the customer. Creates a `pending`
 * outbound payment; the guarantee is not refunded/released until the transfer
 * is confirmed as actually sent.
 */
export async function initiateGuaranteeOutbound(
  supabase: UserClient,
  staffId: string,
  kind: "refund" | "release",
  input: OutboundInput,
) {
  await assertStaff(supabase as never, staffId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: guarantee } = await supabaseAdmin
    .from("guarantees")
    .select("*")
    .eq("id", input.guaranteeId)
    .maybeSingle();
  if (!guarantee) throw new Error("Guarantee not found.");

  const expected = kind === "refund" ? "eligible_for_refund" : "eligible_for_release";
  if (guarantee.status !== expected) {
    throw new Error(`This guarantee must be ${expected.replace(/_/g, " ")} before a ${kind} can start.`);
  }

  const amount = round(Number(guarantee.received_amount) - Number(guarantee.refunded_amount));
  if (!(amount > 0)) throw new Error("Nothing left to return on this guarantee.");

  const destination = {
    bank_name: input.destinationBankName?.trim() || null,
    account_holder_name: input.destinationAccountHolder?.trim() || null,
    account_number: input.destinationAccountNumber?.trim() || null,
    iban: input.destinationIban?.trim() || null,
    bic_swift: input.destinationBicSwift?.trim() || null,
  };
  if (!destination.account_number && !destination.iban) {
    throw new Error("Record the customer's destination account number or IBAN.");
  }

  const paymentReference = guaranteeOutboundReference(kind, guarantee.guarantee_number);
  const nextStatus = kind === "refund" ? "refund_pending" : "release_pending";

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      transaction_reference: internalReference(kind === "refund" ? "GREF" : "GREL"),
      payment_reference: paymentReference,
      user_id: guarantee.user_id,
      application_id: guarantee.application_id,
      loan_id: guarantee.loan_id,
      guarantee_id: guarantee.id,
      purpose: kind === "refund" ? "guarantee_refund" : "guarantee_release",
      direction: "outbound",
      payment_method: "bank_transfer",
      amount,
      currency_code: guarantee.currency_code,
      status: "pending",
      review_notes: input.notes?.trim() || null,
      metadata: { destination_bank: destination } as never,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("guarantees").update({ status: nextStatus }).eq("id", guarantee.id);
  await supabaseAdmin.from("guarantee_transactions").insert({
    guarantee_id: guarantee.id,
    user_id: guarantee.user_id,
    application_id: guarantee.application_id,
    loan_id: guarantee.loan_id,
    payment_id: payment.id,
    transaction_type: kind === "refund" ? "refund" : "release",
    amount,
    currency_code: guarantee.currency_code,
    previous_status: guarantee.status,
    new_status: nextStatus,
    status: "processing",
    performed_by: staffId,
    payment_reference: paymentReference,
    destination_bank: destination as never,
    notes: input.notes?.trim() || `${kind === "refund" ? "Refund" : "Release"} initiated`,
  });

  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: kind === "refund" ? "guarantee.refund_initiated" : "guarantee.release_initiated",
    entityType: "guarantee",
    entityId: guarantee.id,
    before: { status: guarantee.status },
    after: { status: nextStatus, amount, payment_reference: paymentReference, destination_bank: destination },
  });

  await notify({
    userId: guarantee.user_id,
    category: kind === "refund" ? "guarantee_refund_pending" : "guarantee_release_pending",
    title: kind === "refund" ? "Guarantee refund in progress" : "Guarantee release in progress",
    body: `We are transferring ${amount} ${guarantee.currency_code} back to your bank account. Reference ${paymentReference}.`,
    link: "/payments",
  });

  return { status: nextStatus, paymentId: payment.id, paymentReference, amount };
}

/** Confirms the outbound transfer actually left the Credia account. */
export async function completeGuaranteeOutbound(
  supabase: UserClient,
  staffId: string,
  input: { paymentId: string; bankTransactionReference: string; outcome: "completed" | "failed"; notes?: string | null },
) {
  await assertStaff(supabase as never, staffId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin.from("payments").select("*").eq("id", input.paymentId).maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  if (payment.direction !== "outbound") throw new Error("This is not an outbound transfer.");
  if (["verified", "successful", "failed"].includes(payment.status)) {
    throw new Error("This transfer is already finalised.");
  }
  if (!payment.guarantee_id) throw new Error("This transfer is not linked to a guarantee.");
  if (input.outcome === "completed" && !input.bankTransactionReference.trim()) {
    throw new Error("Record the outgoing bank transaction reference.");
  }

  const { data: guarantee } = await supabaseAdmin
    .from("guarantees")
    .select("*")
    .eq("id", payment.guarantee_id)
    .maybeSingle();
  if (!guarantee) throw new Error("Guarantee not found.");

  const now = new Date().toISOString();
  const isRefund = payment.purpose === "guarantee_refund";
  const amount = round(Number(payment.amount));

  if (input.outcome === "failed") {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", reviewed_by: staffId, reviewed_at: now, failure_reason: input.notes ?? null })
      .eq("id", payment.id);
    await supabaseAdmin
      .from("guarantees")
      .update({ status: isRefund ? "eligible_for_refund" : "eligible_for_release" })
      .eq("id", guarantee.id);
    await supabaseAdmin
      .from("guarantee_transactions")
      .update({ status: "failed", notes: input.notes ?? "Transfer failed" })
      .eq("payment_id", payment.id);
    await writeAudit({
      actorId: staffId,
      actorRole: "staff",
      action: isRefund ? "guarantee.refund_failed" : "guarantee.release_failed",
      entityType: "guarantee",
      entityId: guarantee.id,
      after: { status: isRefund ? "eligible_for_refund" : "eligible_for_release", notes: input.notes ?? null },
    });
    return { status: "failed" as const };
  }

  const finalStatus = isRefund ? "refunded" : "released";
  const refunded = round(Number(guarantee.refunded_amount) + amount);

  await supabaseAdmin
    .from("payments")
    .update({
      status: "verified",
      bank_transaction_reference: input.bankTransactionReference.trim(),
      verified_at: now,
      verified_by: staffId,
      confirmed_at: now,
      review_notes: input.notes ?? payment.review_notes,
    })
    .eq("id", payment.id);

  await supabaseAdmin
    .from("guarantees")
    .update({ status: finalStatus, refunded_amount: refunded, released_at: now })
    .eq("id", guarantee.id);

  await supabaseAdmin
    .from("guarantee_transactions")
    .update({
      status: "verified",
      new_status: finalStatus,
      completed_at: now,
      provider_reference: input.bankTransactionReference.trim(),
      notes: input.notes ?? "Transfer confirmed sent",
    })
    .eq("payment_id", payment.id);

  await writeAudit({
    actorId: staffId,
    actorRole: "staff",
    action: isRefund ? "guarantee.refund_completed" : "guarantee.release_completed",
    entityType: "guarantee",
    entityId: guarantee.id,
    before: { status: guarantee.status },
    after: {
      status: finalStatus,
      amount,
      refunded_amount: refunded,
      bank_transaction_reference: input.bankTransactionReference.trim(),
    },
  });

  await notify({
    userId: guarantee.user_id,
    category: isRefund ? "guarantee_refunded" : "guarantee_released",
    title: isRefund ? "Guarantee refund completed" : "Guarantee released",
    body: `We transferred ${amount} ${guarantee.currency_code} back to your bank account. Bank reference ${input.bankTransactionReference.trim()}.`,
    link: "/payments",
  });

  return { status: finalStatus };
}
