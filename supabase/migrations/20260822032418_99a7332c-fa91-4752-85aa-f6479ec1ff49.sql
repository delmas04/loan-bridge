
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','underwriter','compliance','support','customer');
CREATE TYPE public.account_status AS ENUM ('pending_verification','verified','rejected','suspended','blocked');
CREATE TYPE public.repayment_frequency AS ENUM ('weekly','biweekly','monthly');

-- ============ UTILITY ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ CURRENCIES ============
CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places SMALLINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currencies TO anon, authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- ============ COUNTRIES ============
CREATE TABLE public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_currency TEXT NOT NULL REFERENCES public.currencies(code),
  phone_prefix TEXT NOT NULL,
  guarantee_percentage NUMERIC(6,4) NOT NULL DEFAULT 0.1500,
  kyc_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  compliance_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  lending_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','underwriter','compliance','support')
  );
$$;

CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- reference data policies
CREATE POLICY "currencies_public_read" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "currencies_admin_write" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "countries_public_read" ON public.countries FOR SELECT USING (true);
CREATE POLICY "countries_admin_write" ON public.countries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ LOAN PRODUCTS ============
CREATE TABLE public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  min_amount NUMERIC(18,2) NOT NULL,
  max_amount NUMERIC(18,2) NOT NULL,
  min_duration_months SMALLINT NOT NULL,
  max_duration_months SMALLINT NOT NULL,
  annual_interest_rate NUMERIC(6,4) NOT NULL,
  origination_fee_rate NUMERIC(6,4) NOT NULL DEFAULT 0,
  guarantee_percentage NUMERIC(6,4) NOT NULL DEFAULT 0.1500,
  allowed_frequencies public.repayment_frequency[] NOT NULL DEFAULT ARRAY['monthly']::public.repayment_frequency[],
  required_documents TEXT[] NOT NULL DEFAULT ARRAY['government_id','selfie','proof_of_address','proof_of_income','bank_account'],
  eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  early_repayment_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  late_payment_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loan_products TO anon, authenticated;
GRANT ALL ON public.loan_products TO service_role;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.loan_products FOR SELECT USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "products_admin_write" ON public.loan_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PAYMENT PROVIDERS ============
CREATE TABLE public.payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  supported_country_codes TEXT[] NOT NULL DEFAULT '{}',
  supported_methods TEXT[] NOT NULL DEFAULT '{}',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT ALL ON public.payment_providers TO service_role;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers_read" ON public.payment_providers FOR SELECT TO authenticated USING (is_active = true OR public.is_staff(auth.uid()));
CREATE POLICY "providers_admin_write" ON public.payment_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ RISK RULES ============
CREATE TABLE public.risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.risk_rules TO authenticated;
GRANT ALL ON public.risk_rules TO service_role;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_rules_staff_read" ON public.risk_rules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "risk_rules_admin_write" ON public.risk_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ CREDIT LIMIT RULES ============
CREATE TABLE public.credit_limit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  step_order SMALLINT NOT NULL,
  successful_loans_required SMALLINT NOT NULL DEFAULT 0,
  min_credit_score SMALLINT NOT NULL DEFAULT 0,
  max_amount NUMERIC(18,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_limit_rules TO authenticated;
GRANT ALL ON public.credit_limit_rules TO service_role;
ALTER TABLE public.credit_limit_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "limit_rules_read" ON public.credit_limit_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "limit_rules_admin_write" ON public.credit_limit_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  country_id UUID REFERENCES public.countries(id),
  country_code TEXT,
  date_of_birth DATE,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  employment_status TEXT,
  employer_name TEXT,
  monthly_income NUMERIC(18,2),
  income_currency TEXT REFERENCES public.currencies(code),
  monthly_debt_payments NUMERIC(18,2),
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  mobile_money_number TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  kyc_completed BOOLEAN NOT NULL DEFAULT false,
  account_status public.account_status NOT NULL DEFAULT 'pending_verification',
  status_reason TEXT,
  credit_score SMALLINT,
  credit_limit NUMERIC(18,2),
  credit_limit_currency TEXT REFERENCES public.currencies(code),
  successful_loans_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_staff_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- customers may never change privileged fields on their own row
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  NEW.account_status := OLD.account_status;
  NEW.status_reason := OLD.status_reason;
  NEW.credit_score := OLD.credit_score;
  NEW.credit_limit := OLD.credit_limit;
  NEW.credit_limit_currency := OLD.credit_limit_currency;
  NEW.successful_loans_count := OLD.successful_loans_count;
  NEW.email_verified := OLD.email_verified;
  NEW.phone_verified := OLD.phone_verified;
  NEW.kyc_completed := OLD.kyc_completed;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, phone, country_code, date_of_birth, email_verified)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    NEW.raw_user_meta_data->>'country_code',
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER t_currencies_updated BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_countries_updated BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_products_updated BEFORE UPDATE ON public.loan_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_providers_updated BEFORE UPDATE ON public.payment_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_risk_updated BEFORE UPDATE ON public.risk_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_limit_updated BEFORE UPDATE ON public.credit_limit_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
