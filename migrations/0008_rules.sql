-- Rules: "when a new article matches, tag it, file it, or mark it read".
--
-- A rule matches on a feed and/or a keyword and can do any mix of three
-- things: add a tag, add the article to a folder, mark it read. Rules run
-- when feeds refresh, and can be applied to existing articles on request.
-- Deleting the feed or folder a rule points at deletes that rule.

CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    feed_id TEXT,
    match_field TEXT NOT NULL DEFAULT 'title' CHECK(match_field IN ('title', 'any')),
    contains TEXT,
    add_tag TEXT,
    folder_id TEXT,
    mark_read INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (feed_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
