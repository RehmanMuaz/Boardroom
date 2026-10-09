ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE TABLE IF NOT EXISTS account_tokens (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
 token_hash text UNIQUE NOT NULL,
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_tokens_expiry ON account_tokens(expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
 key text PRIMARY KEY,
 count integer NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry ON auth_rate_limits(expires_at);
INSERT INTO schema_migrations(version) VALUES (5) ON CONFLICT DO NOTHING;
