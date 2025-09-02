export type DateType = {
	year: number;
	month: number;
	day: number;
};

export type ArticleArchiveType = {
	slug: string;
	published_at: string | DateType;
	feature_image?: string;
	title: string;
	excerpt?: string; // Ghost記事の要約
	source?: string; // RSS元のブログ名（Ghostの場合はundefined）
	isExternal?: boolean; // 外部記事フラグ
	externalUrl?: string; // 外部記事の場合のURL
	sourceColor?: string; // 外部記事のサムネイル色
};
