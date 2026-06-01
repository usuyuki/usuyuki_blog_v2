import type { MiddlewareHandler } from "astro";
import astroLogger from "./libs/astroLogger.js";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Cloudflare tunnel経由でアクセスされる場合、ChromeがoriginをLocal address spaceと
  // 分類することがある。Twitter widgets.jsなど外部スクリプトのPNA (Private Network Access)
  // エラーを防ぐため、PNA仕様に従いOPTIONSプリフライトで許可ヘッダーを返す（APIルートを除く）
  if (
    context.request.method === "OPTIONS" &&
    !context.url.pathname.startsWith("/api/")
  ) {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Private-Network": "true" },
    });
  }

  const startTime = Date.now();

  try {
    const response = await next();
    const duration = Date.now() - startTime;

    // ページ・アセット系のみPNAヘッダーを付与（APIルートは外部からのPNAを許可しない）
    // Twitter widgets.jsなど外部スクリプトからのシンプルリクエストに対応するため
    if (!context.url.pathname.startsWith("/api/")) {
      response.headers.set("Access-Control-Allow-Private-Network", "true");
    }

    if (context.url.pathname.startsWith("/_image") && response.status >= 400) {
      await astroLogger.error(
        `Image processing failed: ${context.url.pathname}`,
        undefined,
        {
          url: context.url.toString(),
          status: response.status,
          duration,
          userAgent: context.request.headers.get("user-agent") ?? undefined,
        },
      );
    } else if (response.status >= 400) {
      await astroLogger.warn(`Request failed: ${context.url.pathname}`, {
        url: context.url.toString(),
        status: response.status,
        duration,
        userAgent: context.request.headers.get("user-agent") ?? undefined,
      });
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    await astroLogger.requestError(
      "Unhandled request error",
      context.request,
      error instanceof Error ? error : new Error(String(error)),
      { duration },
    );

    throw error;
  }
};
