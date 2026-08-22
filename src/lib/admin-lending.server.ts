/**
 * Credia Stage 2 — staff-side lending operations.
 *
 * Product configuration, application decisions, guarantee reconciliation,
 * disbursement, repayment posting and guarantee release. Every state change
 * writes an audit row and, where the customer is affected, a notification.
 */
import type { UserClient } from "./customer.server";
import { assertStaff, hasRole, notify, writeAudit } from "./audit.server";
import { buildQuote, type Frequency } from "./loan-math";

const PRODUCT_COLUMNS =
  "id, name, description, country_id, currency_code, min_amount, max_amount, min_duration_months, max_duration_months, annual_interest_rate, origination_fee_rate, guarantee_percentage, allowed_frequencies, required_documents, eligibility_requirements, eligibility_rules, processing_time, is_active, created_at, updated_at";

function reference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}

async function assertAdmin(supabase: UserClient, userId: string) {
  const admin = await hasRole(supabase as never, userId, "admin");
  if (!admin) throw new Error("Forbidden: administrator access required");
}

export interface ProductInput {
  id?: string | null | undefined;
  name: string;
  description?: string | null | undefined;
  country_id: string;
  currency_code: string;
  min_amount: number;
  max_amount: number;
  min_duration_months: number;
  max_duration_months: number;
  annual_interest_rate: number;
  origination_fee_rate: number;
  guarantee_percentage: number;
  allowed_frequencies: string[];
  required_documents: string[];
  eligibility_requirements: string[];
  processing_time: string;
  is_active: boolean;
}

export async function loadProductAdmin(supabase: UserClient, userId: string) {
  await assertStaff(supabase as never, userId);
  const [products, countries, currencies] = await Promise.all([
    supabase.from("loan_products").select(PRODUCT_COLUMNS).order("name"),
    supabase
      .from("countries")
      .select("id, code, name, default_currency, guarantee_percentage, lending_enabled, is_active")
      .order("name"),
    supabase.from("currencies").select("code, name, symbol, decimal_places").order("code"),
  ]);
  return {
    products: products.data ?? [],
    countries: countries.data ?? [],
    currencies: currencies.data ?? [],
    isAdmin: await hasRole(supabase as never, userId, "admin"),
  };
}

export async function saveProduct(supabase: UserClient, userId: string, input: ProductInput) {
  await assertAdmin(supabase, userId);

  if (input.min_amount > input.max_amount) throw new Error("Minimum amount cannot exceed maximum amount.");
  if (input.min_duration_months > input.max_duration_months) {
    throw new Error("Minimum duration cannot exceed maximum duration.");
  }
  if (input.allowed_frequencies.length === 0) throw new Error("Select at least one repayment frequency.");

  const payload = {
    name: input.name,
    description: input.description ?? null,
    country_id: input.country_id,
    currency_code: input.currency_code,
    min_amount: input.min_amount,
    max_amount: input.max_amount,
    min_duration_months: input.min_duration_months,
    max_duration_months: input.max_duration_months,
    annual_interest_rate: input.annual_interest_rate,
    origination_fee_rate: input.origination_fee_rate,
    guarantee_percentage: input.guarantee_percentage,
    allowed_frequencies: input.allowed_frequencies as never,
    required_documents: input.required_documents,
    eligibility_requirements: input.eligibility_requirements,
    processing_time: input.processing_time,
    is_active: input.is_active,
  };

  if (input.id) {
    const before = await supabase.from("loan_products").select(PRODUCT_COLUMNS).eq("id", input.id).maybeSingle();
    const { data, error } = await supabase
      .from("loan_products")
      .update(payload)
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: userId,
      actorRole: "admin",
      action: "loan_product.updated",
      entityType: "loan_product",
      entityId: input.id,
      before: before.data,
      after: payload,
    });
    return { id: data?.id ?? input.id };
  }

  const { data, error } = await supabase.from("loan_products").insert(payload).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  await writeAudit({
    actorId: userId,
    actorRole: "admin",
    action: "loan_product.created",
    entityType: "loan_product",
    entityId: data?.id ?? null,
    after: payload,
  });
  return { id: data?.id ?? null };
}

export async function toggleProduct(supabase: UserClient, userId: string, id: string, isActive: boolean) {
  await assertAdmin(supabase, userId);
  const { error } = await supabase.from("loan_products").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  await writeAudit({
    actorId: userId,
    actorRole: "admin",
    action: isActive ? "loan_product.activated" : "loan_product.deactivated",
    entityType: "loan_product",
    entityId: id,
  });
  return { ok: true };
}

/** Underwriting queue with the figures staff need at a glance. */
export async function loadApplicationQueue(supabase: UserClient, userId: string) {
  await assertStaff(supabase as never, userId);
  const { data: applications } = await supabase
    .from("loan_applications")
    .select(
      "id, reference, user_id, status, status_reason, requested_amount, approved_amount, currency_code, duration_months, repayment_frequency, purpose, guarantee_amount, installment_amount, total_repayable, submitted_at, created_at, sla_due_at, product_id, country_id",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const userIds = [...new Set((applications ?? []).map((a) => a.user_id))];
  const [{ data: profiles }, { data: kycs }, { data: products }, { data: guarantees }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, first_name, last_name, email, country_code, kyc_completed, credit_score, credit_limit, account_status").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("kyc_verifications").select("user_id, status").in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    supabase.from("loan_products").select("id, name, currency_code, processing_time"),
    supabase.from("guarantees").select("id, application_id, status, required_amount, received_amount, currency_code"),
  ]);

  return {
    applications: applications ?? [],
    profiles: profiles ?? [],
    kycs: kycs ?? [],
    products: products ?? [],
    guarantees: guarantees ?? [],
  };
}

export async function loadApplicationDetail(supabase: UserClient, userId: string, applicationId: string) {
  await assertStaff(supabase as never, userId);

  const { data: application } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) throw new Error("Application not found.");

  const [profile, kyc, documents, quote, product, guarantee, loan, decisions, contract] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", application.user_id).maybeSingle(),
    supabase.from("kyc_verifications").select("*").eq("user_id", application.user_id).maybeSingle(),
    supabase
      .from("documents")
      .select("id, document_type, file_name, status, rejection_reason, created_at")
      .eq("user_id", application.user_id),
    application.quote_id
      ? supabase.from("loan_quotes").select("*").eq("id", application.quote_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("loan_products").select(PRODUCT_COLUMNS).eq("id", application.product_id).maybeSingle(),
    supabase.from("guarantees").select("*").eq("application_id", applicationId).maybeSingle(),
    supabase.from("loans").select("*").eq("application_id", applicationId).maybeSingle(),
    supabase
      .from("credit_decisions")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase.from("contracts").select("*").eq("application_id", applicationId).maybeSingle(),
  ]);

  const installments = loan.data
    ? (await supabase.from("loan_installments").select("*").eq("loan_id", loan.data.id).order("installment_number")).data ?? []
    : [];

  const transactions = guarantee.data
    ? (
        await supabase
          .from("guarantee_transactions")
          .select("*")
          .eq("guarantee_id", guarantee.data.id)
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  const payments = (
    await supabase
      .from("payments")
      .select("*")
      .eq("user_id", application.user_id)
      .order("created_at", { ascending: false })
      .limit(50)
  ).data ?? [];

  return {
    application,
    profile: profile.data,
    kyc: kyc.data,
    documents: documents.data ?? [],
    quote: quote.data,
    product: product.data,
    guarantee: guarantee.data,
    loan: loan.data,
    installments,
    transactions,
    payments,
    decisions: decisions.data ?? [],
    contract: contract.data,
  };
}

export interface DecisionInput {
  applicationId: string;
  decision: "approve" | "reject" | "request_information";
  approvedAmount?: number | null | undefined;
  notes?: string | null | undefined;
  reason?: string | null | undefined;
}

export async function decideApplication(supabase: UserClient, userId: string, input: DecisionInput) {
  await assertStaff(supabase as never, userId);

  const { data: application } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (!application) throw new Error("Application not found.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  if (input.decision === "request_information") {
    if (!input.reason) throw new Error("Describe the information the customer must provide.");
    const { error } = await supabaseAdmin
      .from("loan_applications")
      .update({ status: "additional_information_required", status_reason: input.reason })
      .eq("id", application.id);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: userId,
      actorRole: "staff",
      action: "application.information_requested",
      entityType: "loan_application",
      entityId: application.id,
      before: { status: application.status },
      after: { status: "additional_information_required", reason: input.reason },
    });
    await notify({
      userId: application.user_id,
      category: "additional_information_required",
      title: `More information needed for ${application.reference}`,
      body: input.reason,
      link: "/loans",
    });
    return { status: "additional_information_required" as const };
  }

  if (input.decision === "reject") {
    if (!input.reason) throw new Error("A rejection reason is required.");
    const { error } = await supabaseAdmin
      .from("loan_applications")
      .update({ status: "rejected", status_reason: input.reason, decision_at: now })
      .eq("id", application.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("credit_decisions").insert({
      application_id: application.id,
      user_id: application.user_id,
      decision: "rejected",
      reasons: [input.reason],
      notes: input.notes ?? null,
      decided_by: userId,
    });

    // Any guarantee still un-locked becomes refundable / cancelled.
    const { data: guarantee } = await supabaseAdmin
      .from("guarantees")
      .select("*")
      .eq("application_id", application.id)
      .maybeSingle();
    if (guarantee) {
      const received = Number(guarantee.received_amount);
      const nextStatus = received > 0 ? "eligible_for_release" : "cancelled";
      await supabaseAdmin.from("guarantees").update({ status: nextStatus }).eq("id", guarantee.id);
      await supabaseAdmin.from("guarantee_transactions").insert({
        guarantee_id: guarantee.id,
        user_id: guarantee.user_id,
        application_id: application.id,
        transaction_type: "adjustment",
        amount: Number(received.toFixed(2)),
        currency_code: guarantee.currency_code,
        previous_status: guarantee.status,
        new_status: nextStatus,
        status: "successful",
        performed_by: userId,
        notes: "Application rejected — guarantee refundable per product terms",
      });
    }

    await writeAudit({
      actorId: userId,
      actorRole: "staff",
      action: "application.rejected",
      entityType: "loan_application",
      entityId: application.id,
      before: { status: application.status },
      after: { status: "rejected", reason: input.reason },
    });
    await notify({
      userId: application.user_id,
      category: "loan_rejected",
      title: `Application ${application.reference} was not approved`,
      body: input.reason,
      link: "/loans",
    });
    return { status: "rejected" as const };
  }

  // Approve — the amount can be trimmed, and the quote is re-priced server-side
  // for the approved amount while keeping the accepted product terms.
  const requested = Number(application.requested_amount);
  const approved = input.approvedAmount && input.approvedAmount > 0 ? Number(input.approvedAmount) : requested;
  if (approved > requested) throw new Error("Approved amount cannot exceed the requested amount.");

  const { data: product } = await supabase
    .from("loan_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", application.product_id)
    .maybeSingle();
  if (!product) throw new Error("Loan product unavailable.");

  const quote = buildQuote({
    amount: approved,
    durationMonths: application.duration_months,
    frequency: application.repayment_frequency as Frequency,
    annualInterestRate: Number(application.annual_interest_rate ?? product.annual_interest_rate),
    guaranteePercentage: Number(application.guarantee_percentage ?? product.guarantee_percentage),
    currency: application.currency_code,
  });

  const { error } = await supabaseAdmin
    .from("loan_applications")
    .update({
      status: "guarantee_required",
      approved_amount: Number(quote.amount),
      approved_duration_months: application.duration_months,
      installment_amount: Number(quote.installmentAmount),
      installment_count: quote.installmentCount,
      total_interest: Number(quote.totalInterest),
      total_repayable: Number(quote.totalRepayable),
      guarantee_amount: Number(quote.guaranteeAmount),
      status_reason: null,
      decision_at: now,
      assigned_to: userId,
    })
    .eq("id", application.id);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("credit_decisions").insert({
    application_id: application.id,
    user_id: application.user_id,
    decision: "approved",
    decided_amount: Number(quote.amount),
    decided_duration_months: application.duration_months,
    reasons: ["Underwriting approved"],
    notes: input.notes ?? null,
    decided_by: userId,
  });

  const { data: guarantee } = await supabaseAdmin
    .from("guarantees")
    .select("*")
    .eq("application_id", application.id)
    .maybeSingle();
  if (guarantee) {
    await supabaseAdmin
      .from("guarantees")
      .update({ required_amount: Number(quote.guaranteeAmount), percentage: quote.guaranteePercentage })
      .eq("id", guarantee.id);
  } else {
    await supabaseAdmin.from("guarantees").insert({
      application_id: application.id,
      user_id: application.user_id,
      currency_code: application.currency_code,
      percentage: quote.guaranteePercentage,
      required_amount: Number(quote.guaranteeAmount),
      status: "required",
    });
  }

  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: "application.approved",
    entityType: "loan_application",
    entityId: application.id,
    before: { status: application.status },
    after: { status: "guarantee_required", approved_amount: quote.amount, guarantee_amount: quote.guaranteeAmount },
  });
  await notify({
    userId: application.user_id,
    category: "loan_approved",
    title: `Application ${application.reference} approved`,
    body: `Approved amount ${quote.amount} ${application.currency_code}. Next step: place your refundable guarantee deposit of ${quote.guaranteeAmount} ${application.currency_code}. The guarantee is held separately and is never part of your interest or repayments.`,
    link: "/guarantee",
  });
  await notify({
    userId: application.user_id,
    category: "guarantee_required",
    title: "Guarantee deposit required",
    body: `A guarantee of ${quote.guaranteeAmount} ${application.currency_code} (${(quote.guaranteePercentage * 100).toFixed(2)}%) is required before disbursement.`,
    link: "/guarantee",
  });

  return { status: "guarantee_required" as const, approvedAmount: quote.amount };
}

/**
 * Staff reconciliation of a real inbound deposit. Requires the provider's
 * transaction reference — the guarantee only becomes `received`/`locked` once
 * a payment row is verified successful.
 */
export async function confirmGuaranteeDeposit(
  supabase: UserClient,
  userId: string,
  input: { paymentId: string; providerReference: string; amount?: number | null | undefined },
) {
  await assertStaff(supabase as never, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin.from("payments").select("*").eq("id", input.paymentId).maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  if (payment.purpose !== "guarantee_deposit") throw new Error("This payment is not a guarantee deposit.");
  if (payment.status === "successful") throw new Error("This deposit is already reconciled.");

  const { data: tx } = await supabaseAdmin
    .from("guarantee_transactions")
    .select("*")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (!tx) throw new Error("No guarantee transaction linked to this payment.");

  const { data: guarantee } = await supabaseAdmin
    .from("guarantees")
    .select("*")
    .eq("id", tx.guarantee_id)
    .maybeSingle();
  if (!guarantee) throw new Error("Guarantee not found.");

  const amount = input.amount && input.amount > 0 ? Number(input.amount) : Number(payment.amount);
  const now = new Date().toISOString();

  await supabaseAdmin
    .from("payments")
    .update({ status: "successful", provider_reference: input.providerReference, confirmed_at: now })
    .eq("id", payment.id);

  const received = Number(guarantee.received_amount) + amount;
  const required = Number(guarantee.required_amount);
  const fullyFunded = received >= required - 0.005;

  const { data: application } = await supabaseAdmin
    .from("loan_applications")
    .select("id, reference, status, user_id, currency_code")
    .eq("id", guarantee.application_id)
    .maybeSingle();

  const nextStatus = fullyFunded ? (application?.status === "rejected" ? "eligible_for_release" : "locked") : "payment_processing";

  await supabaseAdmin
    .from("guarantees")
    .update({
      received_amount: Number(received.toFixed(2)),
      status: nextStatus,
      received_at: fullyFunded ? now : guarantee.received_at,
      locked_at: nextStatus === "locked" ? now : guarantee.locked_at,
    })
    .eq("id", guarantee.id);

  await supabaseAdmin
    .from("guarantee_transactions")
    .update({
      status: "successful",
      provider_reference: input.providerReference,
      new_status: nextStatus,
      notes: `${tx.notes ?? "Deposit"} — verified by staff`,
      performed_by: userId,
    })
    .eq("id", tx.id);

  if (fullyFunded && application && application.status !== "rejected") {
    await supabaseAdmin
      .from("loan_applications")
      .update({ status: "contract_pending" })
      .eq("id", application.id);

    const { data: quote } = await supabaseAdmin
      .from("loan_quotes")
      .select("*")
      .eq("application_id", application.id)
      .maybeSingle();

    const existingContract = await supabaseAdmin
      .from("contracts")
      .select("id")
      .eq("application_id", application.id)
      .maybeSingle();

    if (!existingContract.data) {
      await supabaseAdmin.from("contracts").insert({
        application_id: application.id,
        user_id: application.user_id,
        version: quote?.terms_version ?? "v1",
        status: "pending_acceptance",
        terms: (quote ?? {}) as never,
      });
    }

    await notify({
      userId: application.user_id,
      category: "guarantee_received",
      title: "Guarantee received and locked",
      body: `We verified your guarantee deposit of ${received.toFixed(2)} ${guarantee.currency_code}. It is held separately from your loan and refundable per the product terms. Next: accept your loan contract.`,
      link: "/loans",
    });
  }

  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: "guarantee.deposit_verified",
    entityType: "guarantee",
    entityId: guarantee.id,
    before: { status: guarantee.status, received_amount: guarantee.received_amount },
    after: { status: nextStatus, received_amount: received, provider_reference: input.providerReference },
  });

  return { status: nextStatus, received: received.toFixed(2) };
}

/** Creates the loan and its full amortisation schedule from the accepted quote. */
export async function disburseLoan(supabase: UserClient, userId: string, applicationId: string) {
  await assertStaff(supabase as never, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: application } = await supabaseAdmin
    .from("loan_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) throw new Error("Application not found.");
  if (!["ready_for_disbursement", "contract_pending"].includes(application.status)) {
    throw new Error("The application is not ready for disbursement.");
  }

  const { data: contract } = await supabaseAdmin
    .from("contracts")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (contract?.status !== "accepted") throw new Error("The customer has not accepted the contract yet.");

  const { data: guarantee } = await supabaseAdmin
    .from("guarantees")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!guarantee || guarantee.status !== "locked") throw new Error("The guarantee must be received and locked first.");

  const existing = await supabaseAdmin.from("loans").select("id").eq("application_id", applicationId).maybeSingle();
  if (existing.data) throw new Error("This application already has a loan.");

  const principal = Number(application.approved_amount ?? application.requested_amount);
  const quote = buildQuote({
    amount: principal,
    durationMonths: application.approved_duration_months ?? application.duration_months,
    frequency: application.repayment_frequency as Frequency,
    annualInterestRate: Number(application.annual_interest_rate ?? 0),
    guaranteePercentage: Number(application.guarantee_percentage ?? 0),
    currency: application.currency_code,
    startDate: new Date(),
  });

  const now = new Date().toISOString();
  const { data: loan, error } = await supabaseAdmin
    .from("loans")
    .insert({
      reference: reference("LN"),
      application_id: application.id,
      user_id: application.user_id,
      product_id: application.product_id,
      currency_code: application.currency_code,
      principal_amount: Number(quote.amount),
      annual_interest_rate: quote.annualInterestRate,
      duration_months: quote.durationMonths,
      repayment_frequency: quote.frequency,
      installment_amount: Number(quote.installmentAmount),
      installment_count: quote.installmentCount,
      total_interest: Number(quote.totalInterest),
      total_repayable: Number(quote.totalRepayable),
      outstanding_principal: Number(quote.amount),
      outstanding_balance: Number(quote.totalRepayable),
      first_due_date: quote.firstDueDate,
      final_due_date: quote.finalDueDate,
      disbursed_at: now,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const rows = quote.schedule.map((row) => ({
    loan_id: loan.id,
    user_id: application.user_id,
    installment_number: row.installment_number,
    due_date: row.due_date,
    total_payment: Number(row.total_payment),
    principal_portion: Number(row.principal_portion),
    interest_portion: Number(row.interest_portion),
    remaining_principal: Number(row.remaining_principal),
    status: "upcoming" as const,
  }));
  const { error: schedErr } = await supabaseAdmin.from("loan_installments").insert(rows);
  if (schedErr) throw new Error(schedErr.message);

  await supabaseAdmin
    .from("loan_applications")
    .update({ status: "disbursed", disbursed_at: now })
    .eq("id", application.id);
  await supabaseAdmin.from("guarantees").update({ loan_id: loan.id }).eq("id", guarantee.id);
  await supabaseAdmin.from("contracts").update({ loan_id: loan.id }).eq("id", contract.id);

  await supabaseAdmin.from("payments").insert({
    transaction_reference: reference("DISB"),
    user_id: application.user_id,
    loan_id: loan.id,
    application_id: application.id,
    purpose: "disbursement",
    direction: "outbound",
    amount: Number(quote.amount),
    currency_code: application.currency_code,
    status: "pending",
    metadata: { note: "Awaiting provider settlement confirmation" } as never,
  });

  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: "loan.disbursed",
    entityType: "loan",
    entityId: loan.id,
    after: {
      principal: quote.amount,
      installments: quote.installmentCount,
      total_repayable: quote.totalRepayable,
      total_interest: quote.totalInterest,
    },
  });
  await notify({
    userId: application.user_id,
    category: "loan_disbursed",
    title: `Loan ${loan.reference} disbursed`,
    body: `Your repayment schedule of ${quote.installmentCount} installments of ${quote.installmentAmount} ${application.currency_code} is now available. First payment due ${quote.firstDueDate}.`,
    link: "/repayments",
  });

  return { loanId: loan.id, reference: loan.reference, installments: quote.installmentCount };
}

/** Posts a verified repayment against an installment and rolls up loan balances. */
export async function recordRepayment(
  supabase: UserClient,
  userId: string,
  input: { installmentId: string; amount: number; providerReference: string; method: string },
) {
  await assertStaff(supabase as never, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: installment } = await supabaseAdmin
    .from("loan_installments")
    .select("*")
    .eq("id", input.installmentId)
    .maybeSingle();
  if (!installment) throw new Error("Installment not found.");

  const { data: loan } = await supabaseAdmin.from("loans").select("*").eq("id", installment.loan_id).maybeSingle();
  if (!loan) throw new Error("Loan not found.");

  const amount = Number(input.amount);
  if (!(amount > 0)) throw new Error("Enter a positive amount.");

  const now = new Date().toISOString();
  const paid = Number(installment.amount_paid) + amount;
  const due = Number(installment.total_payment) + Number(installment.late_fee);
  const settled = paid >= due - 0.005;

  await supabaseAdmin.from("payments").insert({
    transaction_reference: reference("RPMT"),
    user_id: loan.user_id,
    loan_id: loan.id,
    installment_id: installment.id,
    purpose: "repayment",
    direction: "inbound",
    payment_method: input.method,
    amount: Number(amount.toFixed(2)),
    currency_code: loan.currency_code,
    status: "successful",
    provider_reference: input.providerReference,
    confirmed_at: now,
  });

  await supabaseAdmin
    .from("loan_installments")
    .update({
      amount_paid: Number(paid.toFixed(2)),
      status: settled ? "paid" : "partially_paid",
      paid_at: settled ? now : installment.paid_at,
    })
    .eq("id", installment.id);

  const principalApplied = Math.min(amount, Number(installment.principal_portion));
  const outstandingPrincipal = Math.max(0, Number(loan.outstanding_principal) - principalApplied);
  const outstandingBalance = Math.max(0, Number(loan.outstanding_balance) - amount);
  const amountPaid = Number(loan.amount_paid) + amount;

  const { data: remaining } = await supabaseAdmin
    .from("loan_installments")
    .select("id")
    .eq("loan_id", loan.id)
    .neq("status", "paid")
    .neq("status", "waived")
    .neq("status", "cancelled");

  const completed = (remaining ?? []).length === 0 && outstandingBalance <= 0.005;

  await supabaseAdmin
    .from("loans")
    .update({
      amount_paid: Number(amountPaid.toFixed(2)),
      outstanding_principal: Number(outstandingPrincipal.toFixed(2)),
      outstanding_balance: Number(outstandingBalance.toFixed(2)),
      status: completed ? "completed" : loan.status,
      completed_at: completed ? now : loan.completed_at,
      risk_status: completed ? "normal" : loan.risk_status,
    })
    .eq("id", loan.id);

  await notify({
    userId: loan.user_id,
    category: "payment_received",
    title: "Repayment received",
    body: `We recorded ${amount.toFixed(2)} ${loan.currency_code} against installment ${installment.installment_number} of loan ${loan.reference}.`,
    link: "/repayments",
  });

  if (completed) {
    await supabaseAdmin.from("loan_applications").update({ status: "completed" }).eq("id", loan.application_id);

    const { data: guarantee } = await supabaseAdmin
      .from("guarantees")
      .select("*")
      .eq("loan_id", loan.id)
      .maybeSingle();
    if (guarantee && guarantee.status === "locked") {
      await supabaseAdmin
        .from("guarantees")
        .update({ status: "eligible_for_release" })
        .eq("id", guarantee.id);
      await supabaseAdmin.from("guarantee_transactions").insert({
        guarantee_id: guarantee.id,
        user_id: guarantee.user_id,
        application_id: guarantee.application_id,
        loan_id: loan.id,
        transaction_type: "adjustment",
        amount: Number(guarantee.received_amount),
        currency_code: guarantee.currency_code,
        previous_status: "locked",
        new_status: "eligible_for_release",
        status: "successful",
        performed_by: userId,
        notes: "Loan fully repaid — guarantee eligible for release",
      });
      await notify({
        userId: guarantee.user_id,
        category: "guarantee_eligible_for_release",
        title: "Guarantee eligible for release",
        body: `Your loan ${loan.reference} is fully repaid. Your guarantee of ${guarantee.received_amount} ${guarantee.currency_code} is now eligible for release back to you.`,
        link: "/guarantee",
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("successful_loans_count")
      .eq("id", loan.user_id)
      .maybeSingle();
    await supabaseAdmin
      .from("profiles")
      .update({ successful_loans_count: (profile?.successful_loans_count ?? 0) + 1 })
      .eq("id", loan.user_id);
  }

  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: "repayment.recorded",
    entityType: "loan_installment",
    entityId: installment.id,
    before: { amount_paid: installment.amount_paid, status: installment.status },
    after: { amount_paid: paid, status: settled ? "paid" : "partially_paid", provider_reference: input.providerReference },
  });

  return { settled, loanCompleted: completed };
}

/** Two-step release: eligible → release_pending → released/refunded. */
export async function releaseGuarantee(
  supabase: UserClient,
  userId: string,
  input: { guaranteeId: string; action: "start_release" | "confirm_release"; providerReference?: string | null | undefined },
) {
  await assertStaff(supabase as never, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: guarantee } = await supabaseAdmin
    .from("guarantees")
    .select("*")
    .eq("id", input.guaranteeId)
    .maybeSingle();
  if (!guarantee) throw new Error("Guarantee not found.");

  const now = new Date().toISOString();

  if (input.action === "start_release") {
    if (guarantee.status !== "eligible_for_release") {
      throw new Error("This guarantee is not eligible for release yet.");
    }
    await supabaseAdmin.from("guarantees").update({ status: "release_pending" }).eq("id", guarantee.id);
    await supabaseAdmin.from("guarantee_transactions").insert({
      guarantee_id: guarantee.id,
      user_id: guarantee.user_id,
      application_id: guarantee.application_id,
      loan_id: guarantee.loan_id,
      transaction_type: "release",
      amount: Number(guarantee.received_amount),
      currency_code: guarantee.currency_code,
      previous_status: guarantee.status,
      new_status: "release_pending",
      status: "processing",
      performed_by: userId,
      notes: "Release initiated",
    });
    await supabaseAdmin.from("payments").insert({
      transaction_reference: reference("GREL"),
      user_id: guarantee.user_id,
      loan_id: guarantee.loan_id,
      application_id: guarantee.application_id,
      purpose: "guarantee_release",
      direction: "outbound",
      amount: Number(guarantee.received_amount),
      currency_code: guarantee.currency_code,
      status: "processing",
      metadata: { guarantee_id: guarantee.id } as never,
    });
    await writeAudit({
      actorId: userId,
      actorRole: "staff",
      action: "guarantee.release_started",
      entityType: "guarantee",
      entityId: guarantee.id,
      before: { status: guarantee.status },
      after: { status: "release_pending" },
    });
    return { status: "release_pending" as const };
  }

  if (guarantee.status !== "release_pending") throw new Error("Start the release before confirming it.");
  if (!input.providerReference) throw new Error("A provider transaction reference is required.");

  const amount = Number(guarantee.received_amount);
  const refunded = Number(guarantee.refunded_amount) + amount;

  await supabaseAdmin
    .from("guarantees")
    .update({ status: "released", refunded_amount: refunded, released_at: now })
    .eq("id", guarantee.id);
  await supabaseAdmin.from("guarantee_transactions").insert({
    guarantee_id: guarantee.id,
    user_id: guarantee.user_id,
    application_id: guarantee.application_id,
    loan_id: guarantee.loan_id,
    transaction_type: "release",
    amount: Number(amount.toFixed(2)),
    currency_code: guarantee.currency_code,
    previous_status: "release_pending",
    new_status: "released",
    status: "successful",
    provider_reference: input.providerReference,
    performed_by: userId,
    notes: "Guarantee returned to customer",
  });

  await writeAudit({
    actorId: userId,
    actorRole: "staff",
    action: "guarantee.released",
    entityType: "guarantee",
    entityId: guarantee.id,
    after: { status: "released", amount, provider_reference: input.providerReference },
  });
  await notify({
    userId: guarantee.user_id,
    category: "guarantee_released",
    title: "Guarantee released",
    body: `Your guarantee of ${amount.toFixed(2)} ${guarantee.currency_code} has been returned. Reference ${input.providerReference}.`,
    link: "/guarantee",
  });

  return { status: "released" as const };
}

export async function loadGuaranteeAdmin(supabase: UserClient, userId: string) {
  await assertStaff(supabase as never, userId);
  const [guarantees, transactions, applications, profiles, payments] = await Promise.all([
    supabase.from("guarantees").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("guarantee_transactions").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("loan_applications").select("id, reference, status, user_id, currency_code"),
    supabase.from("profiles").select("id, first_name, last_name, email"),
    supabase
      .from("payments")
      .select("id, transaction_reference, user_id, application_id, amount, currency_code, status, purpose, payment_method, created_at")
      .eq("purpose", "guarantee_deposit")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  return {
    guarantees: guarantees.data ?? [],
    transactions: transactions.data ?? [],
    applications: applications.data ?? [],
    profiles: profiles.data ?? [],
    depositPayments: payments.data ?? [],
  };
}
