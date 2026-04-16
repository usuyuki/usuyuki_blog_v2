import type { APIRoute } from "astro";
import {
  getReactions,
  toggleReaction,
  validateEmoji,
} from "~/libs/reactionClient";
import errorHandler from "~/libs/errorHandler";

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
    return new Response(JSON.stringify({ error: "slug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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

export const POST: APIRoute = async ({ params, cookies, request }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: "slug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
