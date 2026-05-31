import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("~/libs/env", () => ({
  getGhostApiUrl: () => "http://test.ghost.com",
  getGhostContentKey: () => "test-key",
}));

vi.mock("~/libs/astroLogger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cacheLog: vi.fn(),
    requestError: vi.fn(),
  },
}));

vi.mock("~/libs/errorHandler", () => ({
  default: {
    handleError: vi.fn(),
    handleNetworkError: vi.fn(),
  },
}));

vi.mock("@tryghost/content-api", () => ({
  default: function MockGhostContentAPI() {
    return {
      posts: { browse: vi.fn(), read: vi.fn() },
      tags: { browse: vi.fn(), read: vi.fn() },
    };
  },
}));

import { ghostClient, ghostApiWithRetry, clearCache } from "../ghostClient";
import astroLogger from "~/libs/astroLogger";

describe("ghostClient", () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("slow API warning", () => {
    it("should warn when posts.browse exceeds threshold", async () => {
      // PostsOrPages is BrowseResults<PostOrPage> which extends Array with meta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(ghostClient.posts, "browse").mockResolvedValue([] as any);
      vi.spyOn(Date, "now")
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(2000)
        .mockReturnValue(5000);

      await ghostApiWithRetry.posts.browse({ limit: 10 });

      expect(vi.mocked(astroLogger.warn)).toHaveBeenCalledWith(
        expect.stringContaining("Slow Ghost API"),
        expect.objectContaining({ duration: 2000, method: "posts.browse" }),
      );
    });

    it("should not warn when posts.browse is within threshold", async () => {
      // PostsOrPages is BrowseResults<PostOrPage> which extends Array with meta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(ghostClient.posts, "browse").mockResolvedValue([] as any);
      vi.spyOn(Date, "now")
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(500)
        .mockReturnValue(5000);

      await ghostApiWithRetry.posts.browse({ limit: 10 });

      expect(vi.mocked(astroLogger.warn)).not.toHaveBeenCalledWith(
        expect.stringContaining("Slow Ghost API"),
        expect.any(Object),
      );
    });
  });
});
