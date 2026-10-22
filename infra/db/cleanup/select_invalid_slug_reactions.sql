-- 一回限りのクリーンアップの事前確認: slug形式(isSlug)に合わないリアクション行を一覧する。
-- POST /api/reactions/[slug] でslugを検証する以前に保存された、NQLペイロードなどの不正なslugが対象。
-- 結果に問題が無ければ delete_invalid_slug_reactions.sql で削除する(条件は両ファイルでそろえること)。
SELECT slug, COUNT(*) AS reactions
FROM emoji_reactions
WHERE slug NOT REGEXP '^[a-zA-Z0-9_-]+$'
   OR slug LIKE '\_%'
   OR CHAR_LENGTH(slug) > 191
   OR LOWER(slug) IN ('assets', 'api', 'admin', 'undefined', 'null')
GROUP BY slug;
