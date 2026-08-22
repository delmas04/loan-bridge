/**
 * Credia Stage 2 — customer-side lending logic.
 *
 * Every financial figure in this module is derived server-side from the
 * loan product configuration and the deterministic engine in `loan-math.ts`.
 * Amounts submitted by the browser are only ever treated as *requests*.
 */
import type { UserClient } from "./customer.server";
import { notify, writeAudit } from "./audit.server";
import { buildQuote, type Frequency } from "./loan-math";

export const LOAN_PURPOSES = [
  "personal",
  "education",
  "business",
  "medical",
  "emergency",
  "home_improvement",
  "other",
] as const;

export const QUOTE_VERSION = "q1";
export const TERMS_VERSION = "v1";

const PRODUCT_COLUMNS =
  "id, name, description, country_id, currency_code, min_amount, max_amount, min_duration_months, max_duration_months, annual_interest_rate, origination_fee_rate, guarantee_percentage, allowed_frequencies, required_documents, eligibility_requirements, eligibility_rules, processing_time, is_active";

function reference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}

/** Everything the multi-step application wizard needs, scoped to the caller. */
export async function loadApplyContext(supabase: UserClient, userId: string) {
  const [{ data: profile }, { data: kyc }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("kyc_verifications").select("status, rejection_reason").eq("user_id", userId).maybeSingle(),
    supabase.from("documents").select("id, document_type, status").eq("user_id", userId),
  ]);

  const countryId = profile?.country_id ?? null;

  const [{ data: country }, { data: products }, { data: currencies }] = await Promise.all([
    countryId
      ? supabase
          .from("countries")
          .select("id, code, name, default_currency, guarantee_percentage, lending_enabled")
          .eq("id", countryId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    countryId
      ? supabase
          .from("loan_products")
          .select(PRODUCT_COLUMNS)
          .eq("country_id", countryId)
          .eq("is_active", true)
          .order("min_amount")
      : Promise.resolve({ data: [] }),
    supabase.from("currencies").select("code, name, symbol, decimal_places").eq("is_active", true),
  ]);

  const { data: openApplications } = await supabase
    .from("loan_applications")
    .select("id, reference, status, requested_amount, currency_code, created_at")
    .eq("user_id", userId)
    .not("status", "in", "(completed,rejected,cancelled)")
    .order("created_at", { ascending: false });

  return {
    profile: profile ?? null,
    kyc: kyc ?? null,
    documents: documents ?? [],
    country: country ?? null,
    products: products ?? [],
    currencies: currencies ?? [],
    openApplications: openApplications ?? [],
    purposes: LOAN_PURPOSES as unknown as string[],
  };
}

export interface QuoteRequest {
  productId: string;
  amount: number;
  durationMonths: number;
  frequency: Frequency;
}

/** Validates the request against the product + customer limits, then prices it. */
export async function createQuote(supabase: UserClient, userId: string, input: QuoteRequest) {
  const [{ data: product }, { data: profile }] = await Promise.all([
    supabase.from("loan_products").select(PRODUCT_COLUMNS).eq("id", input.productId).maybeSingle(),
    supabase
      .from("profiles")
      .select("country_id, credit_limit, credit_limit_currency, account_status, kyc_completed")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (!product || !product.is_active) throw new Error("This loan product is not available.");
  if (!profile?.country_id) throw new Error("Complete your profile before requesting a quote.");
  if (product.country_id !== profile.country_id) {
    throw new Error("This product is not offered in your country of residence.");
  }
  if (profile.account_status === "blocked" || profile.account_status === "suspended") {
    throw new Error("Your account is not eligible for new credit. Contact support.");
  }

  const { data: country } = await supabase
    .from("countries")
    .select("id, code, lending_enabled")
    .eq("id", product.country_id)
    .maybeSingle();
  if (!country?.lending_enabled) throw new Error("Lending is not yet enabled for your country.");

  const amount = Math.round(Number(input.amount) * 100) / 100;
  const min = Number(product.min_amount);
  const max = Number(product.max_amount);
  if (!Number.isFinite(amount) || amount < min) throw new Error(`Minimum amount for this product is ${min}.`);
  if (amount > max) throw new Error(`Maximum amount for this product is ${max}.`);

  if (profile.credit_limit !== null && Number(profile.credit_limit) > 0 && amount > Number(profile.credit_limit)) {
    throw new Error(`Your current eligible credit limit is ${Number(profile.credit_limit)}.`);
  }

  const duration = Math.round(Number(input.durationMonths));
  if (duration < product.min_duration_months || duration > product.max_duration_months) {
    throw new Error(
      `Duration must be between ${product.min_duration_months} and ${product.max_duration_months} months.`,
    );
  }

  const allowed = (product.allowed_frequencies ?? []) as string[];
  if (!allowed.includes(input.frequency)) throw new Error("That repayment frequency is not available.");

  const quote = buildQuote({
    amount,
    durationMonths: duration,
    frequency: input.frequency,
    annualInterestRate: Number(product.annual_interest_rate),
    guaranteePercentage: Number(product.guarantee_percentage),
    currency: product.currency_code,
  });

  const { data: row, error } = await supabase
    .from("loan_quotes")
    .insert({
      user_id: userId,
      product_id: product.id,
      country_id: product.country_id,
      currency_code: product.currency_code,
      amount: quote.amount,
      duration_months: duration,
      repayment_frequency: input.frequency,
      annual_interest_rate: quote.annualInterestRate,
      periodic_interest_rate: quote.periodicInterestRate,
      installment_count: quote.installmentCount,
      installment_amount: quote.installmentAmount,
      final_installment_amount: quote.finalInstallmentAmount,
      total_interest: quote.totalInterest,
      total_repayable: quote.totalRepayable,
      guarantee_percentage: quote.guaranteePercentage,
      guarantee_amount: quote.guaranteeAmount,
      first_due_date: quote.firstDueDate,
      final_due_date: quote.finalDueDate,
      processing_time: product.processing_time,
      schedule: quote.schedule as never,
      quote_version: QUOTE_VERSION,
      terms_version: TERMS_VERSION,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await notify({
    userId,
    category: "quote_generated",
    title: "Your loan quote is ready",
    body: `We priced ${quote.amount} ${product.currency_code} over ${quote.installmentCount} ${input.frequency} installments. Review and accept the terms to continue.`,
    link: "/apply",
  });

  return { quote: row, product };
}

export interface SubmitInput {
  quoteId: string;
  purpose: string;
  monthlyIncome: number;
  employmentStatus: string;
  employerName?: string | null;
  monthlyExpenses: number;
  existingDebt: number;
  otherObligations?: string | null;
  acceptTerms: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Accepts a quote snapshot and creates the application. The quote row becomes
 * immutable once `accepted_at` is stamped: later product changes never
 * retro-price an existing application.
 */
export async function submitApplication(supabase: UserClient, userId: string, input: SubmitInput) {
  if (!input.acceptTerms) throw new Error("You must accept the loan terms to submit an application.");
  if (!(LOAN_PURPOSES as readonly string[]).includes(input.purpose)) throw new Error("Select a valid loan purpose.");

  const { data: quote } = await supabase
    .from("loan_quotes")
    .select("*")
    .eq("id", input.quoteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!quote) throw new Error("Quote not found.");
  if (quote.accepted_at) throw new Error("This quote has already been submitted.");
  if (new Date(quote.expires_at).getTime() < Date.now()) throw new Error("This quote has expired. Generate a new one.");

  const [{ data: product }, { data: kyc }, { data: documents }] = await Promise.all([
    supabase.from("loan_products").select(PRODUCT_COLUMNS).eq("id", quote.product_id).maybeSingle(),
    supabase.from("kyc_verifications").select("status").eq("user_id", userId).maybeSingle(),
    supabase.from("documents").select("document_type, status").eq("user_id", userId),
  ]);
  if (!product) throw new Error("Loan product unavailable.");

  const approved = new Set((documents ?? []).filter((d) => d.status === "approved").map((d) => d.document_type));
  const missing = ((product.required_documents ?? []) as string[]).filter((type) => !approved.has(type));
  if (missing.length > 0) {
    throw new Error(`These documents must be approved before submission: ${missing.join(", ")}`);
  }
  if (kyc?.status !== "approved") {
    throw new Error("Your identity verification must be approved before you can submit an application.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const { data: application, error } = await supabaseAdmin
    .from("loan_applications")
    .insert({
      reference: reference("APP"),
      user_id: userId,
      country_id: quote.country_id,
      product_id: quote.product_id,
      quote_id: quote.id,
      currency_code: quote.currency_code,
      requested_amount: quote.amount,
      duration_months: quote.duration_months,
      repayment_frequency: quote.repayment_frequency,
      purpose: input.purpose,
      declared_monthly_income: input.monthlyIncome,
      declared_monthly_debt: input.existingDebt,
      declared_monthly_expenses: input.monthlyExpenses,
      employment_status: input.employmentStatus,
      employer_name: input.employerName ?? null,
      other_obligations: input.otherObligations ?? null,
      annual_interest_rate: quote.annual_interest_rate,
      guarantee_percentage: quote.guarantee_percentage,
      guarantee_amount: quote.guarantee_amount,
      installment_amount: quote.installment_amount,
      installment_count: quote.installment_count,
      total_repayable: quote.total_repayable,
      total_interest: quote.total_interest,
      status: "submitted",
      terms_accepted_at: now,
      submitted_at: now,
      sla_due_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("loan_quotes")
    .update({
      accepted_at: now,
      application_id: application.id,
      accepted_ip: input.ip ?? null,
      accepted_user_agent: input.userAgent ?? null,
    })
    .eq("id", quote.id);

  await supabaseAdmin.from("guarantees").insert({
    application_id: application.id,
    user_id: userId,
    currency_code: quote.currency_code,
    percentage: quote.guarantee_percentage,
    required_amount: quote.guarantee_amount,
    status: "required",
  });

  await supabaseAdmin
    .from("profiles")
    .update({
      monthly_income: input.monthlyIncome,
      monthly_debt_payments: input.existingDebt,
      employment_status: input.employmentStatus,
      employer_name: input.employerName ?? null,
    })
    .eq("id", userId);

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "application.submitted",
    entityType: "loan_application",
    entityId: application.id,
    after: {
      quote_id: quote.id,
      amount: quote.amount,
      currency: quote.currency_code,
      duration_months: quote.duration_months,
      frequency: quote.repayment_frequency,
      terms_version: quote.terms_version,
    },
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  await notify({
    userId,
    category: "application_submitted",
    title: `Application ${application.reference} received`,
    body: `We are reviewing your request. Expected processing time: ${product.processing_time}.`,
    link: "/loans",
  });

  return { application };
}

/** Full customer lending picture: applications, loans, schedule, guarantees. */
export async function loadMyLending(supabase: UserClient, userId: string) {
  const [applications, loans, installments, guarantees, transactions, payments, quotes] = await Promise.all([
    supabase
      .from("loan_applications")
      .select(
        "id, reference, status, status_reason, requested_amount, approved_amount, currency_code, duration_months, repayment_frequency, purpose, installment_amount, installment_count, total_repayable, total_interest, guarantee_amount, guarantee_percentage, annual_interest_rate, submitted_at, decision_at, created_at, product_id, quote_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("loan_installments")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true }),
    supabase.from("guarantees").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("guarantee_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("loan_quotes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const productIds = [...new Set((applications.data ?? []).map((a) => a.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("loan_products").select("id, name, description, processing_time").in("id", productIds)
    : { data: [] };

  const { data: providers } = await supabase
    .from("payment_providers")
    .select("id, code, name, supported_methods, supported_country_codes")
    .eq("is_active", true);

  return {
    applications: applications.data ?? [],
    loans: loans.data ?? [],
    installments: installments.data ?? [],
    guarantees: guarantees.data ?? [],
    transactions: transactions.data ?? [],
    payments: payments.data ?? [],
    quotes: quotes.data ?? [],
    products: products ?? [],
    providers: providers ?? [],
  };
}

export interface DepositInput {
  guaranteeId: string;
  providerId?: string | null;
  method: string;
}

/**
 * Records the *intent* to pay a guarantee deposit. No money is moved and the
 * guarantee is never marked received here — only a verified successful
 * provider transaction (reconciled by staff/webhook) can do that.
 */
export async function initiateGuaranteeDeposit(supabase: UserClient, userId: string, input: DepositInput) {
  const { data: guarantee } = await supabase
    .from("guarantees")
    .select("*")
    .eq("id", input.guaranteeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!guarantee) throw new Error("Guarantee not found.");
  if (!["required", "payment_pending", "payment_processing"].includes(guarantee.status)) {
    throw new Error("This guarantee is not awaiting a deposit.");
  }

  const outstanding = Number(guarantee.required_amount) - Number(guarantee.received_amount);
  if (outstanding <= 0) throw new Error("No outstanding guarantee balance.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ref = reference("GDEP");

  const { data: payment, error: payErr } = await supabaseAdmin
    .from("payments")
    .insert({
      transaction_reference: ref,
      user_id: userId,
      application_id: guarantee.application_id,
      loan_id: guarantee.loan_id,
      provider_id: input.providerId ?? null,
      purpose: "guarantee_deposit",
      direction: "inbound",
      payment_method: input.method,
      amount: outstanding.toFixed(2),
      currency_code: guarantee.currency_code,
      status: "pending",
      metadata: { guarantee_id: guarantee.id } as never,
    })
    .select("*")
    .single();
  if (payErr) throw new Error(payErr.message);

  const { error: txErr } = await supabaseAdmin.from("guarantee_transactions").insert({
    guarantee_id: guarantee.id,
    user_id: userId,
    application_id: guarantee.application_id,
    loan_id: guarantee.loan_id,
    payment_id: payment.id,
    provider_id: input.providerId ?? null,
    transaction_type: "deposit",
    amount: outstanding.toFixed(2),
    currency_code: guarantee.currency_code,
    previous_status: guarantee.status,
    new_status: "payment_pending",
    status: "pending",
    notes: `Deposit initiated via ${input.method}`,
  });
  if (txErr) throw new Error(txErr.message);

  await supabaseAdmin
    .from("guarantees")
    .update({ status: "payment_pending" })
    .eq("id", guarantee.id);

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "guarantee.deposit_initiated",
    entityType: "guarantee",
    entityId: guarantee.id,
    after: { payment_reference: ref, amount: outstanding, method: input.method },
  });

  await notify({
    userId,
    category: "guarantee_payment_pending",
    title: "Guarantee deposit pending",
    body: `We are waiting for your guarantee deposit of ${outstanding.toFixed(2)} ${guarantee.currency_code}. Reference ${ref}. Your guarantee is held separately from your loan repayments and is refundable under the product terms.`,
    link: "/guarantee",
  });

  return { paymentReference: ref, amount: outstanding.toFixed(2), currency: guarantee.currency_code };
}

/** Customer accepts the loan contract, moving the application to disbursement. */
export async function acceptContract(
  supabase: UserClient,
  userId: string,
  input: { contractId: string; ip?: string | null; userAgent?: string | null },
) {
  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", input.contractId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!contract) throw new Error("Contract not found.");
  if (contract.status === "accepted") return { ok: true };
  if (contract.status !== "pending_acceptance") throw new Error("This contract cannot be accepted.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  await supabaseAdmin
    .from("contracts")
    .update({
      status: "accepted",
      accepted_at: now,
      accepted_ip: input.ip ?? null,
      accepted_user_agent: input.userAgent ?? null,
    })
    .eq("id", contract.id);

  await supabaseAdmin
    .from("loan_applications")
    .update({ status: "ready_for_disbursement" })
    .eq("id", contract.application_id);

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "contract.accepted",
    entityType: "contract",
    entityId: contract.id,
    after: { version: contract.version },
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  await notify({
    userId,
    category: "loan_ready_for_disbursement",
    title: "Contract accepted",
    body: "Your loan contract is signed and your loan is queued for disbursement.",
    link: "/loans",
  });

  return { ok: true };
}

/** Contracts awaiting the customer's signature. */
export async function loadMyContracts(supabase: UserClient, userId: string) {
  const { data } = await supabase
    .from("contracts")
    .select("id, application_id, loan_id, version, status, accepted_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
