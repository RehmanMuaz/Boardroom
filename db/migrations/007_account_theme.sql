ALTER TABLE accounts ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system'
 CHECK (theme IN ('light','dark','system'));
INSERT INTO schema_migrations(version) VALUES (7) ON CONFLICT DO NOTHING;
