import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProfileInput } from "./customer.functions";
import { notify, writeAudit } from "./audit.server";

export type UserClient = SupabaseClient<Database>;

function publicClient(): UserClient {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Public lending configuration: countries, currencies and active products. */
export async function loadReferenceData() {
  const supabase = publicClient();
  const [countries, currencies, products] = await Promise.all([
    supabase
      .from("countries")
      .select("id, code, name, default_currency, phone_prefix, guarantee_percentage, lending_enabled, kyc_requirements")
      .eq("is_active", true)
      .order("name"),
    supabase.from("currencies").select("code, name, symbol, decimal_places").eq("is_active", true),
    supabase
      .from("loan_products")
      .select(
        "id, name, country_id, currency_code, min_amount, max_amount, min_duration_months, max_duration_months, annual_interest_rate, guarantee_percentage, allowed_frequencies, required_documents, early_repayment_rules, late_payment_rules",
      )
      .eq("is_active", true),
  ]);

  return {
    countries: countries.data ?? [],
    currencies: currencies.data ?? [],
    products: products.data ?? [],
  };
}

export async function loadCustomerOverview(supabase: UserClient, userId: string) {
  const [profile, kyc, documents, notifications, roles] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("kyc_verifications").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("documents")
      .select("id, document_type, file_name, file_path, status, rejection_reason, created_at, reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id, category, title, body, link, read_at, created_at")
      .eq("user_id", userId)
      .eq("channel", "in_app")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const country = profile.data?.country_id
    ? (
        await supabase
          .from("countries")
          .select("id, code, name, default_currency, guarantee_percentage")
          .eq("id", profile.data.country_id)
          .maybeSingle()
      ).data
    : null;

  const requiredDocuments = country
    ? ((
        await supabase
          .from("loan_products")
          .select("required_documents")
          .eq("country_id", country.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
      ).data?.required_documents ?? [])
    : [];

  return {
    profile: profile.data,
    kyc: kyc.data,
    documents: documents.data ?? [],
    notifications: notifications.data ?? [],
    roles: (roles.data ?? []).map((r) => r.role),
    country,
    requiredDocuments,
  };
}

export async function persistProfile(supabase: UserClient, userId: string, data: ProfileInput) {
  const country = await supabase
    .from("countries")
    .select("id, code, default_currency")
    .eq("id", data.country_id)
    .maybeSingle();
  if (!country.data) throw new Error("Unsupported country");

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      country_id: country.data.id,
      country_code: country.data.code,
      date_of_birth: data.date_of_birth,
      address_line1: data.address_line1 ?? null,
      address_line2: data.address_line2 ?? null,
      city: data.city ?? null,
      postal_code: data.postal_code ?? null,
      employment_status: data.employment_status ?? null,
      employer_name: data.employer_name ?? null,
      monthly_income: data.monthly_income ?? null,
      income_currency: country.data.default_currency,
      monthly_debt_payments: data.monthly_debt_payments ?? null,
      bank_name: data.bank_name ?? null,
      bank_account_name: data.bank_account_name ?? null,
      bank_account_number: data.bank_account_number ?? null,
      mobile_money_number: data.mobile_money_number ?? null,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "profile.updated",
    entityType: "profile",
    entityId: userId,
  });

  return { ok: true };
}

/** Customer asks for their KYC pack to be reviewed. Never self-approves. */
export async function submitKyc(supabase: UserClient, userId: string) {
  const [{ data: profile }, { data: docs }] = await Promise.all([
    supabase.from("profiles").select("country_id, first_name, last_name, date_of_birth, phone").eq("id", userId).maybeSingle(),
    supabase.from("documents").select("document_type, status").eq("user_id", userId),
  ]);

  if (!profile?.country_id || !profile.first_name || !profile.last_name || !profile.date_of_birth) {
    throw new Error("Complete your profile details before submitting KYC.");
  }

  const { data: product } = await supabase
    .from("loan_products")
    .select("required_documents")
    .eq("country_id", profile.country_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const required: string[] = product?.required_documents ?? [];
  const uploaded = new Set(
    (docs ?? []).filter((d) => d.status !== "rejected" && d.status !== "expired").map((d) => d.document_type),
  );
  const missing = required.filter((type) => !uploaded.has(type));
  if (missing.length > 0) {
    throw new Error(`Missing required documents: ${missing.join(", ")}`);
  }

  const now = new Date().toISOString();
  const existing = await supabase.from("kyc_verifications").select("id, status").eq("user_id", userId).maybeSingle();

  if (existing.data) {
    if (existing.data.status === "approved") return { ok: true, status: "approved" as const };
    const { error } = await supabase
      .from("kyc_verifications")
      .update({ status: "under_review", submitted_at: now, rejection_reason: null })
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("kyc_verifications")
      .insert({ user_id: userId, status: "under_review", submitted_at: now });
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    actorId: userId,
    actorRole: "customer",
    action: "kyc.submitted",
    entityType: "kyc_verification",
    entityId: userId,
  });
  await notify({
    userId,
    category: "kyc_submitted",
    title: "Identity verification submitted",
    body: "Your documents are queued for review. We will notify you once a decision has been made.",
    link: "/documents",
    channels: ["in_app", "email"],
  });

  return { ok: true, status: "under_review" as const };
}

export async function markRead(supabase: UserClient, id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
