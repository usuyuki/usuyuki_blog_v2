/**
 * 記事・タグスラッグのバリデーション（191文字制限）
 * 英数字・ハイフン・アンダースコアのみを許可
 * Ghost CMS が日本語タイトルを UTF-8 バイトのハイフン区切り hex に変換するため、
 * 日本語スラッグは100文字を大幅に超える場合がある（例: 141文字）
 */
export function isSlug(slug: string | undefined): boolean {
  return (
    !!slug &&
    typeof slug === "string" &&
    slug.trim() !== "" &&
    slug.length <= 191 &&
    /^[a-zA-Z0-9\-_]+$/.test(slug) &&
    !slug.startsWith("_") &&
    !["assets", "api", "admin", "undefined", "null"].includes(
      slug.toLowerCase(),
    )
  );
}
