import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExternalBlogConfig } from "~/types/RSSType";

vi.mock("~/libs/cache", () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    delete: vi.fn(),
    cleanup: vi.fn(),
  },
  ONE_HOUR_MS: 60 * 60 * 1000,
}));

global.fetch = vi.fn();

import { fetchQiitaItems } from "../qiitaClient";
import { cache } from "../cache";

const mockConfig: ExternalBlogConfig & { qiitaUserId: string } = {
  name: "Qiita",
  qiitaUserId: "myuser",
  color: "#55c500",
};

const mockApiResponse = [
  {
    title: "First Article",
    url: "https://qiita.com/myuser/items/abc1",
    created_at: "2024-01-15T10:00:00+09:00",
  },
  {
    title: "Second Article",
    url: "https://qiita.com/myuser/items/abc2",
    created_at: "2024-01-10T10:00:00+09:00",
  },
];

describe("qiitaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.get).mockReturnValue(null);
  });

  describe("fetchQiitaItems", () => {
    it("should fetch and convert Qiita items correctly", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const items = await fetchQiitaItems(mockConfig);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v2/users/myuser/items?page=1&per_page=100",
        ),
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        title: "First Article",
        link: "https://qiita.com/myuser/items/abc1",
        published_at: "2024-01-15T10:00:00+09:00",
        source: "Qiita",
      });
    });

    it("should paginate until items are exhausted", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        title: `Article ${i}`,
        url: `https://qiita.com/myuser/items/page1-${i}`,
        created_at: "2024-01-01T00:00:00+09:00",
      }));
      const page2 = [
        {
          title: "Last Article",
          url: "https://qiita.com/myuser/items/last",
          created_at: "2023-12-01T00:00:00+09:00",
        },
      ];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2,
        } as Response);

      const items = await fetchQiitaItems(mockConfig);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(items).toHaveLength(101);
    });

    it("should stop pagination when page returns fewer items than perPage", async () => {
      // mockApiResponse has 2 items (< 100 = perPage), so no second request needed
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const items = await fetchQiitaItems(mockConfig);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(items).toHaveLength(2);
    });

    it("should return cached items on cache hit", async () => {
      const cachedItems = [
        {
          title: "Cached Article",
          link: "https://qiita.com/cached",
          published_at: "2024-01-01T00:00:00+09:00",
          source: "Qiita",
        },
      ];
      vi.mocked(cache.get).mockReturnValue(cachedItems);

      const items = await fetchQiitaItems(mockConfig);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(items).toEqual(cachedItems);
    });

    it("should save results to cache after successful fetch", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      await fetchQiitaItems(mockConfig);

      expect(cache.set).toHaveBeenCalledWith(
        "qiita_api:myuser",
        expect.any(Array),
        expect.any(Number),
      );
    });

    it("should return empty array on API error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response);

      const items = await fetchQiitaItems(mockConfig);

      expect(items).toEqual([]);
    });

    it("should return empty array on network error", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const items = await fetchQiitaItems(mockConfig);

      expect(items).toEqual([]);
    });
  });
});
