import type { APIRoute } from "astro";
import {
  getReactions,
  toggleReaction,
  validateEmoji,
} from "~/libs/reactionClient";
import errorHandler from "~/libs/errorHandler";
import { getAllArticlesCached } from "~/libs/articleAggregator";
import { resolveClientIp } from "~/libs/helper/clientIp";
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
  const clientIp = resolveClientIp(
    request.headers.get("cf-connecting-ip"),
    () => context.clientAddress,
  );
  if (!reactionPostLimiter.tryConsume(clientIp)) {
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
    // 公開直後の記事も、記事ページ表示時にgetAllGhostArticlesForArticlePageがキャッシュを更新済みのため見つかる
    const ghostArticles = await getAllArticlesCached(false);
    if (ghostArticles.length === 0) {
      return jsonResponse({ error: "Article list is unavailable" }, 503);
    }
    if (!ghostArticles.some((article) => article.slug === slug)) {
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
