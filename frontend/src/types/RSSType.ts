export type RSSItem = {
  title: string;
  link: string;
  published_at: string;
  description?: string;
  author?: string;
  source?: string; // RSS元のブログ名
};

export type RSSFeed = {
  title: string;
  link: string;
  description?: string;
  items: RSSItem[];
};

// rssUrl と qiitaUserId のどちらか一方（または両方）が必須
export type ExternalBlogConfig = {
  name: string;
  color?: string; // Tailwind色クラス（例: "bg-green-500"）または16進数カラー（例: "#ffffff"）
} & (
  | { rssUrl: string; qiitaUserId?: string }
  | { qiitaUserId: string; rssUrl?: string }
);
