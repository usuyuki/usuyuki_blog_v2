import type { MiddlewareHandler } from "astro";
import astroLogger from "./libs/astroLogger.js";
import { checkDevPageAccess, isDevPagePath } from "./libs/devPageAuth.js";
import { getDevPagesCredentials, isDevPagesAuthDisabled } from "./libs/env.js";

// /dev配下(プレビューページ)の認証。開発環境では認証なし、本番では未設定なら404、設定済みならBasic認証を求める。
// ブラウザは最初に必ず認証なしでアクセスして401を受け取るため、401はログに残さない
const guardDevPage = (request: Request): Response | undefined => {
  const access = checkDevPageAccess({
    authDisabled: isDevPagesAuthDisabled(),
    authorization: request.headers.get("authorization"),
    credentials: getDevPagesCredentials(),
  });
  if (access === "not_found") return new Response(null, { status: 404 });
  if (access === "unauthorized") {
    return new Response("認証が必要です", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="usuyuki blog dev", charset="UTF-8"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  return undefined;
};

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

  const isDevPage = isDevPagePath(context.url.pathname);
  if (isDevPage) {
    const denied = guardDevPage(context.request);
    if (denied) return denied;
  }

  const startTime = Date.now();

  try {
    const response = await next();

    // 執筆者だけが使うページなので、検索エンジンに載せず、Cloudflareなどにもキャッシュさせない
    if (isDevPage) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set("Cache-Control", "private, no-store");
    }
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
