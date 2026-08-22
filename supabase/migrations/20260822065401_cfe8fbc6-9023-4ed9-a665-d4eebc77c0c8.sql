-- 1. New enum values
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'additional_information_required';
ALTER TYPE public.guarantee_status ADD VALUE IF NOT EXISTS 'payment_pending';
ALTER TYPE public.guarantee_status ADD VALUE IF NOT EXISTS 'payment_processing';
ALTER TYPE public.guarantee_status ADD VALUE IF NOT EXISTS 'eligible_for_release';
ALTER TYPE public.guarantee_status ADD VALUE IF NOT EXISTS 'release_pending';
ALTER TYPE public.guarantee_status ADD VALUE IF NOT EXISTS 'released';

-- 2. Loan product configuration
ALTER TABLE public.loan_products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS processing_time TEXT NOT NULL DEFAULT 'Within 2 business days',
  ADD COLUMN IF NOT EXISTS eligibility_requirements TEXT[] NOT NULL DEFAULT '{}'::text[];

-- 3. Application underwriting inputs + accepted quote link
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS quote_id UUID,
  ADD COLUMN IF NOT EXISTS declared_monthly_expenses NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS employer_name TEXT,
  ADD COLUMN IF NOT EXISTS other_obligations TEXT;

-- 4. Immutable quote snapshots
CREATE TABLE IF NOT EXISTS public.loan_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.loan_products(id),
  country_id UUID NOT NULL REFERENCES public.countries(id),
  application_id UUID REFERENCES public.loan_applications(id),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  amount NUMERIC(18,2) NOT NULL,
  duration_months SMALLINT NOT NULL,
  repayment_frequency public.repayment_frequency NOT NULL,
  annual_interest_rate NUMERIC(9,6) NOT NULL,
  periodic_interest_rate NUMERIC(12,9) NOT NULL,
  installment_count SMALLINT NOT NULL,
  installment_amount NUMERIC(18,2) NOT NULL,
  final_installment_amount NUMERIC(18,2) NOT NULL,
  total_interest NUMERIC(18,2) NOT NULL,
  total_repayable NUMERIC(18,2) NOT NULL,
  guarantee_percentage NUMERIC(6,4) NOT NULL,
  guarantee_amount NUMERIC(18,2) NOT NULL,
  first_due_date DATE NOT NULL,
  final_due_date DATE NOT NULL,
  processing_time TEXT,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_version TEXT NOT NULL DEFAULT 'q1',
  terms_version TEXT NOT NULL DEFAULT 'v1',
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_ip TEXT,
  accepted_user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.loan_quotes TO authenticated;
GRANT ALL ON public.loan_quotes TO service_role;
ALTER TABLE public.loan_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_read" ON public.loan_quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "quotes_insert_own" ON public.loan_quotes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND accepted_at IS NULL);

CREATE TRIGGER t_quotes_updated BEFORE UPDATE ON public.loan_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_quote_fk FOREIGN KEY (quote_id) REFERENCES public.loan_quotes(id);

-- 5. Guarantee transaction ledger completeness
ALTER TABLE public.guarantee_transactions
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.loan_applications(id),
  ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES public.loans(id),
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.payment_providers(id),
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS status public.payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

CREATE TRIGGER t_gtx_updated BEFORE UPDATE ON public.guarantee_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_user ON public.loan_quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_application ON public.loan_quotes(application_id);
CREATE INDEX IF NOT EXISTS idx_products_country_active ON public.loan_products(country_id, is_active);
CREATE INDEX IF NOT EXISTS idx_apps_user_status ON public.loan_applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_apps_status ON public.loan_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON public.loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inst_loan_due ON public.loan_installments(loan_id, due_date);
CREATE INDEX IF NOT EXISTS idx_inst_user_status ON public.loan_installments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_guar_user_status ON public.guarantees(user_id, status);
CREATE INDEX IF NOT EXISTS idx_guar_application ON public.guarantees(application_id);
CREATE INDEX IF NOT EXISTS idx_gtx_guarantee ON public.guarantee_transactions(guarantee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON public.payments(loan_id);