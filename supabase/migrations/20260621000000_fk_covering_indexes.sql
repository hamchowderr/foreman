-- Covering indexes for foreign-key columns.
--
-- Postgres does not auto-index FK columns; without these, JOINs and ON DELETE
-- CASCADE / SET NULL do full table scans (schema-foreign-key-indexes, HIGH).
-- One index per unindexed FK column, surfaced by the supabase-postgres
-- best-practices audit (foreman-qhbp). Idempotent (IF NOT EXISTS).

-- Foreman runtime
CREATE INDEX IF NOT EXISTS action_proposal_conversation_id_idx ON public.action_proposal(conversation_id);
CREATE INDEX IF NOT EXISTS action_run_proposal_id_idx ON public.action_run(proposal_id);
CREATE INDEX IF NOT EXISTS api_key_user_id_idx ON public.api_key(user_id);
CREATE INDEX IF NOT EXISTS channel_identity_user_id_idx ON public.channel_identity(user_id);
CREATE INDEX IF NOT EXISTS stored_agent_current_version_id_idx ON public.stored_agent(current_version_id);

-- Billing (multi-tenant monetization foundation)
CREATE INDEX IF NOT EXISTS billing_invoices_gateway_customer_id_idx ON public.billing_invoices(gateway_customer_id);
CREATE INDEX IF NOT EXISTS billing_invoices_subscription_id_idx ON public.billing_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS billing_one_time_payments_gateway_customer_id_idx ON public.billing_one_time_payments(gateway_customer_id);
CREATE INDEX IF NOT EXISTS billing_payment_methods_gateway_customer_id_idx ON public.billing_payment_methods(gateway_customer_id);
CREATE INDEX IF NOT EXISTS billing_prices_product_id_idx ON public.billing_prices(product_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_gateway_customer_id_idx ON public.billing_subscriptions(gateway_customer_id);
CREATE INDEX IF NOT EXISTS billing_subscriptions_price_id_idx ON public.billing_subscriptions(price_id);
CREATE INDEX IF NOT EXISTS billing_usage_logs_subscription_id_idx ON public.billing_usage_logs(subscription_id);
CREATE INDEX IF NOT EXISTS billing_volume_tiers_price_id_idx ON public.billing_volume_tiers(price_id);

-- Workspace multi-tenant
CREATE INDEX IF NOT EXISTS user_settings_default_workspace_idx ON public.user_settings(default_workspace);
CREATE INDEX IF NOT EXISTS workspace_credits_logs_workspace_credits_id_idx ON public.workspace_credits_logs(workspace_credits_id);
CREATE INDEX IF NOT EXISTS workspace_credits_logs_workspace_id_idx ON public.workspace_credits_logs(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invitations_invitee_user_id_idx ON public.workspace_invitations(invitee_user_id);
CREATE INDEX IF NOT EXISTS workspace_invitations_inviter_user_id_idx ON public.workspace_invitations(inviter_user_id);
