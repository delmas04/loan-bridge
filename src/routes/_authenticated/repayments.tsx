import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/repayments")({
  head: () => ({
    meta: [
      { title: "Repayments — Credia" },
      { name: "description", content: "Track your Credia repayment schedule and payment history." },
      { property: "og:title", content: "Repayments — Credia" },
      { property: "og:description", content: "Track your repayment schedule and payment history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="Repayments" description="Your repayment schedule and payment history will appear here." />
  ),
});
