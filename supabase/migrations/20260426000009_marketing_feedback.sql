-- Marketing: feedback threads and comments
-- Boards, reactions, and subscriptions are added in subsequent migrations

CREATE TABLE IF NOT EXISTS public.marketing_feedback_threads (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  priority public.marketing_feedback_thread_priority DEFAULT 'medium' NOT NULL,
  type public.marketing_feedback_thread_type DEFAULT 'feature_request' NOT NULL,
  status public.marketing_feedback_thread_status DEFAULT 'open' NOT NULL,
  added_to_roadmap BOOLEAN DEFAULT FALSE NOT NULL,
  open_for_public_discussion BOOLEAN DEFAULT TRUE NOT NULL,
  is_publicly_visible BOOLEAN DEFAULT TRUE NOT NULL,
  moderator_hold_category public.marketing_feedback_moderator_hold_category DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_threads OWNER TO postgres;
ALTER TABLE public.marketing_feedback_threads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_feedback_threads_user_id ON public.marketing_feedback_threads(user_id);
CREATE INDEX idx_marketing_feedback_threads_status ON public.marketing_feedback_threads(status);

CREATE POLICY "Anyone can view public feedback threads" ON public.marketing_feedback_threads
  FOR SELECT USING (is_publicly_visible = TRUE);

CREATE POLICY "Users can submit feedback" ON public.marketing_feedback_threads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON public.marketing_feedback_threads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all feedback threads" ON public.marketing_feedback_threads
  FOR ALL USING (public.is_application_admin(auth.uid()));


CREATE TABLE IF NOT EXISTS public.marketing_feedback_comments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  thread_id UUID NOT NULL REFERENCES public.marketing_feedback_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_publicly_visible BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_comments OWNER TO postgres;
ALTER TABLE public.marketing_feedback_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_marketing_feedback_comments_thread_id ON public.marketing_feedback_comments(thread_id);
CREATE INDEX idx_marketing_feedback_comments_user_id ON public.marketing_feedback_comments(user_id);

CREATE POLICY "Anyone can view public feedback comments" ON public.marketing_feedback_comments
  FOR SELECT USING (is_publicly_visible = TRUE);

CREATE POLICY "Users can add comments" ON public.marketing_feedback_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.marketing_feedback_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments" ON public.marketing_feedback_comments
  FOR ALL USING (public.is_application_admin(auth.uid()));
