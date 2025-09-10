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

	// 除外パターン - 特殊文字（最も可能性が高いため最初にチェック）
	const specialChars = [".", ":", "%", "&", "="];
	if (specialChars.some((char) => slug.includes(char))) {
		return false;
	}

	// 長さ制限
	if (slug.length > 100) {
		return false;
	}

	// 除外パターン - 特定ドメイン（特殊文字チェックで捕捉されないもの）
	const domainPatterns = ["blogapi.usuyuki.net"];
	if (domainPatterns.some((pattern) => slug.includes(pattern))) {
		return false;
	}

	// 除外パターン - startsWith チェック
	const prefixPatterns = ["http", "https", "_"];
	if (prefixPatterns.some((prefix) => slug.startsWith(prefix))) {
		return false;
	}

	// 除外パターン - 予約語
	const reservedWords = ["assets", "api", "admin", "undefined", "null"];
	if (reservedWords.includes(slug.toLowerCase())) {
		return false;
	}

	// 除外パターン - UUID形式
	if (
		/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(slug)
	) {
		return false;
	}

	// 全てのチェックを通過
	return true;
}
