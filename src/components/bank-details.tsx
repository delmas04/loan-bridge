export interface BankAccountView {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string | null;
  iban: string | null;
  bic_swift: string | null;
  bank_address: string | null;
  payment_instructions: string;
  label: string | null;
}

/** Read-only display of a Credia bank account plus the reference to quote. */
export function BankDetails({
  account,
  amount,
  reference,
}: {
  account: BankAccountView;
  amount: string;
  reference: string;
}) {
  const rows: [string, string | null][] = [
    ["Bank", account.bank_name],
    ["Account holder", account.account_holder_name],
    ["IBAN", account.iban],
    ["Account number", account.account_number],
    ["BIC / SWIFT", account.bic_swift],
    ["Bank address", account.bank_address],
    ["Amount", amount],
  ];
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium break-all">{value}</dd>
            </div>
          ))}
      </dl>
      <div className="rounded-md bg-primary/10 p-3">
        <p className="text-xs text-muted-foreground">Payment reference — include it in your transfer description</p>
        <p className="font-mono text-lg font-semibold tracking-wide text-primary">{reference}</p>
      </div>
      {account.payment_instructions ? (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{account.payment_instructions}</p>
      ) : null}
    </div>
  );
}
