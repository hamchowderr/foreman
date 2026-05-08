-- Marketing base tables: author profiles and tags
-- Shared by blog, changelog, and feedback features

CREATE TABLE IF NOT EXISTS public.marketing_author_profiles (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  twitter_handle TEXT,
  github_handle TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_author_profiles OWNER TO postgres;
ALTER TABLE public.marketing_author_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view author profiles" ON public.marketing_author_profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage author profiles" ON public.marketing_author_profiles
  FOR ALL USING (public.is_application_admin(auth.uid()));


CREATE TABLE IF NOT EXISTS public.marketing_tags (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_tags OWNER TO postgres;
ALTER TABLE public.marketing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags" ON public.marketing_tags
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage tags" ON public.marketing_tags
  FOR ALL USING (public.is_application_admin(auth.uid()));
