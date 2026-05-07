-- Marketing: blog posts with TipTap JSON content, tags, and author relationships

CREATE TABLE IF NOT EXISTS public.marketing_blog_posts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  json_content JSONB,
  status public.marketing_blog_post_status DEFAULT 'draft' NOT NULL,
  cover_image TEXT,
  media_type VARCHAR CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'gif')),
  seo_data JSONB DEFAULT '{}'::jsonb,
  is_featured BOOLEAN DEFAULT FALSE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_blog_posts OWNER TO postgres;
ALTER TABLE public.marketing_blog_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_blog_posts_status ON public.marketing_blog_posts(status);
CREATE INDEX idx_marketing_blog_posts_slug ON public.marketing_blog_posts(slug);

CREATE POLICY "Anyone can view published blog posts" ON public.marketing_blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage all blog posts" ON public.marketing_blog_posts
  FOR ALL USING (public.is_application_admin(auth.uid()));


-- Blog post ↔ tag relationship
CREATE TABLE IF NOT EXISTS public.marketing_blog_post_tags_relationship (
  blog_post_id UUID NOT NULL REFERENCES public.marketing_blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.marketing_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_post_id, tag_id)
);

ALTER TABLE public.marketing_blog_post_tags_relationship OWNER TO postgres;
ALTER TABLE public.marketing_blog_post_tags_relationship ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog post tags" ON public.marketing_blog_post_tags_relationship
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage blog post tags" ON public.marketing_blog_post_tags_relationship
  FOR ALL USING (public.is_application_admin(auth.uid()));


-- Blog post ↔ author relationship
CREATE TABLE IF NOT EXISTS public.marketing_blog_author_posts (
  blog_post_id UUID NOT NULL REFERENCES public.marketing_blog_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.marketing_author_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (blog_post_id, author_id)
);

ALTER TABLE public.marketing_blog_author_posts OWNER TO postgres;
ALTER TABLE public.marketing_blog_author_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog post authors" ON public.marketing_blog_author_posts
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage blog post authors" ON public.marketing_blog_author_posts
  FOR ALL USING (public.is_application_admin(auth.uid()));
