import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";

const { mockEmojiReaction, MockPrismaClientKnownRequestError, mockPrismaOn } =
  vi.hoisted(() => {
    class MockPrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    }
    return {
      mockEmojiReaction: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      MockPrismaClientKnownRequestError,
      mockPrismaOn: vi.fn(),
    };
  });

vi.mock("~/generated/prisma/client", () => ({
  PrismaClient: vi.fn(function () {
    return { emojiReaction: mockEmojiReaction, $on: mockPrismaOn };
  }),
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

vi.mock("~/libs/astroLogger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cacheLog: vi.fn(),
  },
}));

vi.mock("@prisma/adapter-mariadb", () => ({
  PrismaMariaDb: vi.fn(function () {
    return {};
  }),
}));

import astroLogger from "~/libs/astroLogger";

// キャッシュをモックしてテスト間の状態汚染を防ぐ
vi.mock("../cache", () => ({
  cache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("reactionClient", () => {
  describe("validateEmoji", () => {
    let validateEmoji: (emoji: string) => boolean;
    let savedNsfwList: string | undefined;

    beforeEach(async () => {
      savedNsfwList = process.env.REACTIONS_NSFW_BLOCKLIST;
      delete process.env.REACTIONS_NSFW_BLOCKLIST;
      vi.resetModules();
      const mod = await import("../reactionClient");
      validateEmoji = mod.validateEmoji;
    });

    afterEach(() => {
      if (savedNsfwList !== undefined) {
        process.env.REACTIONS_NSFW_BLOCKLIST = savedNsfwList;
      } else {
        delete process.env.REACTIONS_NSFW_BLOCKLIST;
      }
    });

    it("returns true for common emoji", () => {
      expect(validateEmoji("👍")).toBe(true);
      expect(validateEmoji("❤️")).toBe(true);
      expect(validateEmoji("🎉")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(validateEmoji("")).toBe(false);
    });

    it("returns true for NSFW emoji when no blocklist is configured", () => {
      expect(validateEmoji("🍆")).toBe(true);
      expect(validateEmoji("🍑")).toBe(true);
      expect(validateEmoji("🖕")).toBe(true);
    });

    it("returns false when codepoint count exceeds 8", () => {
      const longEmoji = "👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦";
      expect(validateEmoji(longEmoji)).toBe(false);
    });

    it("returns false for plain text", () => {
      expect(validateEmoji("abc")).toBe(false);
      expect(validateEmoji("hello")).toBe(false);
    });

    it("accepts compound emoji within codepoint limit", () => {
      expect(validateEmoji("👨‍💻")).toBe(true);
    });

    it("accepts keycap number emoji", () => {
      expect(validateEmoji("1️⃣")).toBe(true);
      expect(validateEmoji("2️⃣")).toBe(true);
      expect(validateEmoji("0️⃣")).toBe(true);
      expect(validateEmoji("#️⃣")).toBe(true);
    });

    it("returns false for plain digits", () => {
      expect(validateEmoji("1")).toBe(false);
      expect(validateEmoji("9")).toBe(false);
    });

    describe("with REACTIONS_NSFW_BLOCKLIST env var", () => {
      afterEach(() => {
        delete process.env.REACTIONS_NSFW_BLOCKLIST;
      });

      it("blocks emoji specified in env var", async () => {
        process.env.REACTIONS_NSFW_BLOCKLIST = "🚀,🔥";
        vi.resetModules();
        const { validateEmoji: fn } = await import("../reactionClient");
        expect(fn("🚀")).toBe(false);
        expect(fn("🔥")).toBe(false);
      });

      it("allows emoji not in the env var blocklist", async () => {
        process.env.REACTIONS_NSFW_BLOCKLIST = "🚀";
        vi.resetModules();
        const { validateEmoji: fn } = await import("../reactionClient");
        expect(fn("🍆")).toBe(true);
      });
    });
  });
});

describe("getReactions", () => {
  let getReactions: (slug: string, clientId: string) => Promise<unknown>;
  let savedNsfwList: string | undefined;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("../reactionClient");
    getReactions = mod.getReactions;
  });

  beforeEach(() => {
    savedNsfwList = process.env.REACTIONS_NSFW_BLOCKLIST;
    delete process.env.REACTIONS_NSFW_BLOCKLIST;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedNsfwList !== undefined) {
      process.env.REACTIONS_NSFW_BLOCKLIST = savedNsfwList;
    } else {
      delete process.env.REACTIONS_NSFW_BLOCKLIST;
    }
  });

  it("returns reaction with count and reacted: true when client has reacted", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: { emoji: 3 }, _min: { createdAt: new Date() } },
    ]);
    mockEmojiReaction.findMany.mockResolvedValue([{ emoji: "👍" }]);

    const result = await getReactions("my-slug", "client-xyz");
    expect(result).toEqual([{ emoji: "👍", count: 3, reacted: true }]);
  });

  it("returns reacted: false when client has not reacted", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      { emoji: "❤️", _count: { emoji: 2 }, _min: { createdAt: new Date() } },
    ]);
    mockEmojiReaction.findMany.mockResolvedValue([]);

    const result = await getReactions("my-slug", "other-client");
    expect(result).toEqual([{ emoji: "❤️", count: 2, reacted: false }]);
  });

  it("filters out NSFW emoji from results", async () => {
    process.env.REACTIONS_NSFW_BLOCKLIST = "🍆";
    mockEmojiReaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: { emoji: 1 }, _min: { createdAt: new Date() } },
      { emoji: "🍆", _count: { emoji: 5 }, _min: { createdAt: new Date() } },
    ]);
    mockEmojiReaction.findMany.mockResolvedValue([]);

    const result = await getReactions("my-slug", "client-xyz");
    expect(result).toHaveLength(1);
    expect((result as Array<{ emoji: string }>)[0].emoji).toBe("👍");
    delete process.env.REACTIONS_NSFW_BLOCKLIST;
  });
});

describe("getAllSlugReactions", () => {
  let getAllSlugReactions: () => Promise<unknown>;
  let savedNsfwList: string | undefined;

  beforeAll(async () => {
    vi.resetModules();
    const mod = await import("../reactionClient");
    getAllSlugReactions = mod.getAllSlugReactions;
  });

  beforeEach(() => {
    savedNsfwList = process.env.REACTIONS_NSFW_BLOCKLIST;
    delete process.env.REACTIONS_NSFW_BLOCKLIST;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedNsfwList !== undefined) {
      process.env.REACTIONS_NSFW_BLOCKLIST = savedNsfwList;
    } else {
      delete process.env.REACTIONS_NSFW_BLOCKLIST;
    }
  });

  it("returns slugs sorted by total reaction count descending", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      {
        slug: "post-a",
        emoji: "👍",
        _count: { emoji: 2 },
        _min: { createdAt: new Date() },
      },
      {
        slug: "post-b",
        emoji: "❤️",
        _count: { emoji: 10 },
        _min: { createdAt: new Date() },
      },
      {
        slug: "post-a",
        emoji: "🎉",
        _count: { emoji: 1 },
        _min: { createdAt: new Date() },
      },
    ]);

    const result = await getAllSlugReactions();
    const typed = result as Array<{
      slug: string;
      total: number;
      reactions: { emoji: string; count: number }[];
    }>;
    expect(typed[0].slug).toBe("post-b");
    expect(typed[0].total).toBe(10);
    expect(typed[1].slug).toBe("post-a");
    expect(typed[1].total).toBe(3);
  });

  it("aggregates multiple emoji per slug correctly", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      {
        slug: "post-a",
        emoji: "👍",
        _count: { emoji: 5 },
        _min: { createdAt: new Date() },
      },
      {
        slug: "post-a",
        emoji: "🎉",
        _count: { emoji: 3 },
        _min: { createdAt: new Date() },
      },
    ]);

    const result = await getAllSlugReactions();
    const typed = result as Array<{
      slug: string;
      total: number;
      reactions: { emoji: string; count: number }[];
    }>;
    expect(typed).toHaveLength(1);
    expect(typed[0].total).toBe(8);
    expect(typed[0].reactions).toEqual(
      expect.arrayContaining([
        { emoji: "👍", count: 5 },
        { emoji: "🎉", count: 3 },
      ]),
    );
  });

  it("filters out blocklisted emoji", async () => {
    process.env.REACTIONS_NSFW_BLOCKLIST = "🍆";
    mockEmojiReaction.groupBy.mockResolvedValue([
      {
        slug: "post-a",
        emoji: "👍",
        _count: { emoji: 3 },
        _min: { createdAt: new Date() },
      },
      {
        slug: "post-a",
        emoji: "🍆",
        _count: { emoji: 99 },
        _min: { createdAt: new Date() },
      },
    ]);

    const result = await getAllSlugReactions();
    const typed = result as Array<{
      slug: string;
      total: number;
      reactions: { emoji: string; count: number }[];
    }>;
    expect(typed[0].total).toBe(3);
    expect(typed[0].reactions.every((r) => r.emoji !== "🍆")).toBe(true);
  });

  it("returns empty array when there are no reactions", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([]);

    const result = await getAllSlugReactions();
    expect(result).toEqual([]);
  });

  it("limits results to 50 entries", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      slug: `post-${i}`,
      emoji: "👍",
      _count: { emoji: 60 - i },
      _min: { createdAt: new Date() },
    }));
    mockEmojiReaction.groupBy.mockResolvedValue(rows);

    const result = await getAllSlugReactions();
    expect((result as unknown[]).length).toBe(50);
  });

  it("returns cached result without hitting DB", async () => {
    const { cache: mockCache } = await import("../cache");
    const cachedData = [
      {
        slug: "cached-post",
        total: 99,
        reactions: [{ emoji: "🔥", count: 99 }],
      },
    ];
    vi.mocked(mockCache.get).mockReturnValueOnce(cachedData);

    const result = await getAllSlugReactions();
    expect(result).toEqual(cachedData);
    expect(mockEmojiReaction.groupBy).not.toHaveBeenCalled();
  });

  it("stores result in cache after DB query", async () => {
    const { cache: mockCache } = await import("../cache");
    mockEmojiReaction.groupBy.mockResolvedValue([
      {
        slug: "post-a",
        emoji: "👍",
        _count: { emoji: 5 },
        _min: { createdAt: new Date() },
      },
    ]);

    await getAllSlugReactions();
    expect(mockCache.set).toHaveBeenCalledWith(
      "reactions:all-slugs-ranking",
      expect.any(Array),
      5 * 60_000,
    );
  });
});

describe("toggleReaction", () => {
  let toggleReaction: (
    slug: string,
    emoji: string,
    clientId: string,
  ) => Promise<unknown>;

  beforeAll(async () => {
    const mod = await import("../reactionClient");
    toggleReaction = mod.toggleReaction;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'removed' and calls delete when reaction already exists", async () => {
    mockEmojiReaction.findUnique.mockResolvedValue({ id: 1 });
    mockEmojiReaction.delete.mockResolvedValue({});

    const result = await toggleReaction("my-slug", "👍", "client-xyz");
    expect(result).toBe("removed");
    expect(mockEmojiReaction.delete).toHaveBeenCalledOnce();
  });

  it("returns 'added' and calls create when reaction does not exist", async () => {
    mockEmojiReaction.findUnique.mockResolvedValue(null);
    mockEmojiReaction.create.mockResolvedValue({});

    const result = await toggleReaction("my-slug", "👍", "client-xyz");
    expect(result).toBe("added");
    expect(mockEmojiReaction.create).toHaveBeenCalledOnce();
  });

  it("returns 'added' on P2002 unique constraint violation", async () => {
    mockEmojiReaction.findUnique.mockResolvedValue(null);
    mockEmojiReaction.create.mockRejectedValue(
      new MockPrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
      }),
    );

    const result = await toggleReaction("my-slug", "👍", "client-xyz");
    expect(result).toBe("added");
  });
});

describe("slow query warning", () => {
  type QueryEventLike = {
    duration: number;
    query: string;
    params: string;
    timestamp: Date;
    target: string;
  };
  let queryHandler: ((e: QueryEventLike) => void) | undefined;

  beforeAll(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import("../reactionClient");
    mockEmojiReaction.groupBy.mockResolvedValue([]);
    mockEmojiReaction.findMany.mockResolvedValue([]);
    await mod.getReactions("test-slug", "test-client");

    // getClient() が $on("query", handler) を呼んでいることを確認し handler を取得
    const queryCall = (mockPrismaOn.mock.calls as [string, unknown][]).find(
      ([event]) => event === "query",
    );
    queryHandler = queryCall?.[1] as typeof queryHandler;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should warn when SQL query exceeds threshold", () => {
    queryHandler?.({
      duration: 500,
      query: "SELECT * FROM emoji_reactions",
      params: "{}",
      timestamp: new Date(),
      target: "test",
    });

    expect(vi.mocked(astroLogger.warn)).toHaveBeenCalledWith(
      expect.stringContaining("Slow SQL query"),
      expect.objectContaining({ duration: 500 }),
    );
  });

  it("should not warn when SQL query is within threshold", () => {
    queryHandler?.({
      duration: 100,
      query: "SELECT 1",
      params: "{}",
      timestamp: new Date(),
      target: "test",
    });

    expect(vi.mocked(astroLogger.warn)).not.toHaveBeenCalledWith(
      expect.stringContaining("Slow SQL query"),
      expect.any(Object),
    );
  });
});
