CREATE TABLE team_assets (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL REFERENCES accounts(id),
 name text NOT NULL,
 mime text NOT NULL,
 size_bytes integer NOT NULL CHECK(size_bytes>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_assets_workspace_idx ON team_assets(workspace_id);
INSERT INTO schema_migrations(version) VALUES (4);
