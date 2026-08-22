
CREATE TYPE public.document_status AS ENUM ('pending','under_review','approved','rejected','expired');
CREATE TYPE public.kyc_status AS ENUM ('not_started','pending','under_review','approved','rejected','expired');
CREATE TYPE public.application_status AS ENUM ('draft','submitted','kyc_review','document_review','risk_analysis','guarantee_required','guarantee_pending','underwriting','approved','contract_pending','ready_for_disbursement','disbursed','active','completed','rejected','cancelled','defaulted','on_hold');
CREATE TYPE public.loan_status AS ENUM ('pending_disbursement','active','completed','defaulted','cancelled','written_off');
CREATE TYPE public.installment_status AS ENUM ('upcoming','due','paid','partially_paid','late','missed','waived','cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending','processing','successful','failed','refunded','cancelled');
CREATE TYPE public.guarantee_status AS ENUM ('required','pending_payment','received','locked','releasable','refunded','partially_claimed','claimed','cancelled');
CREATE TYPE public.risk_status AS ENUM ('normal','warning','late','serious_delay','default');
CREATE TYPE public.contract_status AS ENUM ('draft','pending_acceptance','accepted','declined','void');
CREATE TYPE public.ticket_status AS ENUM ('open','pending_customer','pending_agent','resolved','closed');

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  status public.document_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read" ON public.documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "documents_staff_update" ON public.documents FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.kyc_status NOT NULL DEFAULT 'not_started',
  level TEXT NOT NULL DEFAULT 'basic',
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  rejection_reason TEXT,
  screening_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_read" ON public.kyc_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "kyc_insert_own" ON public.kyc_verifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_staff_update" ON public.kyc_verifications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('APP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.countries(id),
  product_id UUID NOT NULL REFERENCES public.loan_products(id),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  requested_amount NUMERIC(18,2) NOT NULL,
  duration_months SMALLINT NOT NULL,
  repayment_frequency public.repayment_frequency NOT NULL DEFAULT 'monthly',
  purpose TEXT,
  declared_monthly_income NUMERIC(18,2),
  declared_monthly_debt NUMERIC(18,2),
  employment_status TEXT,
  annual_interest_rate NUMERIC(6,4),
  guarantee_percentage NUMERIC(6,4),
  guarantee_amount NUMERIC(18,2),
  installment_amount NUMERIC(18,2),
  total_repayable NUMERIC(18,2),
  total_interest NUMERIC(18,2),
  installment_count SMALLINT,
  approved_amount NUMERIC(18,2),
  approved_duration_months SMALLINT,
  status public.application_status NOT NULL DEFAULT 'draft',
  status_reason TEXT,
  terms_accepted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  review_started_at TIMESTAMPTZ,
  decision_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loan_applications TO authenticated;
GRANT ALL ON public.loan_applications TO service_role;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps_read" ON public.loan_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "apps_insert_own" ON public.loan_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'draft');
CREATE POLICY "apps_update_own_draft" ON public.loan_applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft') WITH CHECK (user_id = auth.uid());
CREATE POLICY "apps_staff_update" ON public.loan_applications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.documents
  ADD CONSTRAINT documents_application_fk FOREIGN KEY (application_id)
  REFERENCES public.loan_applications(id) ON DELETE SET NULL;

CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('LN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  application_id UUID NOT NULL UNIQUE REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.loan_products(id),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  principal_amount NUMERIC(18,2) NOT NULL,
  annual_interest_rate NUMERIC(6,4) NOT NULL,
  duration_months SMALLINT NOT NULL,
  repayment_frequency public.repayment_frequency NOT NULL,
  installment_amount NUMERIC(18,2) NOT NULL,
  installment_count SMALLINT NOT NULL,
  total_interest NUMERIC(18,2) NOT NULL,
  total_repayable NUMERIC(18,2) NOT NULL,
  outstanding_principal NUMERIC(18,2) NOT NULL,
  outstanding_balance NUMERIC(18,2) NOT NULL,
  amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  first_due_date DATE,
  final_due_date DATE,
  disbursed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status public.loan_status NOT NULL DEFAULT 'pending_disbursement',
  risk_status public.risk_status NOT NULL DEFAULT 'normal',
  days_overdue INTEGER NOT NULL DEFAULT 0,
  missed_installments SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_read" ON public.loans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installment_number SMALLINT NOT NULL,
  due_date DATE NOT NULL,
  total_payment NUMERIC(18,2) NOT NULL,
  principal_portion NUMERIC(18,2) NOT NULL,
  interest_portion NUMERIC(18,2) NOT NULL,
  remaining_principal NUMERIC(18,2) NOT NULL,
  amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  late_fee NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  status public.installment_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, installment_number)
);
GRANT SELECT ON public.loan_installments TO authenticated;
GRANT ALL ON public.loan_installments TO service_role;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installments_read" ON public.loan_installments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference TEXT NOT NULL UNIQUE DEFAULT ('TXN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  installment_id UUID REFERENCES public.loan_installments(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.payment_providers(id),
  purpose TEXT NOT NULL DEFAULT 'repayment',
  direction TEXT NOT NULL DEFAULT 'inbound',
  payment_method TEXT,
  amount NUMERIC(18,2) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider_reference TEXT,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_read" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  percentage NUMERIC(6,4) NOT NULL,
  required_amount NUMERIC(18,2) NOT NULL,
  received_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  refunded_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  claimed_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status public.guarantee_status NOT NULL DEFAULT 'required',
  received_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guarantees TO authenticated;
GRANT ALL ON public.guarantees TO service_role;
ALTER TABLE public.guarantees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guarantees_read" ON public.guarantees FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.guarantee_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guarantee_id UUID NOT NULL REFERENCES public.guarantees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  previous_status public.guarantee_status,
  new_status public.guarantee_status,
  performed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guarantee_transactions TO authenticated;
GRANT ALL ON public.guarantee_transactions TO service_role;
ALTER TABLE public.guarantee_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gtx_read" ON public.guarantee_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL,
  band TEXT NOT NULL,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_scores TO authenticated;
GRANT ALL ON public.credit_scores TO service_role;
ALTER TABLE public.credit_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_read" ON public.credit_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.credit_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  decided_amount NUMERIC(18,2),
  decided_duration_months SMALLINT,
  credit_score SMALLINT,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  decided_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_decisions TO authenticated;
GRANT ALL ON public.credit_decisions TO service_role;
ALTER TABLE public.credit_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decisions_read" ON public.credit_decisions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT 'v1',
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.contract_status NOT NULL DEFAULT 'pending_acceptance',
  accepted_at TIMESTAMPTZ,
  accepted_ip TEXT,
  accepted_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_read" ON public.contracts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "notif_mark_read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('TK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "tickets_insert_own" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets_update_own" ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets_staff_update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read" ON public.support_messages FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (is_internal_note = false AND EXISTS (
      SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
    ))
  );
CREATE POLICY "messages_insert" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      public.is_staff(auth.uid())
      OR (is_internal_note = false AND EXISTS (
        SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
      ))
    )
  );

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance'));

CREATE INDEX idx_documents_user ON public.documents(user_id);
CREATE INDEX idx_apps_user ON public.loan_applications(user_id);
CREATE INDEX idx_apps_status ON public.loan_applications(status);
CREATE INDEX idx_loans_user ON public.loans(user_id);
CREATE INDEX idx_inst_loan ON public.loan_installments(loan_id);
CREATE INDEX idx_inst_due ON public.loan_installments(due_date);
CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read_at);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

CREATE TRIGGER t_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_kyc_updated BEFORE UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_apps_updated BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_loans_updated BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_inst_updated BEFORE UPDATE ON public.loan_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_guarantees_updated BEFORE UPDATE ON public.guarantees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "kyc_docs_own_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())
  ));
CREATE POLICY "kyc_docs_own_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc_docs_own_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
