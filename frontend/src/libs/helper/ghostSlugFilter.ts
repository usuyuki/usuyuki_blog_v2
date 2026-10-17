import { isSlug } from "~/libs/validation/isSlug";

// slug一覧からGhost Content APIのNQLフィルタ(slug:[a,b,...])を組み立てる。
// DBなど外部由来のslugに ' ] , + : などのNQLメタ文字が含まれるとクエリ構造を書き換えられるため、
// isSlug(英数字・ハイフン・アンダースコアのみ)を満たすものだけを使う。
// 有効なslugが1件も無い場合はnullを返す(呼び出し側でGhostへの問い合わせを省略する)。
export function buildGhostSlugFilter(slugs: string[]): string | null {
  const safeSlugs = slugs.filter((slug) => isSlug(slug));
  if (safeSlugs.length === 0) return null;
  return `slug:[${safeSlugs.join(",")}]`;
}
