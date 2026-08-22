import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/my-documents")({
  head: () => ({
    meta: [
      { title: "Documents — Credia" },
      { name: "description", content: "Access statements, contracts and other documents from your Credia account." },
      { property: "og:title", content: "Documents — Credia" },
      { property: "og:description", content: "Access statements, contracts and other account documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="Documents" description="Statements, contracts and account documents will appear here." />
  ),
});
