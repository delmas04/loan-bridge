import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Credia — International Lending, Configured by Country" },
      {
        name: "description",
        content:
          "Credia is a cross-border lending platform with country-specific loan products, KYC verification, guarantee management and transparent repayment schedules.",
      },
      { property: "og:title", content: "Credia — International Lending, Configured by Country" },
      {
        property: "og:description",
        content:
          "Apply for a loan in your own currency, verify your identity once, and track every repayment in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const MARKETS = [
  { country: "France", currency: "EUR", rail: "SEPA transfer" },
  { country: "Benin", currency: "XOF", rail: "Mobile money" },
  { country: "Côte d'Ivoire", currency: "XOF", rail: "Mobile money" },
  { country: "United States", currency: "USD", rail: "ACH / card" },
  { country: "United Kingdom", currency: "GBP", rail: "Faster Payments" },
  { country: "Canada", currency: "CAD", rail: "EFT" },
  { country: "Australia", currency: "AUD", rail: "PayID" },
];

const PILLARS = [
  {
    title: "Rules per country",
    body: "Interest rates, durations, guarantee percentages and required documents are configured independently for every country and currency.",
  },
  {
    title: "Verification once",
    body: "Upload identity, address and income documents to a private vault. Compliance reviews them and you never re-submit for later loans.",
  },
  {
    title: "Deterministic schedules",
    body: "Every quote is computed server-side in minor currency units — the amortisation table you accept is the table you repay.",
  },
  {
    title: "Guarantee held, not spent",
    body: "Guarantee deposits are tracked as a separate ledger with claim and refund history, so you always know what is owed back to you.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="font-serif text-xl font-semibold tracking-tight">Credia</span>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "register" }}>
                Create account
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Cross-border consumer lending
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight font-semibold tracking-tight text-foreground sm:text-5xl">
          Lending infrastructure that respects the rules of every country it operates in.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground">
          Credia gives customers in Europe, West Africa and the Anglosphere a single account for identity
          verification, loan applications, guarantee deposits and repayment tracking — priced in their own currency.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "register" }}>
              Open an account
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">I already have an account</Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-px px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="p-4">
              <h2 className="font-serif text-lg font-semibold text-foreground">{pillar.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Live markets</h2>
        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Country</th>
                <th className="px-4 py-2 text-left font-medium">Currency</th>
                <th className="px-4 py-2 text-left font-medium">Primary payment rail</th>
              </tr>
            </thead>
            <tbody>
              {MARKETS.map((market) => (
                <tr key={market.country} className="border-t border-border">
                  <td className="px-4 py-2.5">{market.country}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{market.currency}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{market.rail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-xs text-muted-foreground">
          Credia lends responsibly. Interest rates, fees and guarantee requirements vary by country and are shown in
          full before any agreement is signed.
        </div>
      </footer>
    </div>
  );
}
