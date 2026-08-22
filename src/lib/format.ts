const ZERO_DECIMAL = new Set(["XOF", "XAF", "JPY"]);

export function formatMoney(
  amount: number | string | null | undefined,
  currency = "EUR",
  locale = "en-GB",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value.toFixed(digits)} ${currency}`;
  }
}

export function formatPercent(rate: number | string | null | undefined, digits = 2): string {
  if (rate === null || rate === undefined || rate === "") return "—";
  const value = typeof rate === "string" ? Number(rate) : rate;
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DOCUMENT_LABELS: Record<string, string> = {
  government_id: "Government-issued ID",
  selfie: "Selfie / identity verification",
  proof_of_address: "Proof of address",
  proof_of_income: "Proof of income",
  bank_account: "Bank account details",
  mobile_money_account: "Mobile money account details",
  employment_proof: "Employment or business proof",
  other: "Other supporting document",
};

export function documentLabel(type: string): string {
  return DOCUMENT_LABELS[type] ?? humanise(type);
}
