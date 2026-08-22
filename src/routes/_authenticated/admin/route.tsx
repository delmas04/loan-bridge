import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyAdminAccess } from "@/lib/admin-auth.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const access = await getMyAdminAccess();
      if (!access.isAdmin) throw redirect({ to: "/admin/login" });
    } catch (error) {
      if (error && typeof error === "object" && "isRedirect" in error) throw error;
      throw redirect({ to: "/admin/login" });
    }
  },
  component: () => <Outlet />,
});
