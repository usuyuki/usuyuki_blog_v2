import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCheckPublishedGhostSlug, mockToggleReaction } = vi.hoisted(() => ({
  mockCheckPublishedGhostSlug: vi.fn(),
  mockToggleReaction: vi.fn(async () => "added"),
}));

vi.mock("~/libs/reactionClient", () => ({
  getReactions: vi.fn(async () => []),
  toggleReaction: mockToggleReaction,
  validateEmoji: vi.fn((emoji: string) => emoji === "👍"),
}));

vi.mock("~/libs/articleAggregator", () => ({
  checkPublishedGhostSlug: mockCheckPublishedGhostSlug,
}));

vi.mock("~/libs/astroLogger", () => ({
  default: {
    warn: vi.fn(),
  },
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
  clientAddress = "172.18.0.5",
}: {
  slug: string | undefined;
  method: "GET" | "POST";
  body?: string;
  ip?: string;
  // nullのときはアダプタがclientAddressに対応していない状況を再現して例外を投げる
  clientAddress?: string | null;
}) {
  return {
    params: { slug },
    cookies: {
      get: vi.fn(() => ({ value: "test-client-id" })),
      set: vi.fn(),
    },
    get clientAddress(): string {
      if (clientAddress === null) {
        throw new Error("clientAddress is not available");
      }
      return clientAddress;
    },
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
    vi.stubEnv("TRUST_CF_CONNECTING_IP", "true");
    mockCheckPublishedGhostSlug.mockImplementation(async (slug: string) =>
      ["test-post", "other-post"].includes(slug) ? "published" : "not_found",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      // 指定時は公開記事の判定結果をこの値に差し替える
      publishedStatus?: "published" | "not_found" | "unavailable";
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
        publishedStatus: "unavailable",
        wantStatus: 503,
        wantToggled: false,
      },
    ];

    for (const tt of tests) {
      it(tt.name, async () => {
        if (tt.publishedStatus)
          mockCheckPublishedGhostSlug.mockResolvedValue(tt.publishedStatus);
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

    describe("レート制限", () => {
      // 同じ送信元から上限回数POSTした後、別の送信元から1回POSTしたときのステータスを検証する
      const tests: {
        name: string;
        trustCfConnectingIp: boolean;
        // 上限まで送る送信元
        first: { ip: string; clientAddress?: string | null };
        // 上限到達後に送る送信元
        second: { ip: string; clientAddress?: string | null };
        wantSecondStatus: number;
      }[] = [
        {
          name: "異常系: 同一IPから上限を超えてPOSTするとレート制限に掛かるので429になる",
          trustCfConnectingIp: true,
          first: { ip: "198.51.100.7" },
          second: { ip: "198.51.100.7" },
          wantSecondStatus: 429,
        },
        {
          name: "正常系: 別IPは上限に達したIPの影響を受けない",
          trustCfConnectingIp: true,
          first: { ip: "198.51.100.7" },
          second: { ip: "198.51.100.8" },
          wantSecondStatus: 200,
        },
        {
          name: "異常系: 同じIPv6 /64内でアドレスを替えてPOSTしても同じ利用者として数えるので429になる",
          trustCfConnectingIp: true,
          first: { ip: "2001:db8:1:2::1" },
          second: { ip: "2001:db8:1:2:ffff:ffff:ffff:ffff" },
          wantSecondStatus: 429,
        },
        {
          name: "異常系: CF-Connecting-IPを信用しない設定でヘッダーを替えても接続元アドレスで数えるので429になる",
          trustCfConnectingIp: false,
          first: { ip: "198.51.100.7", clientAddress: "192.0.2.10" },
          second: { ip: "198.51.100.8", clientAddress: "192.0.2.10" },
          wantSecondStatus: 429,
        },
        {
          name: "正常系: IPが取得できない場合は全員で1つの枠を共有せず、clientIdごとに数える",
          trustCfConnectingIp: false,
          first: { ip: "198.51.100.7", clientAddress: null },
          second: { ip: "198.51.100.7", clientAddress: null },
          // buildContextのcookieは常に同じclientIdを返すため、同じ利用者として429になる
          wantSecondStatus: 429,
        },
      ];

      for (const tt of tests) {
        it(tt.name, async () => {
          vi.stubEnv(
            "TRUST_CF_CONNECTING_IP",
            tt.trustCfConnectingIp ? "true" : "false",
          );
          const { POST, REACTION_POST_RATE_LIMIT } = await import(
            "../reactions/[slug]"
          );
          const post = (from: { ip: string; clientAddress?: string | null }) =>
            (POST as Handler)(
              buildContext({
                slug: "test-post",
                method: "POST",
                body: JSON.stringify({ emoji: "👍" }),
                ip: from.ip,
                clientAddress: from.clientAddress,
              }),
            );
          for (let i = 0; i < REACTION_POST_RATE_LIMIT; i++) {
            expect((await post(tt.first)).status).toBe(200);
          }
          expect((await post(tt.second)).status).toBe(tt.wantSecondStatus);
        });
      }
    });
  });
});
