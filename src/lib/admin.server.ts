import { assertStaff, notify, writeAudit } from "./audit.server";
import type { UserClient } from "./customer.server";
import { computeCreditScore } from "./loan-math";

export async function loadAdminOverview(supabase: UserClient, actorId: string) {
  await assertStaff(supabase, actorId);

  const [profiles, kyc, applications, loans, guarantees, payments] = await Promise.all([
    supabase.from("profiles").select("id, account_status, kyc_completed, created_at"),
    supabase.from("kyc_verifications").select("id, status"),
    supabase
      .from("loan_applications")
      .select("id, status, requested_amount, currency_code, submitted_at, created_at"),
    supabase
      .from("loans")
      .select("id, status, risk_status, principal_amount, outstanding_balance, amount_paid, currency_code, days_overdue"),
    supabase.from("guarantees").select("id, status, received_amount, refunded_amount, currency_code"),
    supabase.from("payments").select("id, status, amount, currency_code, purpose"),
  ]);

  const p = profiles.data ?? [];
  const apps = applications.data ?? [];
  const ln = loans.data ?? [];
  const g = guarantees.data ?? [];
  const pay = payments.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const sum = (rows: { amount?: string | null; [k: string]: unknown }[], field: string) =>
    rows.reduce((total, row) => total + Number((row as Record<string, unknown>)[field] ?? 0), 0);

  const activeLoans = ln.filter((l) => l.status === "active");
  const defaulted = ln.filter((l) => l.status === "defaulted" || l.risk_status === "default");

  return {
    customers: {
      total: p.length,
      verified: p.filter((r) => r.account_status === "verified").length,
      pendingKyc: (kyc.data ?? []).filter((r) => r.status === "under_review" || r.status === "pending").length,
      suspended: p.filter((r) => r.account_status === "suspended" || r.account_status === "blocked").length,
    },
    applications: {
      today: apps.filter((a) => (a.created_at ?? "").slice(0, 10) === today).length,
      pending: apps.filter((a) =>
        [
          "submitted",
          "kyc_review",
          "document_review",
          "risk_analysis",
          "guarantee_required",
          "guarantee_pending",
          "underwriting",
          "on_hold",
        ].includes(a.status),
      ).length,
      approved: apps.filter((a) =>
        ["approved", "contract_pending", "ready_for_disbursement", "disbursed", "active", "completed"].includes(
          a.status,
        ),
      ).length,
      rejected: apps.filter((a) => a.status === "rejected").length,
      total: apps.length,
    },
    portfolio: {
      activeLoans: activeLoans.length,
      totalDisbursed: sum(ln, "principal_amount"),
      totalOutstanding: sum(ln, "outstanding_balance"),
      totalRepaid: sum(ln, "amount_paid"),
      overdueAmount: sum(
        ln.filter((l) => (l.days_overdue ?? 0) > 0),
        "outstanding_balance",
      ),
      defaultRate: ln.length === 0 ? 0 : defaulted.length / ln.length,
    },
    guarantees: {
      held: sum(
        g.filter((row) => ["received", "locked", "releasable", "partially_claimed"].includes(row.status)),
        "received_amount",
      ),
      released: sum(g, "refunded_amount"),
      awaiting: g.filter((row) => ["required", "pending_payment"].includes(row.status)).length,
    },
    payments: {
      successful: pay.filter((row) => row.status === "successful").length,
      pending: pay.filter((row) => ["pending", "processing"].includes(row.status)).length,
      failed: pay.filter((row) => row.status === "failed").length,
    },
  };
}

export async function loadKycQueue(supabase: UserClient, actorId: string) {
  await assertStaff(supabase, actorId);

  const [{ data: kyc }, { data: profiles }, { data: documents }] = await Promise.all([
    supabase.from("kyc_verifications").select("*").order("submitted_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, email, phone, country_code, account_status, kyc_completed, credit_score, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, user_id, document_type, status, file_name, created_at, rejection_reason")
      .order("created_at", { ascending: false }),
  ]);

  const docsByUser = new Map<string, NonNullable<typeof documents>>();
  for (const doc of documents ?? []) {
    const list = docsByUser.get(doc.user_id) ?? [];
    list.push(doc);
    docsByUser.set(doc.user_id, list as NonNullable<typeof documents>);
  }
  const kycByUser = new Map((kyc ?? []).map((k) => [k.user_id, k]));

  return (profiles ?? []).map((profile) => ({
    profile,
    kyc: kycByUser.get(profile.id) ?? null,
    documents: docsByUser.get(profile.id) ?? [],
  }));
}

export async function loadDossier(supabase: UserClient, actorId: string, targetId: string) {
  await assertStaff(supabase, actorId);

  const [profile, kyc, documents, applications, loans, scores, decisions] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", targetId).maybeSingle(),
    supabase.from("kyc_verifications").select("*").eq("user_id", targetId).maybeSingle(),
    supabase.from("documents").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
    supabase.from("loan_applications").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
    supabase.from("loans").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
    supabase.from("credit_scores").select("*").eq("user_id", targetId).order("computed_at", { ascending: false }).limit(5),
    supabase.from("credit_decisions").select("*").eq("user_id", targetId).order("created_at", { ascending: false }),
  ]);

  const p = profile.data;
  const loanRows = loans.data ?? [];
  const preview = p
    ? computeCreditScore({
        kycApproved: kyc.data?.status === "approved",
        monthlyIncome: p.monthly_income ? Number(p.monthly_income) : null,
        monthlyDebt: p.monthly_debt_payments ? Number(p.monthly_debt_payments) : null,
        employmentStatus: p.employment_status,
        completedLoans: loanRows.filter((l) => l.status === "completed").length,
        latePayments: loanRows.reduce((n, l) => n + (l.missed_installments ?? 0), 0),
        defaults: loanRows.filter((l) => l.status === "defaulted").length,
        accountAgeDays: Math.floor(
          (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24),
        ),
        applicationsLast30Days: (applications.data ?? []).filter(
          (a) => Date.now() - new Date(a.created_at).getTime() < 30 * 24 * 60 * 60 * 1000,
        ).length,
        fraudFlags: 0,
      })
    : null;

  return {
    profile: p,
    kyc: kyc.data,
    documents: documents.data ?? [],
    applications: applications.data ?? [],
    loans: loanRows,
    scores: scores.data ?? [],
    decisions: decisions.data ?? [],
    indicativeScore: preview,
  };
}

export async function decideDocument(
  supabase: UserClient,
  actorId: string,
  input: { documentId: string; decision: "approved" | "rejected" | "under_review" | "expired"; reason?: string | null },
) {
  await assertStaff(supabase, actorId);
  if (input.decision === "rejected" && !input.reason?.trim()) {
    throw new Error("A rejection reason is required so the customer knows what to fix.");
  }

  const before = await supabase.from("documents").select("*").eq("id", input.documentId).maybeSingle();
  if (!before.data) throw new Error("Document not found");

  const { data, error } = await supabase
    .from("documents")
    .update({
      status: input.decision,
      rejection_reason: input.decision === "rejected" ? (input.reason ?? null) : null,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.documentId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId,
    actorRole: "staff",
    action: `document.${input.decision}`,
    entityType: "document",
    entityId: input.documentId,
    before: before.data,
    after: data,
  });

  if (input.decision === "rejected") {
    await notify({
      userId: before.data.user_id,
      category: "document_rejected",
      title: "A document needs your attention",
      body: `${before.data.document_type.replace(/_/g, " ")} was rejected. Reason: ${input.reason}`,
      link: "/documents",
      channels: ["in_app", "email"],
    });
  }

  return { ok: true };
}

export async function applyKycDecision(
  supabase: UserClient,
  actorId: string,
  input: { userId: string; decision: "approved" | "rejected"; notes?: string | null; reason?: string | null },
) {
  await assertStaff(supabase, actorId);
  if (input.decision === "rejected" && !input.reason?.trim()) {
    throw new Error("A rejection reason is required.");
  }

  const now = new Date().toISOString();
  const existing = await supabase.from("kyc_verifications").select("*").eq("user_id", input.userId).maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from("kyc_verifications")
      .update({
        status: input.decision,
        reviewed_by: actorId,
        reviewed_at: now,
        decision_notes: input.notes ?? null,
        rejection_reason: input.decision === "rejected" ? (input.reason ?? null) : null,
      })
      .eq("id", existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("kyc_verifications").insert({
      user_id: input.userId,
      status: input.decision,
      reviewed_by: actorId,
      reviewed_at: now,
      decision_notes: input.notes ?? null,
      rejection_reason: input.decision === "rejected" ? (input.reason ?? null) : null,
    });
    if (error) throw new Error(error.message);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      kyc_completed: input.decision === "approved",
      account_status: input.decision === "approved" ? "verified" : "pending_verification",
      status_reason: input.decision === "rejected" ? (input.reason ?? null) : null,
    })
    .eq("id", input.userId);
  if (profileError) throw new Error(profileError.message);

  await writeAudit({
    actorId,
    actorRole: "staff",
    action: `kyc.${input.decision}`,
    entityType: "kyc_verification",
    entityId: input.userId,
    after: { decision: input.decision, notes: input.notes ?? null, reason: input.reason ?? null },
  });

  await notify({
    userId: input.userId,
    category: input.decision === "approved" ? "kyc_approved" : "kyc_rejected",
    title: input.decision === "approved" ? "Identity verified" : "Identity verification unsuccessful",
    body:
      input.decision === "approved"
        ? "Your identity has been verified. You can now start a loan application."
        : `We could not verify your identity. Reason: ${input.reason}`,
    link: "/documents",
    channels: ["in_app", "email"],
  });

  return { ok: true };
}

export async function applyAccountStatus(
  supabase: UserClient,
  actorId: string,
  input: {
    userId: string;
    status: "pending_verification" | "verified" | "rejected" | "suspended" | "blocked";
    reason?: string | null;
  },
) {
  await assertStaff(supabase, actorId);
  const before = await supabase.from("profiles").select("account_status, status_reason").eq("id", input.userId).maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ account_status: input.status, status_reason: input.reason ?? null })
    .eq("id", input.userId);
  if (error) throw new Error(error.message);

  await writeAudit({
    actorId,
    actorRole: "staff",
    action: "account.status_changed",
    entityType: "profile",
    entityId: input.userId,
    before: before.data,
    after: { account_status: input.status, status_reason: input.reason ?? null },
  });

  await notify({
    userId: input.userId,
    category: "account_status",
    title: "Your account status changed",
    body: `Your account status is now "${input.status.replace(/_/g, " ")}".${input.reason ? ` Reason: ${input.reason}` : ""}`,
    link: "/dashboard",
    channels: ["in_app", "email"],
  });

  return { ok: true };
}

/** Short-lived signed URL so staff can view a private KYC file. */
export async function signDocument(supabase: UserClient, actorId: string, documentId: string) {
  await assertStaff(supabase, actorId);
  const { data: doc } = await supabase.from("documents").select("file_path, user_id").eq("id", documentId).maybeSingle();
  if (!doc) throw new Error("Document not found");

  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(doc.file_path, 120);
  if (error || !data) throw new Error(error?.message ?? "Could not create a preview link");

  await writeAudit({
    actorId,
    actorRole: "staff",
    action: "document.viewed",
    entityType: "document",
    entityId: documentId,
  });

  return { url: data.signedUrl };
}
