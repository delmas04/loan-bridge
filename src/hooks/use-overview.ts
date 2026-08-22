import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyOverview } from "@/lib/customer.functions";

/** Shared customer session data: profile, KYC, documents, notifications, roles. */
export function useOverview() {
  const fetchOverview = useServerFn(getMyOverview);
  return useQuery({
    queryKey: ["my-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 15_000,
  });
}

const STAFF = ["admin", "underwriter", "compliance", "support"];

export function isStaffRoles(roles: string[] | undefined): boolean {
  return (roles ?? []).some((role) => STAFF.includes(role));
}
