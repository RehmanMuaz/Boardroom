CREATE TABLE flow_imports (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 name text NOT NULL,
 snapshot jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 workspace_id uuid REFERENCES team_workspaces(id),
 UNIQUE(user_id,request_id)
);
CREATE INDEX flow_imports_pending_expiry_idx ON flow_imports(user_id,expires_at) WHERE workspace_id IS NULL;
INSERT INTO schema_migrations(version) VALUES (8) ON CONFLICT DO NOTHING;
