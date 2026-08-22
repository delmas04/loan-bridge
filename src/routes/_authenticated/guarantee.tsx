import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/_authenticated/guarantee")({
  head: () => ({
    meta: [
      { title: "Guarantee — Credia" },
      { name: "description", content: "Review the guarantee requirements and deposits linked to your Credia account." },
      { property: "og:title", content: "Guarantee — Credia" },
      { property: "og:description", content: "Review guarantee requirements and deposits on your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PlaceholderPage title="Guarantee" description="Guarantee requirements and deposits will appear here." />
  ),
});
