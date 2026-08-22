import { humanise } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "warning" | "critical" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  positive: "bg-[var(--success-muted)] text-[var(--success)]",
  warning: "bg-[var(--warning-muted)] text-[var(--warning)]",
  critical: "bg-destructive/10 text-destructive",
  info: "bg-accent/10 text-accent",
};

const MAP: Record<string, Tone> = {
  approved: "positive",
  verified: "positive",
  successful: "positive",
  active: "positive",
  completed: "positive",
  released: "positive",
  under_review: "info",
  processing: "info",
  submitted: "info",
  pending: "warning",
  pending_verification: "warning",
  pending_upload: "warning",
  guarantee_pending: "warning",
  overdue: "warning",
  late: "warning",
  rejected: "critical",
  failed: "critical",
  blocked: "critical",
  suspended: "critical",
  defaulted: "critical",
  default: "critical",
  expired: "critical",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = MAP[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {humanise(status)}
    </span>
  );
}
