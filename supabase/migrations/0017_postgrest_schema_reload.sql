-- 0017_postgrest_schema_reload.sql
-- Fixes: "Could not find the table 'public.ifom_library' in the schema cache"
--
-- The ifom_library table is defined in 0013_ifom_library.sql, but PostgREST
-- keeps its own schema cache and must be told to reload whenever new tables,
-- columns, RLS policies, or functions are added. Without this notification
-- the REST API keeps returning PGRST205 / "schema cache" errors even though
-- the table is fully present in Postgres.
--
-- Applying this migration guarantees PostgREST refreshes the schema on the
-- next deploy / restart.

NOTIFY pgrst, 'reload schema';

-- As a safety net, also grant the API role the minimum required access on
-- the IFOM library table. The original 0013 migration enables RLS but does
-- not grant the default `anon` / `authenticated` roles used by the API.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ifom_library'
  ) THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ifom_library TO authenticated;
  END IF;
END $$;
