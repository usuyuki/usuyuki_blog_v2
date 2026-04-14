import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@prisma/client", () => ({
	PrismaClient: vi.fn(() => ({
		emojiReaction: {
			groupBy: vi.fn().mockResolvedValue([]),
			findMany: vi.fn().mockResolvedValue([]),
			findUnique: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({}),
			delete: vi.fn().mockResolvedValue({}),
		},
	})),
}));

describe("reactionClient", () => {
	describe("validateEmoji", () => {
		let validateEmoji: (emoji: string) => boolean;
		let savedNsfwList: string | undefined;

		beforeEach(async () => {
			savedNsfwList = process.env.REACTIONS_NSFW_BLOCKLIST;
			delete process.env.REACTIONS_NSFW_BLOCKLIST;
			vi.resetModules();
			const mod = await import("../reactionClient");
			validateEmoji = mod.validateEmoji;
		});

		afterEach(() => {
			if (savedNsfwList !== undefined) {
				process.env.REACTIONS_NSFW_BLOCKLIST = savedNsfwList;
			} else {
				delete process.env.REACTIONS_NSFW_BLOCKLIST;
			}
		});

		it("returns true for common emoji", () => {
			expect(validateEmoji("👍")).toBe(true);
			expect(validateEmoji("❤️")).toBe(true);
			expect(validateEmoji("🎉")).toBe(true);
		});

		it("returns false for empty string", () => {
			expect(validateEmoji("")).toBe(false);
		});

		it("returns false for default NSFW blocklisted emoji", () => {
			expect(validateEmoji("🍆")).toBe(false);
			expect(validateEmoji("🍑")).toBe(false);
			expect(validateEmoji("🖕")).toBe(false);
		});

		it("returns false when codepoint count exceeds 8", () => {
			const longEmoji = "👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦";
			expect(validateEmoji(longEmoji)).toBe(false);
		});

		it("returns false for plain text", () => {
			expect(validateEmoji("abc")).toBe(false);
			expect(validateEmoji("hello")).toBe(false);
		});

		it("accepts compound emoji within codepoint limit", () => {
			expect(validateEmoji("👨‍💻")).toBe(true);
		});

		describe("with REACTIONS_NSFW_BLOCKLIST env var", () => {
			afterEach(() => {
				delete process.env.REACTIONS_NSFW_BLOCKLIST;
			});

			it("blocks emoji specified in env var", async () => {
				process.env.REACTIONS_NSFW_BLOCKLIST = "🚀,🔥";
				vi.resetModules();
				const { validateEmoji: fn } = await import("../reactionClient");
				expect(fn("🚀")).toBe(false);
				expect(fn("🔥")).toBe(false);
			});

			it("allows default NSFW emoji when env var overrides the list", async () => {
				process.env.REACTIONS_NSFW_BLOCKLIST = "🚀";
				vi.resetModules();
				const { validateEmoji: fn } = await import("../reactionClient");
				expect(fn("🍆")).toBe(true);
			});
		});
	});

	describe("getReactions", () => {
		it("is defined as a function", async () => {
			const { getReactions } = await import("../reactionClient");
			expect(typeof getReactions).toBe("function");
		});
	});

	describe("toggleReaction", () => {
		it("is defined as a function", async () => {
			const { toggleReaction } = await import("../reactionClient");
			expect(typeof toggleReaction).toBe("function");
		});
	});
});
