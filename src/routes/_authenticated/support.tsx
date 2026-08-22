import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — Credia" },
      { name: "description", content: "Get help with your Credia account, verification or repayments." },
      { property: "og:title", content: "Support — Credia" },
      { property: "og:description", content: "Get help with your account, verification or repayments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="Support" description="Contact options and help resources will appear here." />
  ),
});
