CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS accounts (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL);
CREATE TABLE IF NOT EXISTS team_workspaces (id uuid PRIMARY KEY, name text NOT NULL, snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS memberships (workspace_id uuid REFERENCES team_workspaces(id) ON DELETE CASCADE, user_id uuid REFERENCES accounts(id) ON DELETE CASCADE, role text NOT NULL CHECK(role IN ('owner','editor','viewer')), PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS team_invitations (id uuid PRIMARY KEY, workspace_id uuid REFERENCES team_workspaces(id) ON DELETE CASCADE, email text NOT NULL, role text NOT NULL CHECK(role IN ('editor','viewer')), token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, accepted_at timestamptz);
CREATE TABLE IF NOT EXISTS session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp NOT NULL);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire);
INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
