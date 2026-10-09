ALTER TABLE accounts ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
INSERT INTO schema_migrations(version) VALUES (6) ON CONFLICT DO NOTHING;
