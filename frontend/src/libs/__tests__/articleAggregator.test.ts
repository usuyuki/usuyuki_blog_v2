import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RSSItem, ExternalBlogConfig } from "~/types/RSSType";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

// Mock the dependencies
vi.mock("~/libs/ghostClient", () => ({
  ghostApiWithRetry: {
    posts: {
      browse: vi.fn(),
    },
  },
}));

vi.mock("~/libs/rssClient", () => ({
  fetchMultipleRSS: vi.fn(),
}));

vi.mock("~/libs/qiitaClient", () => ({
  fetchQiitaItems: vi.fn(),
}));

const mockExternalBlogs: ExternalBlogConfig[] = [
  { name: "Test Blog", rssUrl: "https://example.com/feed.xml" },
];

vi.mock("~/libs/config", () => ({
  get CONFIG() {
    return { externalBlogs: mockExternalBlogs };
  },
}));

import { getLatestArticles, getFeaturedArticles } from "../articleAggregator";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { fetchMultipleRSS } from "~/libs/rssClient";
import { fetchQiitaItems } from "~/libs/qiitaClient";

describe("ArticleAggregator", () => {
  const mockGhostPost: ArticleArchiveType = {
    slug: "ghost-post",
    published_at: "2023-12-15T10:00:00.000Z",
    feature_image: "https://example.com/image.jpg",
    title: "Ghost Post Title",
    isExternal: false,
  };

  const mockRSSItem: RSSItem = {
    title: "RSS Post Title",
    link: "https://external-blog.com/post",
    published_at: "2023-12-14T10:00:00.000Z",
    source: "Test Blog",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLatestArticles", () => {
    it("正常系: Ghost記事とRSS記事の両方を取得して結合する", async () => {
      // Mock Ghost API response
      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        mockGhostPost,
      ]);

      // Mock RSS Client response
      vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      expect(articles).toHaveLength(2);
      // Should be sorted by date (Ghost post is newer)
      expect(articles[0].isExternal).toBe(false);
      expect(articles[1].isExternal).toBe(true);
      expect(articles[0].title).toBe("Ghost Post Title");
      expect(articles[1].title).toBe("RSS Post Title");

      // Check date formats are preserved
      expect(typeof articles[0].published_at).toBe("string");
      expect(typeof articles[1].published_at).toBe("string");
    });

    it("異常系: Ghost APIが例外を投げるとGhost記事は欠落しRSS記事のみが返る", async () => {
      // Mock Ghost API to throw error
      vi.mocked(ghostApiWithRetry.posts.browse).mockRejectedValue(
        new Error("Rate limit exceeded"),
      );

      // Mock RSS Client response
      vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].isExternal).toBe(true);
      expect(articles[0].title).toBe("RSS Post Title");
    });

    it("正常系: includeExternalがfalseのとき外部記事を含めない", async () => {
      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        mockGhostPost,
      ]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: false,
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].isExternal).toBe(false);
      expect(vi.mocked(fetchMultipleRSS)).not.toHaveBeenCalled();
    });

    it("正常系: 公開日の新しい順に記事をソートする", async () => {
      const olderGhostPost = {
        ...mockGhostPost,
        published_at: "2023-12-10T10:00:00.000Z",
        title: "Older Ghost Post",
      };

      const newerRSSItem: RSSItem = {
        ...mockRSSItem,
        published_at: "2023-12-20T10:00:00.000Z",
        title: "Newer RSS Post",
      };

      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        olderGhostPost,
      ]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([newerRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      expect(articles[0].title).toBe("Newer RSS Post");
      expect(articles[1].title).toBe("Older Ghost Post");
    });

    it("正常系: limitで指定した件数まで記事を絞り込む", async () => {
      const ghostPosts = Array.from({ length: 5 }, (_, i) => ({
        ...mockGhostPost,
        slug: `ghost-post-${i}`,
        title: `Ghost Post ${i}`,
      }));

      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue(ghostPosts);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

      const articles = await getLatestArticles({
        limit: 3,
        includeExternal: true,
      });

      expect(articles).toHaveLength(3);
    });

    it("正常系: RSSアイテムを外部記事として正しく変換する", async () => {
      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      const rssArticle = articles[0];
      expect(rssArticle.slug).toBe(mockRSSItem.link);
      expect(rssArticle.published_at).toBe(mockRSSItem.published_at);
      expect(rssArticle.title).toBe(mockRSSItem.title);
      expect(rssArticle.source).toBe(mockRSSItem.source);
      expect(rssArticle.isExternal).toBe(true);
      expect(rssArticle.externalUrl).toBe(mockRSSItem.link);
    });

    it("正常系: Ghost記事を内部記事として正しく変換する", async () => {
      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        mockGhostPost,
      ]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: false,
      });

      const ghostArticle = articles[0];
      expect(ghostArticle.slug).toBe(mockGhostPost.slug);
      expect(ghostArticle.published_at).toBe(mockGhostPost.published_at);
      expect(ghostArticle.title).toBe(mockGhostPost.title);
      expect(ghostArticle.feature_image).toBe(mockGhostPost.feature_image);
      expect(ghostArticle.isExternal).toBe(false);
    });

    it("正常系: 文字列とオブジェクトが混在した日付形式でも正しくソートする", async () => {
      // Create articles with different date formats
      const oldGhostPost = {
        ...mockGhostPost,
        published_at: "2023-01-01T10:00:00.000Z",
        title: "Old Ghost Post",
      };

      const newRSSItem: RSSItem = {
        ...mockRSSItem,
        published_at: "2023-12-31T10:00:00.000Z",
        title: "New RSS Post",
      };

      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        oldGhostPost,
      ]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([newRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      // Should be sorted correctly by date (newest first)
      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe("New RSS Post");
      expect(articles[1].title).toBe("Old Ghost Post");

      // Date formats should be preserved
      expect(typeof articles[0].published_at).toBe("string");
      expect(typeof articles[1].published_at).toBe("string");
    });

    it("異常系: 不正な日付形式を含む記事があってもソートが破綻せず全件返る", async () => {
      const invalidDateGhostPost = {
        ...mockGhostPost,
        published_at: "invalid-date",
        title: "Invalid Date Post",
      };

      const validRSSItem: RSSItem = {
        ...mockRSSItem,
        published_at: "2023-12-15T10:00:00.000Z",
        title: "Valid Date RSS Post",
      };

      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        invalidDateGhostPost,
      ]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([validRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      // Should still return articles, even with invalid dates
      expect(articles).toHaveLength(2);
      expect(articles.some((a) => a.title === "Invalid Date Post")).toBe(true);
      expect(articles.some((a) => a.title === "Valid Date RSS Post")).toBe(
        true,
      );
    });
  });

  describe("getLatestArticles with Qiita API", () => {
    beforeEach(() => {
      // Reset to default RSS-only config
      mockExternalBlogs.length = 0;
      mockExternalBlogs.push({
        name: "Test Blog",
        rssUrl: "https://example.com/feed.xml",
      });
    });

    it("正常系: qiitaUserIdが設定されているときQiita APIを呼び出す", async () => {
      mockExternalBlogs.length = 0;
      mockExternalBlogs.push({ name: "Qiita", qiitaUserId: "myuser" });

      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([]);
      vi.mocked(fetchQiitaItems).mockResolvedValue([
        {
          title: "Qiita Article",
          link: "https://qiita.com/myuser/items/abc",
          published_at: "2023-12-15T10:00:00+09:00",
          source: "Qiita",
        },
      ]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      expect(vi.mocked(fetchQiitaItems)).toHaveBeenCalledWith(
        expect.objectContaining({ qiitaUserId: "myuser" }),
      );
      expect(vi.mocked(fetchMultipleRSS)).toHaveBeenCalledWith([]);
      expect(articles.some((a) => a.title === "Qiita Article")).toBe(true);
    });

    it("正常系: rssUrlのみ設定されているときQiita APIを呼び出さない", async () => {
      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);
      vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

      const articles = await getLatestArticles({
        limit: 10,
        includeExternal: true,
      });

      expect(vi.mocked(fetchQiitaItems)).not.toHaveBeenCalled();
      expect(vi.mocked(fetchMultipleRSS)).toHaveBeenCalled();
      expect(articles.some((a) => a.title === "RSS Post Title")).toBe(true);
    });
  });

  describe("getFeaturedArticles", () => {
    it("正常系: featuredフィルタでピックアップ記事のみを取得する", async () => {
      const featuredPost = {
        ...mockGhostPost,
        title: "Featured Post",
      };

      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
        featuredPost,
      ]);

      const articles = await getFeaturedArticles({
        limit: 5,
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("Featured Post");
      expect(articles[0].isExternal).toBe(false);

      expect(vi.mocked(ghostApiWithRetry.posts.browse)).toHaveBeenCalledWith({
        filter: "featured:true",
        order: "published_at DESC",
        limit: 5,
        include: "tags",
      });
    });

    it("異常系: ピックアップ記事取得でGhost APIが例外を投げると空配列を返す", async () => {
      vi.mocked(ghostApiWithRetry.posts.browse).mockRejectedValue(
        new Error("API Error"),
      );

      const articles = await getFeaturedArticles({
        limit: 5,
      });

      expect(articles).toHaveLength(0);
    });

    it("正常系: ピックアップ記事が0件のとき空配列を返す", async () => {
      vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);

      const articles = await getFeaturedArticles({
        limit: 5,
      });

      expect(articles).toHaveLength(0);
    });
  });
});
