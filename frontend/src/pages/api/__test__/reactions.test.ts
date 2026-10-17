import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAllArticlesCached, mockToggleReaction } = vi.hoisted(() => ({
  mockGetAllArticlesCached: vi.fn(),
  mockToggleReaction: vi.fn(async () => "added"),
}));

vi.mock("~/libs/reactionClient", () => ({
  getReactions: vi.fn(async () => []),
  toggleReaction: mockToggleReaction,
  validateEmoji: vi.fn((emoji: string) => emoji === "👍"),
}));

vi.mock("~/libs/articleAggregator", () => ({
  getAllArticlesCached: mockGetAllArticlesCached,
}));

vi.mock("~/libs/errorHandler", () => ({
  default: {
    handleApiError: vi.fn(),
  },
}));

type Handler = (ctx: unknown) => Promise<Response>;

// APIルートに渡すコンテキストを組み立てる
function buildContext({
  slug,
  method,
  body,
  ip = "203.0.113.1",
}: {
  slug: string | undefined;
  method: "GET" | "POST";
  body?: string;
  ip?: string;
}) {
  return {
    params: { slug },
    cookies: {
      get: vi.fn(() => ({ value: "test-client-id" })),
      set: vi.fn(),
    },
    clientAddress: "172.18.0.5",
    request: new Request(`http://localhost/api/reactions/${slug ?? ""}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
      },
      body,
    }),
  };
}

describe("Reactions API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetAllArticlesCached.mockResolvedValue([
      { slug: "test-post" },
      { slug: "other-post" },
    ]);
  });

  describe("GET", () => {
    const tests: {
      name: string;
      slug: string | undefined;
      wantStatus: number;
    }[] = [
      {
        name: "正常系: 有効なslugなら200を返す",
        slug: "test-post",
        wantStatus: 200,
      },
      {
        name: "異常系: slugが無いと必須パラメータ欠落なので400になる",
        slug: undefined,
        wantStatus: 400,
      },
      {
        name: "異常系: NQLメタ文字を含むslugを入れるとslug形式に合わないので400になる",
        slug: "!x'",
        wantStatus: 400,
      },
    ];

    for (const tt of tests) {
      it(tt.name, async () => {
        const { GET } = await import("../reactions/[slug]");
        const res = await (GET as Handler)(
          buildContext({ slug: tt.slug, method: "GET" }),
        );
        expect(res.status).toBe(tt.wantStatus);
      });
    }
  });

  describe("POST", () => {
    const tests: {
      name: string;
      slug: string | undefined;
      body: string;
      // 指定時はGhostの公開記事一覧をこの値に差し替える(空配列=取得失敗)
      articles?: { slug: string }[];
      wantStatus: number;
      wantToggled: boolean;
    }[] = [
      {
        name: "正常系: 公開記事のslugと有効な絵文字なら200を返しリアクションを保存する",
        slug: "test-post",
        body: JSON.stringify({ emoji: "👍" }),
        wantStatus: 200,
        wantToggled: true,
      },
      {
        name: "異常系: slugが無いと必須パラメータ欠落なので400になる",
        slug: undefined,
        body: JSON.stringify({ emoji: "👍" }),
        wantStatus: 400,
        wantToggled: false,
      },
      {
        name: "異常系: NQLメタ文字を含むslugを入れるとslug形式に合わないので400になる",
        slug: "zz]+slug:-[victim",
        body: JSON.stringify({ emoji: "👍" }),
        wantStatus: 400,
        wantToggled: false,
      },
      {
        name: "異常系: 不正な絵文字を入れると絵文字検証に失敗するので400になる",
        slug: "test-post",
        body: JSON.stringify({ emoji: "invalid" }),
        wantStatus: 400,
        wantToggled: false,
      },
      {
        name: "異常系: 不正なJSONを入れるとパースできないので400になる",
        slug: "test-post",
        body: "{",
        wantStatus: 400,
        wantToggled: false,
      },
      {
        name: "異常系: 公開記事に存在しないslugを入れると記事が無いので404になる",
        slug: "not-exist-post",
        body: JSON.stringify({ emoji: "👍" }),
        wantStatus: 404,
        wantToggled: false,
      },
      {
        name: "異常系: Ghostから記事一覧を取得できないと存在確認できないので503になる",
        slug: "test-post",
        body: JSON.stringify({ emoji: "👍" }),
        articles: [],
        wantStatus: 503,
        wantToggled: false,
      },
    ];

    for (const tt of tests) {
      it(tt.name, async () => {
        if (tt.articles)
          mockGetAllArticlesCached.mockResolvedValue(tt.articles);
        const { POST } = await import("../reactions/[slug]");
        const res = await (POST as Handler)(
          buildContext({ slug: tt.slug, method: "POST", body: tt.body }),
        );
        expect(res.status).toBe(tt.wantStatus);
        expect(mockToggleReaction).toHaveBeenCalledTimes(
          tt.wantToggled ? 1 : 0,
        );
      });
    }

    it("異常系: 同一IPから上限を超えてPOSTするとレート制限に掛かるので429になる", async () => {
      const { POST, REACTION_POST_RATE_LIMIT } = await import(
        "../reactions/[slug]"
      );
      const post = () =>
        (POST as Handler)(
          buildContext({
            slug: "test-post",
            method: "POST",
            body: JSON.stringify({ emoji: "👍" }),
            ip: "198.51.100.7",
          }),
        );
      for (let i = 0; i < REACTION_POST_RATE_LIMIT; i++) {
        expect((await post()).status).toBe(200);
      }
      expect((await post()).status).toBe(429);

      // 別IPは影響を受けない
      const other = await (POST as Handler)(
        buildContext({
          slug: "test-post",
          method: "POST",
          body: JSON.stringify({ emoji: "👍" }),
          ip: "198.51.100.8",
        }),
      );
      expect(other.status).toBe(200);
    });
  });
});
