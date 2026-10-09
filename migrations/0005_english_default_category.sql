-- Rename the built-in default category from its Chinese label to English.
-- Only touches the untouched default row, so a category you renamed yourself
-- is left alone.
UPDATE categories SET name = 'Uncategorized' WHERE id = 'default' AND name = '未分类';
