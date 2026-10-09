-- Planned PostgreSQL persistence; not connected to the local canvas yet.
BEGIN;
CREATE TABLE users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, display_name text NOT NULL);
CREATE TABLE workspaces (id uuid PRIMARY KEY, name text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE workspace_members (workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE, user_id uuid REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL CHECK(role IN ('owner','editor','viewer')), PRIMARY KEY(workspace_id,user_id));
CREATE TABLE boards (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, parent_id uuid, title text NOT NULL, revision bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,workspace_id), FOREIGN KEY(parent_id,workspace_id) REFERENCES boards(id,workspace_id));
CREATE TABLE cards (id uuid PRIMARY KEY, board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('note','checklist','link','board','image','file','column')), x double precision NOT NULL CHECK(x >= 0), y double precision NOT NULL CHECK(y >= 0), width double precision NOT NULL DEFAULT 240 CHECK(width > 0), content jsonb NOT NULL DEFAULT '{}', revision bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX cards_board_idx ON cards(board_id);
CREATE TABLE comments (id uuid PRIMARY KEY, card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE, author_id uuid NOT NULL REFERENCES users(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE invitations (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, email text NOT NULL, role text NOT NULL CHECK(role IN ('editor','viewer')), token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz);
CREATE TABLE assets (id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, uploaded_by uuid NOT NULL REFERENCES users(id), storage_key text NOT NULL UNIQUE, mime_type text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes >= 0));
COMMIT;
