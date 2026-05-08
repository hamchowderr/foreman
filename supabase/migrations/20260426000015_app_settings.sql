-- Application-wide settings stored in a single row
-- The boolean PK + CHECK constraint enforces exactly one row

CREATE TABLE IF NOT EXISTS public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT single_row CHECK (id)
);

ALTER TABLE public.app_settings OWNER TO postgres;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.is_application_admin(auth.uid()));

CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_application_admin(auth.uid()))
  WITH CHECK (public.is_application_admin(auth.uid()));
