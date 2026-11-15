CREATE TABLE workspace_viewer_links (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 email text,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspace_viewer_links_workspace ON workspace_viewer_links(workspace_id);
INSERT INTO schema_migrations(version) VALUES (9);
