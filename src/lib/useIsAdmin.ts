import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";

/** Server-verified admin flag (role checked via has_role). */
export function useIsAdmin() {
  const check = useServerFn(amIAdmin);
  return useQuery({ queryKey: ["am-i-admin"], queryFn: () => check(), staleTime: 5 * 60_000, retry: false });
}
