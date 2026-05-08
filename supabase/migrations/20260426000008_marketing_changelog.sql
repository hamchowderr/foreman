-- Marketing: changelog with TipTap JSON content, versioning, media, and author relationships

CREATE TABLE IF NOT EXISTS public.marketing_changelog (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  json_content JSONB,
  cover_image TEXT,
  media_type VARCHAR(20) CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'gif')),
  media_url TEXT,
  media_alt TEXT,
  video_poster TEXT,
  version VARCHAR(20),
  tags TEXT[] DEFAULT '{}',
  technical_details TEXT,
  status public.marketing_changelog_status DEFAULT 'draft' NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_changelog OWNER TO postgres;
ALTER TABLE public.marketing_changelog ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_changelog_status ON public.marketing_changelog(status);
CREATE INDEX idx_marketing_changelog_tags ON public.marketing_changelog USING GIN (tags);
CREATE INDEX idx_marketing_changelog_version ON public.marketing_changelog(version);

CREATE POLICY "Anyone can view published changelog entries" ON public.marketing_changelog
  FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage all changelog entries" ON public.marketing_changelog
  FOR ALL USING (public.is_application_admin(auth.uid()));


-- Changelog ↔ author relationship
CREATE TABLE IF NOT EXISTS public.marketing_changelog_author_relationship (
  changelog_id UUID NOT NULL REFERENCES public.marketing_changelog(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.marketing_author_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (changelog_id, author_id)
);

ALTER TABLE public.marketing_changelog_author_relationship OWNER TO postgres;
ALTER TABLE public.marketing_changelog_author_relationship ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view changelog authors" ON public.marketing_changelog_author_relationship
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage changelog authors" ON public.marketing_changelog_author_relationship
  FOR ALL USING (public.is_application_admin(auth.uid()));
