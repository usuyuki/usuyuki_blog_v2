import { PrismaClient, Prisma } from "@prisma/client";
import { cache } from "./cache";
import { getNsfwBlocklist } from "./env";

// GETリクエスト毎にgroupByクエリが走るのを防ぐため、集計結果をスラグ単位でキャッシュする。
// reacted状態はユーザー固有なので集計カウントのみキャッシュし、findManyは都度実行する。
// 短いTTLにすることで、リアクション後に他ユーザーが見たときのカウントズレを許容範囲に抑える。
// POST時にキャッシュを即時破棄するため、TTLは安全網（コンテナ再起動なしに最終整合する保証）。
// コンテナ再起動でインメモリキャッシュはリセットされるため、実質的にTTLが効くケースはほぼない。
const REACTIONS_CACHE_TTL_MS = 30 * 24 * 60 * 60_000; // 30日

type GroupedReaction = {
  emoji: string;
  _count: { emoji: number };
  _min: { createdAt: Date | null };
};

export interface EmojiReaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

const MAX_CODEPOINTS = 8;

let prisma: PrismaClient | null = null;

function buildDatasourceUrl(): string {
  const host = process.env.REACTIONS_DB_HOST ?? "localhost";
  const user = process.env.REACTIONS_DB_USER ?? "root";
  const password = process.env.REACTIONS_DB_PASSWORD ?? "";
  const name = process.env.REACTIONS_DB_NAME ?? "usuyuki_blog";
  return `mysql://${user}:${encodeURIComponent(password)}@${host}/${name}`;
}

function getClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({ datasourceUrl: buildDatasourceUrl() });
  }
  return prisma;
}

export function validateEmoji(emoji: string): boolean {
  if (!emoji) return false;
  const codepoints = [...emoji];
  if (codepoints.length > MAX_CODEPOINTS) return false;
  if (getNsfwBlocklist().has(emoji)) return false;
  // \p{Emoji_Presentation} だけでは数字キーキャップ絵文字（1️⃣ など）や
  // variation selector-16（\uFE0F）合成絵文字がマッチしないため、
  // \p{Emoji} も対象に含める。ただし数字・記号単体（1, # 等）が通らないよう
  // \p{Emoji}\uFE0F の形で VS-16 との合成を必須にしている。
  // 注意: \p{Emoji} は数字・記号を含むため、将来的に ZWJ シーケンスの複雑な
  // ケース（例: 新しい複合絵文字）で意図外マッチが起きる可能性がある。
  // その場合は MAX_CODEPOINTS による長さ制限が安全網として機能する。
  const emojiRegex =
    /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji}\uFE0F/u;
  return emojiRegex.test(emoji);
}

async function fetchGrouped(
  slug: string,
  client: PrismaClient,
): Promise<GroupedReaction[]> {
  const cacheKey = `reactions:grouped:${slug}`;
  const cached = cache.get<GroupedReaction[]>(cacheKey);
  if (cached) return cached;

  const grouped = await client.emojiReaction.groupBy({
    by: ["emoji"],
    where: { slug },
    _count: { emoji: true },
    _min: { createdAt: true },
    orderBy: [{ _min: { createdAt: "asc" } }],
    take: 100,
  });

  cache.set(cacheKey, grouped as unknown as object[], REACTIONS_CACHE_TTL_MS);
  return grouped;
}

export async function getReactions(
  slug: string,
  clientId: string,
): Promise<EmojiReaction[]> {
  const client = getClient();

  const grouped = await fetchGrouped(slug, client);

  const clientReactions = await client.emojiReaction.findMany({
    where: { slug, clientId },
    select: { emoji: true },
  });

  const reactedEmojis = new Set(clientReactions.map((r) => r.emoji));
  const blocklist = getNsfwBlocklist();

  return grouped
    .filter((r) => !blocklist.has(r.emoji))
    .map((r) => ({
      emoji: r.emoji,
      count: r._count.emoji,
      reacted: reactedEmojis.has(r.emoji),
    }));
}

export interface SlugReactionSummary {
  slug: string;
  total: number;
  reactions: { emoji: string; count: number }[];
}

const REACTIONS_RANKING_LIMIT = 50;
// ランキングはtoggle時に個別スラグキャッシュを破棄できないため、短めのTTLで整合を保つ。
const REACTIONS_RANKING_CACHE_TTL_MS = 5 * 60_000; // 5分
const REACTIONS_RANKING_CACHE_KEY = "reactions:all-slugs-ranking";

export async function getAllSlugReactions(): Promise<SlugReactionSummary[]> {
  const cached = cache.get<SlugReactionSummary[]>(REACTIONS_RANKING_CACHE_KEY);
  if (cached) return cached;

  const client = getClient();
  const blocklist = getNsfwBlocklist();

  const grouped = await client.emojiReaction.groupBy({
    by: ["slug", "emoji"],
    _count: { emoji: true },
    _min: { createdAt: true },
    orderBy: [{ slug: "asc" }, { _min: { createdAt: "asc" } }],
  });

  const slugMap = new Map<string, { emoji: string; count: number }[]>();
  for (const row of grouped) {
    if (blocklist.has(row.emoji)) continue;
    if (!slugMap.has(row.slug)) slugMap.set(row.slug, []);
    slugMap.get(row.slug)?.push({ emoji: row.emoji, count: row._count.emoji });
  }

  const result: SlugReactionSummary[] = [];
  for (const [slug, reactions] of slugMap) {
    const total = reactions.reduce((sum, r) => sum + r.count, 0);
    result.push({ slug, total, reactions });
  }

  result.sort((a, b) => b.total - a.total);
  const ranking = result.slice(0, REACTIONS_RANKING_LIMIT);
  cache.set(
    REACTIONS_RANKING_CACHE_KEY,
    ranking,
    REACTIONS_RANKING_CACHE_TTL_MS,
  );
  return ranking;
}

export async function toggleReaction(
  slug: string,
  emoji: string,
  clientId: string,
): Promise<"added" | "removed"> {
  const client = getClient();

  const existing = await client.emojiReaction.findUnique({
    where: { uq_reaction: { slug, emoji, clientId } },
  });

  if (existing) {
    await client.emojiReaction.delete({
      where: { uq_reaction: { slug, emoji, clientId } },
    });
    // DB更新後はキャッシュを即時破棄し、次のgetReactionsで最新カウントを取得させる
    cache.delete(`reactions:grouped:${slug}`);
    return "removed";
  }

  try {
    await client.emojiReaction.create({
      data: { slug, emoji, clientId },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return "added";
    }
    throw e;
  }
  // DB更新後はキャッシュを即時破棄し、次のgetReactionsで最新カウントを取得させる
  cache.delete(`reactions:grouped:${slug}`);
  return "added";
}
