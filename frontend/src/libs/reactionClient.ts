import { PrismaClient, Prisma } from "@prisma/client";
import { getNsfwBlocklist } from "./env";

export interface EmojiReaction {
	emoji: string;
	count: number;
	reacted: boolean;
}

const MAX_CODEPOINTS = 8;

let prisma: PrismaClient | null = null;

function getClient(): PrismaClient {
	if (!prisma) {
		prisma = new PrismaClient();
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

export async function getReactions(
	slug: string,
	clientId: string,
): Promise<EmojiReaction[]> {
	const client = getClient();

	const grouped = await client.emojiReaction.groupBy({
		by: ["emoji"],
		where: { slug },
		_count: { emoji: true },
		_min: { createdAt: true },
		orderBy: [{ _min: { createdAt: "asc" } }],
		take: 20,
	});

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
	return "added";
}
