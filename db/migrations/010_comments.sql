CREATE TABLE comment_threads (
 id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
 board_id text NOT NULL,
 card_id text,
 resolved boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comment_threads_board ON comment_threads(workspace_id,board_id,updated_at DESC,id);
CREATE TABLE comment_messages (
 id uuid PRIMARY KEY,
 thread_id uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
 author_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
 version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(thread_id,version)
);
CREATE INDEX comment_messages_thread ON comment_messages(thread_id,version);
CREATE TABLE comment_mentions (
 message_id uuid REFERENCES comment_messages(id) ON DELETE CASCADE,
 user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(message_id,user_id)
);
CREATE INDEX comment_mentions_user ON comment_mentions(user_id,message_id);
CREATE TABLE comment_reads (
 thread_id uuid REFERENCES comment_threads(id) ON DELETE CASCADE,
 user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version > 0),
 PRIMARY KEY(thread_id,user_id)
);
INSERT INTO schema_migrations(version) VALUES (10);
