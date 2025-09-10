/**
 * 記事・タグスラッグのバリデーション（100文字制限）
 * 英数字・ハイフン・アンダースコアのみを許可
 */
export function isSlug(slug: string | undefined): boolean {
	return (
		!!slug &&
		typeof slug === "string" &&
		slug.trim() !== "" &&
		slug.length <= 100 &&
		/^[a-zA-Z0-9\-_]+$/.test(slug) &&
		!slug.startsWith("_") &&
		!["assets", "api", "admin", "undefined", "null"].includes(
			slug.toLowerCase(),
		)
	);
}
