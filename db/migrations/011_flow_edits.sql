CREATE TABLE flow_edits (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 operation jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 applied_revision integer,
 applied_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, workspace_id, request_id)
);
CREATE INDEX flow_edits_pending_idx ON flow_edits(user_id, expires_at) WHERE applied_revision IS NULL;
INSERT INTO schema_migrations(version) VALUES (11) ON CONFLICT DO NOTHING;
