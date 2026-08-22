import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({
    meta: [
      { title: "My loans — Credia" },
      { name: "description", content: "View your Credia loan applications and active loans in one place." },
      { property: "og:title", content: "My loans — Credia" },
      { property: "og:description", content: "View your Credia loan applications and active loans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="My loans" description="Your loan applications and active loans will appear here." />
  ),
});
