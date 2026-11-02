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
  // biome-ignore lint/complexity/useArrowFunction: newで呼ばれるためコンストラクタ可能なfunction式が必要
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
  // biome-ignore lint/complexity/useArrowFunction: newで呼ばれるためコンストラクタ可能なfunction式が必要
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

    it("正常系: 一般的な絵文字は有効と判定される", () => {
      expect(validateEmoji("👍")).toBe(true);
      expect(validateEmoji("❤️")).toBe(true);
      expect(validateEmoji("🎉")).toBe(true);
    });

    it("異常系: 空文字を入れると絵文字が無いので無効と判定される", () => {
      expect(validateEmoji("")).toBe(false);
    });

    it("正常系: ブロックリスト未設定ならNSFW絵文字も有効と判定される", () => {
      expect(validateEmoji("🍆")).toBe(true);
      expect(validateEmoji("🍑")).toBe(true);
      expect(validateEmoji("🖕")).toBe(true);
    });

    it("異常系: コードポイント数が8を超える文字列を入れると上限超過なので無効と判定される", () => {
      const longEmoji = "👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦";
      expect(validateEmoji(longEmoji)).toBe(false);
    });

    it("異常系: 通常の文字列を入れると絵文字ではないので無効と判定される", () => {
      expect(validateEmoji("abc")).toBe(false);
      expect(validateEmoji("hello")).toBe(false);
    });

    it("正常系: コードポイント上限内の合成絵文字は有効と判定される", () => {
      expect(validateEmoji("👨‍💻")).toBe(true);
    });

    it("正常系: キーキャップ数字の絵文字は有効と判定される", () => {
      expect(validateEmoji("1️⃣")).toBe(true);
      expect(validateEmoji("2️⃣")).toBe(true);
      expect(validateEmoji("0️⃣")).toBe(true);
      expect(validateEmoji("#️⃣")).toBe(true);
    });

    it("異常系: ただの数字を入れると絵文字ではないので無効と判定される", () => {
      expect(validateEmoji("1")).toBe(false);
      expect(validateEmoji("9")).toBe(false);
    });

    describe("with REACTIONS_NSFW_BLOCKLIST env var", () => {
      afterEach(() => {
        delete process.env.REACTIONS_NSFW_BLOCKLIST;
      });

      it("異常系: 環境変数のブロックリストに含まれる絵文字を入れるとブロック対象なので無効と判定される", async () => {
        process.env.REACTIONS_NSFW_BLOCKLIST = "🚀,🔥";
        vi.resetModules();
        const { validateEmoji: fn } = await import("../reactionClient");
        expect(fn("🚀")).toBe(false);
        expect(fn("🔥")).toBe(false);
      });

      it("正常系: 環境変数のブロックリストに無い絵文字は有効と判定される", async () => {
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

  it("正常系: 自分がリアクション済みならカウントとreacted: trueを返す", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      { emoji: "👍", _count: { emoji: 3 }, _min: { createdAt: new Date() } },
    ]);
    mockEmojiReaction.findMany.mockResolvedValue([{ emoji: "👍" }]);

    const result = await getReactions("my-slug", "client-xyz");
    expect(result).toEqual([{ emoji: "👍", count: 3, reacted: true }]);
  });

  it("正常系: 自分がリアクションしていなければreacted: falseを返す", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      { emoji: "❤️", _count: { emoji: 2 }, _min: { createdAt: new Date() } },
    ]);
    mockEmojiReaction.findMany.mockResolvedValue([]);

    const result = await getReactions("my-slug", "other-client");
    expect(result).toEqual([{ emoji: "❤️", count: 2, reacted: false }]);
  });

  it("正常系: NSFW絵文字は結果から除外される", async () => {
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

  it("正常系: リアクション合計数の降順でslugを返す", async () => {
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

  it("正常系: 1つのslugに付いた複数の絵文字を集計する", async () => {
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

  it("正常系: ブロックリストの絵文字は集計から除外される", async () => {
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

  it("正常系: slug形式に合わない不正なslug(過去に保存されたNQLペイロードなど)はランキングから除外される", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([
      {
        slug: "zz]+slug:-[victim",
        emoji: "👍",
        _count: { emoji: 100 },
        _min: { createdAt: new Date() },
      },
      {
        slug: "valid-post",
        emoji: "👍",
        _count: { emoji: 1 },
        _min: { createdAt: new Date() },
      },
    ]);

    const result = await getAllSlugReactions();
    const typed = result as Array<{ slug: string }>;
    expect(typed.map((r) => r.slug)).toEqual(["valid-post"]);
  });

  it("正常系: リアクションが無ければ空配列を返す", async () => {
    mockEmojiReaction.groupBy.mockResolvedValue([]);

    const result = await getAllSlugReactions();
    expect(result).toEqual([]);
  });

  it("正常系: 結果は上位50件までに絞られる", async () => {
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

  it("正常系: キャッシュがあればDBに問い合わせずキャッシュを返す", async () => {
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

  it("正常系: DBから集計した結果をキャッシュに保存する", async () => {
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

  it("正常系: リアクション済みなら削除して'removed'を返す", async () => {
    mockEmojiReaction.findUnique.mockResolvedValue({ id: 1 });
    mockEmojiReaction.delete.mockResolvedValue({});

    const result = await toggleReaction("my-slug", "👍", "client-xyz");
    expect(result).toBe("removed");
    expect(mockEmojiReaction.delete).toHaveBeenCalledOnce();
  });

  it("正常系: 未リアクションなら作成して'added'を返す", async () => {
    mockEmojiReaction.findUnique.mockResolvedValue(null);
    mockEmojiReaction.create.mockResolvedValue({});

    const result = await toggleReaction("my-slug", "👍", "client-xyz");
    expect(result).toBe("added");
    expect(mockEmojiReaction.create).toHaveBeenCalledOnce();
  });

  it("異常系: 同時作成で一意制約違反(P2002)が起きても既に追加済みなので'added'を返す", async () => {
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

  it("異常系: SQLの実行時間が閾値を超えると遅いクエリなので警告ログを出す", () => {
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

  it("正常系: SQLの実行時間が閾値以内なら警告ログを出さない", () => {
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
