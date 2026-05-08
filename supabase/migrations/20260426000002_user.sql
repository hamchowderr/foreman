-- User profile tables
-- Richer user data linked to auth.users, separate from the legacy public.user table

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.user_profiles OWNER TO postgres;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- Per-user settings (holds default_workspace pointer; FK added after workspaces table exists)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  default_workspace UUID
);

ALTER TABLE public.user_settings OWNER TO postgres;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- Email mirror for fast querying without touching auth.users
CREATE TABLE IF NOT EXISTS public.user_application_settings (
  id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email TEXT
);

ALTER TABLE public.user_application_settings OWNER TO postgres;
ALTER TABLE public.user_application_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own application settings" ON public.user_application_settings
  FOR SELECT USING (auth.uid() = id);


-- App-level role assignments (admin vs normal user)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user'
);

ALTER TABLE public.user_roles OWNER TO postgres;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

CREATE POLICY "Users can read their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Locked down — only accessible to service_role and supabase_auth_admin
REVOKE ALL ON TABLE public.user_roles FROM authenticated, anon;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;


-- In-app notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  is_seen BOOLEAN DEFAULT FALSE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.user_notifications OWNER TO postgres;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_notifications_user_id ON public.user_notifications(user_id);

CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;


-- Account deletion tokens
CREATE TABLE IF NOT EXISTS public.account_delete_tokens (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.account_delete_tokens OWNER TO postgres;
ALTER TABLE public.account_delete_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_account_delete_tokens_user_id ON public.account_delete_tokens(user_id);

CREATE POLICY "Users can manage their own delete tokens" ON public.account_delete_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
