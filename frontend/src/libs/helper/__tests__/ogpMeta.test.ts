import { describe, expect, it } from "vitest";
import { buildFixedOgpMeta } from "../ogpMeta";

describe("buildFixedOgpMeta", () => {
  it("正常系: 固定OGP画像のURLと実寸(width/height)を返す", () => {
    const result = buildFixedOgpMeta();

    expect(result).toEqual({
      ogImage: expect.stringContaining("/images/ogp/ogp.png"),
      ogImageWidth: 1200,
      ogImageHeight: 630,
    });
  });
});
