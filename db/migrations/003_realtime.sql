CREATE TABLE workspace_operations (
 workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES accounts(id),
 payload_hash text NOT NULL,
 revision integer NOT NULL,
 PRIMARY KEY(workspace_id,operation_id)
);
INSERT INTO schema_migrations(version) VALUES (3);
