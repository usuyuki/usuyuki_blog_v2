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
};
