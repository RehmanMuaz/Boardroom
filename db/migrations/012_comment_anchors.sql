ALTER TABLE comment_threads ADD COLUMN annotation_id text;
ALTER TABLE comment_threads ADD COLUMN connector_id text;
ALTER TABLE comment_threads ADD COLUMN group_id text;
ALTER TABLE comment_threads ADD CONSTRAINT comment_thread_single_target CHECK(num_nonnulls(card_id,annotation_id,connector_id,group_id)<=1);
INSERT INTO schema_migrations(version) VALUES (12);
