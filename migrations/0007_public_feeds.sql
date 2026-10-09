-- Public feeds: a tag or folder can be switched on to publish an RSS and JSON
-- feed of its articles. Everything stays private (0) until you turn it on.
ALTER TABLE tags ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE folders ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
