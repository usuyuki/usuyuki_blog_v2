import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";
import type { RSSItem, ExternalBlogConfig } from "~/types/RSSType";

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

import { getAllArticlesCached } from "../articleAggregator";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { fetchMultipleRSS } from "~/libs/rssClient";
import { fetchQiitaItems } from "~/libs/qiitaClient";
import { cache } from "~/libs/cache";

const mockGhostPost: ArticleArchiveType = {
  slug: "ghost-post",
  published_at: "2023-12-15T10:00:00.000Z",
  title: "Ghost Post Title",
  isExternal: false,
};

const mockRSSItem: RSSItem = {
  title: "RSS Post Title",
  link: "https://external-blog.com/post",
  published_at: "2023-12-14T10:00:00.000Z",
  source: "Test Blog",
};

describe("Ghost起動遅延時のキャッシュ保護", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
    vi.mocked(fetchQiitaItems).mockResolvedValue([]);
  });

  it("異常系: Ghostが未起動でbrowseがnullを返すと、外部記事だけの結果はキャッシュされないので次回リクエストで再取得される", async () => {
    // 1回目: Ghostが未起動(null) + RSSは取得できる状態
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValueOnce(null);
    vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

    const first = await getAllArticlesCached(true);
    expect(first.some((a) => !a.isExternal)).toBe(false);

    // 2回目: Ghostが起動完了し記事を返す。キャッシュされていなければ再取得される
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
      mockGhostPost,
    ]);

    const second = await getAllArticlesCached(true);
    expect(second.some((a) => a.slug === "ghost-post")).toBe(true);
  });

  it("異常系: Ghostがエラーを投げた場合も外部記事だけの結果はキャッシュされない", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    );
    vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

    await getAllArticlesCached(true);

    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
      mockGhostPost,
    ]);

    const second = await getAllArticlesCached(true);
    expect(second.some((a) => a.slug === "ghost-post")).toBe(true);
  });

  it("正常系: Ghostから記事が取得できた場合はキャッシュされ、2回目はGhostへ再リクエストしない", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
      mockGhostPost,
    ]);
    vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

    await getAllArticlesCached(true);
    const callCountAfterFirst = vi.mocked(ghostApiWithRetry.posts.browse).mock
      .calls.length;

    const second = await getAllArticlesCached(true);
    expect(second.some((a) => a.slug === "ghost-post")).toBe(true);
    expect(vi.mocked(ghostApiWithRetry.posts.browse).mock.calls.length).toBe(
      callCountAfterFirst,
    );
  });

  it("正常系: Ghostに記事が0件でも取得自体が成功していればキャッシュされる", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);
    vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

    await getAllArticlesCached(true);
    const callCountAfterFirst = vi.mocked(ghostApiWithRetry.posts.browse).mock
      .calls.length;

    await getAllArticlesCached(true);
    expect(vi.mocked(ghostApiWithRetry.posts.browse).mock.calls.length).toBe(
      callCountAfterFirst,
    );
  });
});
