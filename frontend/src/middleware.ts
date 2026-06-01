import type { MiddlewareHandler } from "astro";
import astroLogger from "./libs/astroLogger.js";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Cloudflare tunnel経由でアクセスされる場合、ChromeがoriginをLocal address spaceと
  // 分類することがある。Twitter widgets.jsなど外部スクリプトのPNA (Private Network Access)
  // エラーを防ぐため、PNA仕様に従いOPTIONSプリフライトで許可ヘッダーを返す
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Private-Network": "true" },
    });
  }

  const startTime = Date.now();

  try {
    const response = await next();
    const duration = Date.now() - startTime;

    // 通常レスポンスにもPNAヘッダーを付与（プリフライトが不要なシンプルリクエスト対応）
    response.headers.set("Access-Control-Allow-Private-Network", "true");

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
