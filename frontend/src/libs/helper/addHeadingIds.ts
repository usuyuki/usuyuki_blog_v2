/**
 * id属性のない見出しタグにIDを自動付与する（WordPress移行記事向け）
 * テキスト内容からスラッグを生成し、重複する場合は連番を付ける
 */
export const addHeadingIds = (html: string): string => {
	const idCount: Record<string, number> = {};

	return html.replace(
		/<h([1-6])(?![^>]*\bid\s*=)([^>]*?)>([\s\S]*?)<\/h[1-6]>/g,
		(_match, level: string, attrs: string, content: string) => {
			const text = content.replace(/<[^>]+>/g, "").trim();
			let slug = text
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^\w\u3040-\u9fff\u30a0-\u30ff\u4e00-\u9fff-]/g, "")
				.replace(/^-+|-+$/g, "");
			if (!slug) slug = `heading-${level}`;

			idCount[slug] = (idCount[slug] || 0) + 1;
			const uniqueId = idCount[slug] > 1 ? `${slug}-${idCount[slug]}` : slug;

			return `<h${level}${attrs} id="${uniqueId}">${content}</h${level}>`;
		},
	);
};
