-- Feedback subscriptions: users can follow boards and individual threads

CREATE TABLE IF NOT EXISTS public.marketing_feedback_board_subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.marketing_feedback_boards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_board_subscriptions OWNER TO postgres;
ALTER TABLE public.marketing_feedback_board_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_board_subscription
  ON public.marketing_feedback_board_subscriptions(user_id, board_id);
CREATE INDEX idx_marketing_feedback_board_subscriptions_user_id
  ON public.marketing_feedback_board_subscriptions(user_id);
CREATE INDEX idx_marketing_feedback_board_subscriptions_board_id
  ON public.marketing_feedback_board_subscriptions(board_id);

CREATE POLICY "Users can view their own board subscriptions" ON public.marketing_feedback_board_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own board subscriptions" ON public.marketing_feedback_board_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.marketing_feedback_thread_subscriptions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.marketing_feedback_threads(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.marketing_feedback_thread_subscriptions OWNER TO postgres;
ALTER TABLE public.marketing_feedback_thread_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_unique_thread_subscription
  ON public.marketing_feedback_thread_subscriptions(user_id, thread_id);
CREATE INDEX idx_marketing_feedback_thread_subscriptions_user_id
  ON public.marketing_feedback_thread_subscriptions(user_id);
CREATE INDEX idx_marketing_feedback_thread_subscriptions_thread_id
  ON public.marketing_feedback_thread_subscriptions(thread_id);

CREATE POLICY "Users can view their own thread subscriptions" ON public.marketing_feedback_thread_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own thread subscriptions" ON public.marketing_feedback_thread_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
