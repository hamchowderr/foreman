-- Billing tables
-- Gateway-abstracted (gateway_name field supports Stripe, Paddle, etc.)
-- All tables scoped to workspace_id for multi-tenant billing

CREATE TABLE IF NOT EXISTS public.billing_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_products OWNER TO postgres;
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.billing_products
  FOR SELECT USING (is_active = TRUE);


CREATE TABLE IF NOT EXISTS public.billing_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.billing_products(id) ON DELETE CASCADE,
  unit_amount BIGINT,
  currency TEXT NOT NULL DEFAULT 'usd',
  recurring_interval public.pricing_plan_interval,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  free_trial_days INTEGER DEFAULT 0,
  tier TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_prices OWNER TO postgres;
ALTER TABLE public.billing_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active prices" ON public.billing_prices
  FOR SELECT USING (is_active = TRUE);


CREATE TABLE IF NOT EXISTS public.billing_volume_tiers (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  price_id TEXT NOT NULL REFERENCES public.billing_prices(id) ON DELETE CASCADE,
  up_to BIGINT,
  unit_amount BIGINT,
  flat_amount BIGINT
);

ALTER TABLE public.billing_volume_tiers OWNER TO postgres;
ALTER TABLE public.billing_volume_tiers ENABLE ROW LEVEL SECURITY;


-- One customer record per workspace per gateway
CREATE TABLE IF NOT EXISTS public.billing_customers (
  gateway_customer_id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_name TEXT NOT NULL DEFAULT 'stripe',
  billing_email TEXT
);

ALTER TABLE public.billing_customers OWNER TO postgres;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_customers_workspace_id ON public.billing_customers(workspace_id);

CREATE POLICY "Workspace admins can view billing customers" ON public.billing_customers
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));


CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT NOT NULL REFERENCES public.billing_customers(gateway_customer_id) ON DELETE CASCADE,
  price_id TEXT REFERENCES public.billing_prices(id),
  status public.subscription_status NOT NULL,
  is_trial BOOLEAN DEFAULT FALSE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_subscriptions OWNER TO postgres;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_subscriptions_workspace_id ON public.billing_subscriptions(workspace_id);

CREATE POLICY "Workspace admins can view subscriptions" ON public.billing_subscriptions
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));


CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT REFERENCES public.billing_customers(gateway_customer_id),
  subscription_id TEXT REFERENCES public.billing_subscriptions(id),
  amount_due BIGINT NOT NULL DEFAULT 0,
  amount_paid BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT,
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_invoices OWNER TO postgres;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_invoices_workspace_id ON public.billing_invoices(workspace_id);

CREATE POLICY "Workspace admins can view invoices" ON public.billing_invoices
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));


CREATE TABLE IF NOT EXISTS public.billing_one_time_payments (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT REFERENCES public.billing_customers(gateway_customer_id),
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_one_time_payments OWNER TO postgres;
ALTER TABLE public.billing_one_time_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_one_time_payments_workspace_id ON public.billing_one_time_payments(workspace_id);

CREATE POLICY "Workspace admins can view one-time payments" ON public.billing_one_time_payments
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));


CREATE TABLE IF NOT EXISTS public.billing_payment_methods (
  id TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway_customer_id TEXT REFERENCES public.billing_customers(gateway_customer_id),
  type TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_payment_methods OWNER TO postgres;
ALTER TABLE public.billing_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_payment_methods_workspace_id ON public.billing_payment_methods(workspace_id);

CREATE POLICY "Workspace admins can view payment methods" ON public.billing_payment_methods
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Workspace admins can manage payment methods" ON public.billing_payment_methods
  FOR ALL USING (public.is_workspace_admin(auth.uid(), workspace_id));


CREATE TABLE IF NOT EXISTS public.billing_usage_logs (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES public.billing_subscriptions(id),
  metric TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.billing_usage_logs OWNER TO postgres;
ALTER TABLE public.billing_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_billing_usage_logs_workspace_id ON public.billing_usage_logs(workspace_id);

CREATE POLICY "Workspace admins can view usage logs" ON public.billing_usage_logs
  FOR SELECT USING (public.is_workspace_admin(auth.uid(), workspace_id));


-- Helper to resolve workspace from a gateway customer ID
CREATE OR REPLACE FUNCTION public.get_customer_workspace_id(customer_id TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ws_id UUID;
BEGIN
  SELECT workspace_id INTO ws_id
  FROM public.billing_customers
  WHERE gateway_customer_id = customer_id;
  RETURN ws_id;
END;
$$;

ALTER FUNCTION public.get_customer_workspace_id(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_customer_workspace_id(TEXT) FROM anon, authenticated;
GRANT ALL ON FUNCTION public.get_customer_workspace_id(TEXT) TO service_role;
