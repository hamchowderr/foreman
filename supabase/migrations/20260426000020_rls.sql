-- Enable RLS on all Foreman-owned tables not covered by earlier migrations.
-- All data access goes through the agents server (service_role key), which
-- bypasses RLS entirely. Enabling RLS with no policies blocks anon and
-- authenticated roles from direct table access — which is the intended posture.

-- Foreman core tables
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapier_identity ENABLE ROW LEVEL SECURITY;

-- App catalog: read-only reference data; allow authenticated users to query directly
-- (used by the frontend to show available Zapier apps)
ALTER TABLE public.app_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app catalog"
  ON public.app_catalog FOR SELECT
  USING (auth.role() = 'authenticated');

-- Mastra internal tables — service_role only, no direct client access needed
ALTER TABLE public.mastra_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_ai_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_background_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_dataset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_experiment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_client_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_server_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_observational_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_prompt_block_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_prompt_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_scorer_definition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_scorer_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_scorers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_skill_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_skill_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_workflow_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_workspace_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastra_workspaces ENABLE ROW LEVEL SECURITY;
