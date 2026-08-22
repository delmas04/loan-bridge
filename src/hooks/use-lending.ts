import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyLending, getMyContracts } from "@/lib/lending.functions";

/** Applications, loans, schedule, guarantees and payments for the signed-in customer. */
export function useLending() {
  const fetchLending = useServerFn(getMyLending);
  return useQuery({
    queryKey: ["my-lending"],
    queryFn: () => fetchLending(),
    staleTime: 10_000,
  });
}

/** Contracts awaiting signature for the signed-in customer. */
export function useContracts() {
  const fetchContracts = useServerFn(getMyContracts);
  return useQuery({
    queryKey: ["my-contracts"],
    queryFn: () => fetchContracts(),
    staleTime: 10_000,
  });
}
