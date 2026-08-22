/**
 * Credia loan engine — pure, deterministic financial maths.
 *
 * This module is the single source of truth for amortisation, guarantee and
 * settlement figures. It is imported by server functions so the authoritative
 * numbers are always computed server-side; the client may render the same
 * helpers for previews only.
 *
 * Money is handled in minor units (integer cents / integer XOF) internally to
 * avoid floating-point drift, and returned as fixed-2 decimal strings that map
 * cleanly onto Postgres NUMERIC columns.
 */

export type Frequency = "weekly" | "biweekly" | "monthly";

const ZERO_DECIMAL_CURRENCIES = new Set(["XOF", "XAF", "JPY"]);

export function currencyScale(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export function periodsPerYear(frequency: Frequency): number {
  switch (frequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "monthly":
    default:
      return 12;
  }
}

export function installmentCount(durationMonths: number, frequency: Frequency): number {
  switch (frequency) {
    case "weekly":
      return Math.max(1, Math.round((durationMonths * 52) / 12));
    case "biweekly":
      return Math.max(1, Math.round((durationMonths * 26) / 12));
    case "monthly":
    default:
      return Math.max(1, Math.round(durationMonths));
  }
}

export function addPeriod(from: Date, frequency: Frequency, index: number): Date {
  const date = new Date(from.getTime());
  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7 * index);
  } else if (frequency === "biweekly") {
    date.setUTCDate(date.getUTCDate() + 14 * index);
  } else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + index);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date;
}

function toMinor(amount: number, scale: number): number {
  return Math.round(amount * scale);
}

function toDecimalString(minor: number, scale: number): string {
  return (minor / scale).toFixed(2);
}

export interface ScheduleRow {
  installment_number: number;
  due_date: string;
  total_payment: string;
  principal_portion: string;
  interest_portion: string;
  remaining_principal: string;
}

export interface QuoteInput {
  amount: number;
  durationMonths: number;
  frequency: Frequency;
  annualInterestRate: number;
  guaranteePercentage: number;
  currency: string;
  /** First due date; defaults to one period after today. */
  startDate?: Date;
}

export interface Quote {
  currency: string;
  amount: string;
  durationMonths: number;
  frequency: Frequency;
  annualInterestRate: number;
  periodicInterestRate: number;
  installmentCount: number;
  installmentAmount: string;
  finalInstallmentAmount: string;
  totalInterest: string;
  totalRepayable: string;
  guaranteePercentage: number;
  guaranteeAmount: string;
  firstDueDate: string;
  finalDueDate: string;
  schedule: ScheduleRow[];
}

/**
 * Standard amortisation with equal periodic payments.
 * Rounding residue is absorbed by the final installment so the schedule
 * always sums exactly to principal + total interest.
 */
export function buildQuote(input: QuoteInput): Quote {
  const scale = currencyScale(input.currency);
  const principalMinor = toMinor(input.amount, scale);
  const n = installmentCount(input.durationMonths, input.frequency);
  const periodRate = input.annualInterestRate / periodsPerYear(input.frequency);

  let paymentMinor: number;
  if (periodRate === 0) {
    paymentMinor = Math.ceil(principalMinor / n);
  } else {
    const factor = Math.pow(1 + periodRate, n);
    paymentMinor = Math.ceil((principalMinor * (periodRate * factor)) / (factor - 1));
  }

  const anchor = input.startDate ? new Date(input.startDate.getTime()) : new Date();
  const firstDue = addPeriod(anchor, input.frequency, 1);

  const schedule: ScheduleRow[] = [];
  let remaining = principalMinor;
  let totalInterestMinor = 0;
  let totalPaidMinor = 0;

  for (let i = 1; i <= n; i += 1) {
    const interestMinor = Math.round(remaining * periodRate);
    let principalMinorPortion = paymentMinor - interestMinor;
    let totalMinor = paymentMinor;

    if (i === n || principalMinorPortion >= remaining) {
      principalMinorPortion = remaining;
      totalMinor = principalMinorPortion + interestMinor;
    }

    remaining -= principalMinorPortion;
    totalInterestMinor += interestMinor;
    totalPaidMinor += totalMinor;

    schedule.push({
      installment_number: i,
      due_date: addPeriod(firstDue, input.frequency, i - 1).toISOString().slice(0, 10),
      total_payment: toDecimalString(totalMinor, scale),
      principal_portion: toDecimalString(principalMinorPortion, scale),
      interest_portion: toDecimalString(interestMinor, scale),
      remaining_principal: toDecimalString(remaining, scale),
    });

    if (remaining <= 0 && i < n) break;
  }

  const guaranteeMinor = Math.round(principalMinor * input.guaranteePercentage);
  const last = schedule[schedule.length - 1]!;

  return {
    currency: input.currency,
    amount: toDecimalString(principalMinor, scale),
    durationMonths: input.durationMonths,
    frequency: input.frequency,
    annualInterestRate: input.annualInterestRate,
    periodicInterestRate: periodRate,
    installmentCount: schedule.length,
    installmentAmount: toDecimalString(paymentMinor, scale),
    finalInstallmentAmount: last.total_payment,
    totalInterest: toDecimalString(totalInterestMinor, scale),
    totalRepayable: toDecimalString(totalPaidMinor, scale),
    guaranteePercentage: input.guaranteePercentage,
    guaranteeAmount: toDecimalString(guaranteeMinor, scale),
    firstDueDate: schedule[0]!.due_date,
    finalDueDate: last.due_date,
    schedule,
  };
}

/** Guarantee = loan amount x configured percentage (default 15%). */
export function guaranteeAmount(amount: number, percentage: number, currency: string): string {
  const scale = currencyScale(currency);
  return toDecimalString(Math.round(toMinor(amount, scale) * percentage), scale);
}

export interface CreditScoreFactors {
  kycApproved: boolean;
  monthlyIncome: number | null;
  monthlyDebt: number | null;
  employmentStatus: string | null;
  completedLoans: number;
  latePayments: number;
  defaults: number;
  accountAgeDays: number;
  applicationsLast30Days: number;
  fraudFlags: number;
}

export interface CreditScoreResult {
  score: number;
  band: string;
  breakdown: Record<string, number>;
}

const DEFAULT_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Very high risk", min: 0, max: 299 },
  { label: "High risk", min: 300, max: 499 },
  { label: "Medium risk", min: 500, max: 649 },
  { label: "Good", min: 650, max: 749 },
  { label: "Very good", min: 750, max: 849 },
  { label: "Excellent", min: 850, max: 1000 },
];

export function scoreBand(
  score: number,
  bands: { label: string; min: number; max: number }[] = DEFAULT_BANDS,
): string {
  return bands.find((b) => score >= b.min && score <= b.max)?.label ?? "Unscored";
}

/**
 * Configurable internal scoring model (0-1000). This is one input to an
 * underwriting decision — never the sole basis for approving credit.
 */
export function computeCreditScore(
  factors: CreditScoreFactors,
  bands: { label: string; min: number; max: number }[] = DEFAULT_BANDS,
): CreditScoreResult {
  const breakdown: Record<string, number> = {};

  breakdown.base = 400;
  breakdown.kyc = factors.kycApproved ? 120 : 0;

  const dti =
    factors.monthlyIncome && factors.monthlyIncome > 0
      ? (factors.monthlyDebt ?? 0) / factors.monthlyIncome
      : null;
  breakdown.debt_to_income = dti === null ? 0 : dti <= 0.2 ? 120 : dti <= 0.35 ? 70 : dti <= 0.45 ? 25 : -70;

  breakdown.employment = ["employed", "self_employed", "business_owner"].includes(
    factors.employmentStatus ?? "",
  )
    ? 70
    : factors.employmentStatus
      ? 20
      : 0;

  breakdown.repayment_history = Math.min(factors.completedLoans, 6) * 40;
  breakdown.late_payments = -Math.min(factors.latePayments, 8) * 25;
  breakdown.defaults = -factors.defaults * 180;
  breakdown.account_age = Math.min(Math.floor(factors.accountAgeDays / 30), 12) * 5;
  breakdown.application_velocity = factors.applicationsLast30Days > 3 ? -60 : 0;
  breakdown.fraud_flags = -factors.fraudFlags * 150;

  const raw = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  const score = Math.max(0, Math.min(1000, Math.round(raw)));
  return { score, band: scoreBand(score, bands), breakdown };
}

export interface EarlySettlement {
  outstandingPrincipal: string;
  accruedInterest: string;
  settlementFee: string;
  outstandingLateFees: string;
  totalSettlementAmount: string;
}

export function computeEarlySettlement(params: {
  outstandingPrincipal: number;
  accruedInterest: number;
  outstandingLateFees: number;
  feeRate: number;
  currency: string;
}): EarlySettlement {
  const scale = currencyScale(params.currency);
  const principal = toMinor(params.outstandingPrincipal, scale);
  const accrued = toMinor(params.accruedInterest, scale);
  const lateFees = toMinor(params.outstandingLateFees, scale);
  const fee = Math.round(principal * params.feeRate);
  return {
    outstandingPrincipal: toDecimalString(principal, scale),
    accruedInterest: toDecimalString(accrued, scale),
    settlementFee: toDecimalString(fee, scale),
    outstandingLateFees: toDecimalString(lateFees, scale),
    totalSettlementAmount: toDecimalString(principal + accrued + lateFees + fee, scale),
  };
}

export function riskStatusForOverdue(
  daysOverdue: number,
  stages: { days_overdue: number; risk_status: string }[] = [
    { days_overdue: 1, risk_status: "warning" },
    { days_overdue: 8, risk_status: "late" },
    { days_overdue: 31, risk_status: "serious_delay" },
    { days_overdue: 91, risk_status: "default" },
  ],
): string {
  let status = "normal";
  for (const stage of [...stages].sort((a, b) => a.days_overdue - b.days_overdue)) {
    if (daysOverdue >= stage.days_overdue) status = stage.risk_status;
  }
  return status;
}
