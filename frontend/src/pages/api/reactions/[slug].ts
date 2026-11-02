import type { APIRoute } from "astro";
import {
  getReactions,
  toggleReaction,
  validateEmoji,
} from "~/libs/reactionClient";
import errorHandler from "~/libs/errorHandler";
import { checkPublishedGhostSlug } from "~/libs/articleAggregator";
import astroLogger from "~/libs/astroLogger";
import { isCfConnectingIpTrusted } from "~/libs/env";
import { resolveClientIp, toRateLimitKey } from "~/libs/helper/clientIp";
import { createFixedWindowRateLimiter } from "~/libs/rateLimiter";
import { isSlug } from "~/libs/validation/isSlug";

// リアクションPOSTのIP単位レート制限(1分あたりの回数)。
// clientIdはcookie由来でクライアントが自由に作り直せるため、水増し・大量書き込みはIP単位で抑える
export const REACTION_POST_RATE_LIMIT = 30;
const reactionPostLimiter = createFixedWindowRateLimiter({
  limit: REACTION_POST_RATE_LIMIT,
  windowMs: 60_000,
});

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// レート制限のキーを決める。IPv6は/64単位にまとめる(toRateLimitKey参照)。
// アダプタの不具合などでIPが取れない場合に全員を1つの枠にまとめると、1人が使い切っただけで
// 全員がリアクションできなくなるため、cookieのclientId単位で制限する(cookieは作り直せるので制限としては弱い)
function buildRateLimitKey(
  clientIp: string | null,
  cookies: Parameters<APIRoute>[0]["cookies"],
): string {
  if (clientIp !== null) return `ip:${toRateLimitKey(clientIp)}`;
  astroLogger.warn("Client IP is unavailable, falling back to client id", {
    route: "/api/reactions/[slug]",
  });
  return `client:${getOrCreateClientId(cookies)}`;
}

function getOrCreateClientId(
  cookies: Parameters<APIRoute>[0]["cookies"],
): string {
  const existing = cookies.get("reaction_client_id")?.value;
  if (existing) return existing;
  const newId = crypto.randomUUID();
  cookies.set("reaction_client_id", newId, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
  });
  return newId;
}

export const GET: APIRoute = async ({ params, cookies }) => {
  const slug = params.slug;
  if (!slug) {
    return jsonResponse({ error: "slug is required" }, 400);
  }
  if (!isSlug(slug)) {
    return jsonResponse({ error: "Invalid slug" }, 400);
  }
  try {
    const clientId = getOrCreateClientId(cookies);
    const reactions = await getReactions(slug, clientId);
    return new Response(JSON.stringify({ reactions }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    errorHandler.handleApiError("/api/reactions/[slug]", error as Error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch reactions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const POST: APIRoute = async (context) => {
  const { params, cookies, request } = context;
  const slug = params.slug;
  if (!slug) {
    return jsonResponse({ error: "slug is required" }, 400);
  }
  // NQLメタ文字などを含むslugがDBに保存され、ランキングページのGhostクエリに混入するのを防ぐ
  if (!isSlug(slug)) {
    return jsonResponse({ error: "Invalid slug" }, 400);
  }
  const clientIp = resolveClientIp({
    cfConnectingIp: request.headers.get("cf-connecting-ip"),
    trustCfConnectingIp: isCfConnectingIpTrusted(),
    getClientAddress: () => context.clientAddress,
  });
  if (!reactionPostLimiter.tryConsume(buildRateLimitKey(clientIp, cookies))) {
    return jsonResponse({ error: "Too many requests" }, 429);
  }
  let body: { emoji?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const emoji = body.emoji;
  if (!emoji || !validateEmoji(emoji)) {
    return new Response(JSON.stringify({ error: "Invalid emoji" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    // 公開済みGhost記事以外のslugへの書き込みを拒否する(架空slugでテーブルやランキングを埋められるのを防ぐ)。
    // 鮮度の保証とGhostへの再取得間隔の制御はcheckPublishedGhostSlug側で行う
    const status = await checkPublishedGhostSlug(slug);
    if (status === "unavailable") {
      return jsonResponse({ error: "Article list is unavailable" }, 503);
    }
    if (status === "not_found") {
      return jsonResponse({ error: "Article not found" }, 404);
    }
    const clientId = getOrCreateClientId(cookies);
    const action = await toggleReaction(slug, emoji, clientId);
    const reactions = await getReactions(slug, clientId);
    return new Response(JSON.stringify({ reactions, action }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    errorHandler.handleApiError("/api/reactions/[slug]", error as Error);
    return new Response(
      JSON.stringify({ error: "Failed to update reaction" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
