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
	const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
	return emojiRegex.test(emoji);
}

async function fetchGrouped(slug: string, client: PrismaClient): Promise<GroupedReaction[]> {
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
