import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuditEntry {
  actorId: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/** Append-only audit trail. Never throws into the caller's business flow. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before_state: (entry.before ?? null) as never,
    after_state: (entry.after ?? null) as never,
    ip_address: entry.ip ?? null,
    user_agent: entry.userAgent ?? null,
  });
  if (error) console.error("audit_log_failed", entry.action, error.message);
}

export interface NotificationInput {
  userId: string;
  category: string;
  title: string;
  body: string;
  link?: string | null;
  channels?: string[];
}

/**
 * Creates in-app notification rows. Email/SMS channels are recorded as
 * queued rows so an external dispatcher can pick them up; nothing here
 * claims a message was actually delivered.
 */
export async function notify(input: NotificationInput): Promise<void> {
  const channels = input.channels ?? ["in_app"];
  const rows = channels.map((channel) => ({
    user_id: input.userId,
    category: input.category,
    channel,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    sent_at: channel === "in_app" ? new Date().toISOString() : null,
  }));
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) console.error("notification_failed", input.category, error.message);
}

export type StaffRole = "admin" | "underwriter" | "compliance" | "support";

/** Verifies the caller holds a staff role, using their own RLS-scoped client. */
export async function assertStaff(
  supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> },
  userId: string,
): Promise<void> {
  const { data } = await supabase.rpc("is_staff" as never, { _user_id: userId } as never);
  if (data !== true) throw new Error("Forbidden: staff access required");
}

export async function hasRole(
  supabase: { rpc: (fn: never, args: never) => PromiseLike<{ data: unknown }> },
  userId: string,
  role: StaffRole | "customer",
): Promise<boolean> {
  const { data } = await supabase.rpc("has_role" as never, { _user_id: userId, _role: role } as never);
  return data === true;
}
