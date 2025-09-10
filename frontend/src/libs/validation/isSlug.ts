/**
 * 記事・タグスラッグのバリデーション（100文字制限）
 * URLや特殊パターンを除外し、正当なスラッグのみを許可する
 */
export function isSlug(slug: string | undefined): boolean {
	// 基本的なバリデーション
	if (
		!slug ||
		typeof slug !== "string" ||
		slug.trim() === "" ||
		slug === "undefined"
	) {
		return false;
	}

	// 長さ制限・URLパターン・特殊文字の除外
	if (
		slug.length > 100 ||
		slug.includes("://") ||
		slug.includes("%2F") ||
		slug.includes("%3A") ||
		slug.startsWith("http") ||
		slug.startsWith("https") ||
		slug.includes("blogapi.usuyuki.net") ||
		slug.includes("&w=") ||
		slug.includes("&h=") ||
		slug.includes("&q=") ||
		slug.includes("&f=") ||
		slug.includes(".") ||
		slug.includes(":") ||
		slug.includes("%") ||
		slug.includes("&") ||
		slug.startsWith("_") ||
		/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
			slug,
		) ||
		["assets", "api", "admin", "undefined", "null"].includes(slug.toLowerCase())
	) {
		return false;
	}

	// 英数字とハイフン、アンダースコアのみ許可
	return /^[a-zA-Z0-9\-_]+$/.test(slug);
}
