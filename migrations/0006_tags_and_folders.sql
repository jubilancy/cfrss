-- Tags and folders for individual articles.
--
-- Tags are stackable labels (cooking, rust). Folders are hand-curated lists
-- (TBR, Recipes). Both are addressed by a URL slug, compared without regard
-- to case: /tag/cooking and /TBR.

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 50),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE article_tags (
    article_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (article_id, tag_id),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_article_tags_tag ON article_tags(tag_id, created_at DESC);

CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL CHECK(length(name) >= 1 AND length(name) <= 50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE folder_articles (
    folder_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (folder_id, article_id),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX idx_folder_articles_folder ON folder_articles(folder_id, added_at DESC);
