-- catalog_vectors is created by Mastra PgVector at agent startup, not by migrations.
-- Enable RLS only if the table already exists (it won't on a fresh db reset).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'catalog_vectors'
  ) THEN
    ALTER TABLE public.catalog_vectors ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
