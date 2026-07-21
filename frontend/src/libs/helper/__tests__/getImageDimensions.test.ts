import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/libs/astroLogger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cacheLog: vi.fn(),
  },
}));

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

const metadataMock = vi.fn();
vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: metadataMock })),
}));

global.fetch = vi.fn();

import { getImageDimensions } from "../getImageDimensions";
import { cache } from "~/libs/cache";

describe("getImageDimensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正常系: 画像URLを渡すとfetch・sharpで幅と高さを取得しキャッシュに保存する", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    metadataMock.mockResolvedValue({ width: 1200, height: 630 });

    const result = await getImageDimensions("https://example.com/image.jpg");

    expect(result).toEqual({ width: 1200, height: 630 });
    expect(cache.set).toHaveBeenCalledWith(
      "image_dimensions:https://example.com/image.jpg",
      { width: 1200, height: 630 },
      60 * 60 * 1000,
    );
  });

  it("正常系: キャッシュにヒットした場合はfetchせずキャッシュ値を返す", async () => {
    vi.mocked(cache.get).mockReturnValue({ width: 800, height: 400 });

    const result = await getImageDimensions("https://example.com/image.jpg");

    expect(result).toEqual({ width: 800, height: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("異常系: 画像URLが空文字だとfetchせずnullを返す", async () => {
    const result = await getImageDimensions("");

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("異常系: fetchが失敗するとレスポンスがokにならないのでnullを返す", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await getImageDimensions("https://example.com/missing.jpg");

    expect(result).toBeNull();
  });

  it("異常系: sharpが幅・高さを取得できないとundefinedになるのでnullを返す", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    metadataMock.mockResolvedValue({ width: undefined, height: undefined });

    const result = await getImageDimensions("https://example.com/broken.jpg");

    expect(result).toBeNull();
  });

  it("正常系: 同一URLへの同時呼び出しはfetchを1回だけ実行しどちらも同じ結果を返す", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    let resolveFetch!: (value: Response) => void;
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    metadataMock.mockResolvedValue({ width: 500, height: 300 });

    const call1 = getImageDimensions("https://example.com/concurrent.jpg");
    const call2 = getImageDimensions("https://example.com/concurrent.jpg");

    resolveFetch({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toEqual({ width: 500, height: 300 });
    expect(result2).toEqual({ width: 500, height: 300 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("正常系: 同時呼び出しが完了した後は進行中Promiseが破棄され次の呼び出しで再度fetchする", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    metadataMock.mockResolvedValue({ width: 100, height: 200 });

    await getImageDimensions("https://example.com/sequential.jpg");
    vi.mocked(cache.get).mockReturnValue(null);
    await getImageDimensions("https://example.com/sequential.jpg");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("異常系: fetchがタイムアウトで例外を投げるとSSRをハングさせずnullを返す", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    vi.mocked(global.fetch).mockRejectedValue(
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
    );

    const result = await getImageDimensions("https://example.com/slow.jpg");

    expect(result).toBeNull();
  });

  it("正常系: fetch呼び出しにタイムアウト用のAbortSignalが渡される", async () => {
    vi.mocked(cache.get).mockReturnValue(null);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    metadataMock.mockResolvedValue({ width: 1200, height: 630 });

    await getImageDimensions("https://example.com/image.jpg");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/image.jpg",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
