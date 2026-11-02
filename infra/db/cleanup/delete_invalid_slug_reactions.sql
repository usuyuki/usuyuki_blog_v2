-- 一回限りのクリーンアップ: slug形式(isSlug)に合わないリアクション行を削除する。
-- 実行前に select_invalid_slug_reactions.sql で対象を確認すること(条件は両ファイルでそろえること)。
-- 形式は正しいが公開記事に存在しないslugは、一時的に非公開にした記事と区別できないため削除しない
-- (ランキングでは公開記事一覧に無いslugを表示しないので影響は無い)。
DELETE FROM emoji_reactions
WHERE slug NOT REGEXP '^[a-zA-Z0-9_-]+$'
   OR slug LIKE '\_%'
   OR CHAR_LENGTH(slug) > 191
   OR LOWER(slug) IN ('assets', 'api', 'admin', 'undefined', 'null');
