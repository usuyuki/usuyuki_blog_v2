import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	beforeEach,
	afterEach,
} from "vitest";

const { mockEmojiReaction, MockPrismaClientKnownRequestError } = vi.hoisted(
	() => {
		class MockPrismaClientKnownRequestError extends Error {
			code: string;
			constructor(message: string, { code }: { code: string }) {
				super(message);
				this.code = code;
			}
		}
		return {
			mockEmojiReaction: {
				groupBy: vi.fn(),
				findMany: vi.fn(),
				findUnique: vi.fn(),
				create: vi.fn(),
				delete: vi.fn(),
			},
			MockPrismaClientKnownRequestError,
		};
	},
);

vi.mock("@prisma/client", () => ({
	PrismaClient: vi.fn(function () {
		return { emojiReaction: mockEmojiReaction };
	}),
	Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
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
});

describe("getReactions", () => {
	let getReactions: (slug: string, clientId: string) => Promise<unknown>;
	let savedNsfwList: string | undefined;

	beforeAll(async () => {
		vi.resetModules();
		const mod = await import("../reactionClient");
		getReactions = mod.getReactions;
	});

	beforeEach(() => {
		savedNsfwList = process.env.REACTIONS_NSFW_BLOCKLIST;
		delete process.env.REACTIONS_NSFW_BLOCKLIST;
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (savedNsfwList !== undefined) {
			process.env.REACTIONS_NSFW_BLOCKLIST = savedNsfwList;
		} else {
			delete process.env.REACTIONS_NSFW_BLOCKLIST;
		}
	});

	it("returns reaction with count and reacted: true when client has reacted", async () => {
		mockEmojiReaction.groupBy.mockResolvedValue([
			{ emoji: "👍", _count: { emoji: 3 }, _min: { createdAt: new Date() } },
		]);
		mockEmojiReaction.findMany.mockResolvedValue([{ emoji: "👍" }]);

		const result = await getReactions("my-slug", "client-xyz");
		expect(result).toEqual([{ emoji: "👍", count: 3, reacted: true }]);
	});

	it("returns reacted: false when client has not reacted", async () => {
		mockEmojiReaction.groupBy.mockResolvedValue([
			{ emoji: "❤️", _count: { emoji: 2 }, _min: { createdAt: new Date() } },
		]);
		mockEmojiReaction.findMany.mockResolvedValue([]);

		const result = await getReactions("my-slug", "other-client");
		expect(result).toEqual([{ emoji: "❤️", count: 2, reacted: false }]);
	});

	it("filters out NSFW emoji from results", async () => {
		mockEmojiReaction.groupBy.mockResolvedValue([
			{ emoji: "👍", _count: { emoji: 1 }, _min: { createdAt: new Date() } },
			{ emoji: "🍆", _count: { emoji: 5 }, _min: { createdAt: new Date() } },
		]);
		mockEmojiReaction.findMany.mockResolvedValue([]);

		const result = await getReactions("my-slug", "client-xyz");
		expect(result).toHaveLength(1);
		expect((result as Array<{ emoji: string }>)[0].emoji).toBe("👍");
	});
});

describe("toggleReaction", () => {
	let toggleReaction: (
		slug: string,
		emoji: string,
		clientId: string,
	) => Promise<unknown>;

	beforeAll(async () => {
		const mod = await import("../reactionClient");
		toggleReaction = mod.toggleReaction;
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 'removed' and calls delete when reaction already exists", async () => {
		mockEmojiReaction.findUnique.mockResolvedValue({ id: 1 });
		mockEmojiReaction.delete.mockResolvedValue({});

		const result = await toggleReaction("my-slug", "👍", "client-xyz");
		expect(result).toBe("removed");
		expect(mockEmojiReaction.delete).toHaveBeenCalledOnce();
	});

	it("returns 'added' and calls create when reaction does not exist", async () => {
		mockEmojiReaction.findUnique.mockResolvedValue(null);
		mockEmojiReaction.create.mockResolvedValue({});

		const result = await toggleReaction("my-slug", "👍", "client-xyz");
		expect(result).toBe("added");
		expect(mockEmojiReaction.create).toHaveBeenCalledOnce();
	});

	it("returns 'added' on P2002 unique constraint violation", async () => {
		mockEmojiReaction.findUnique.mockResolvedValue(null);
		mockEmojiReaction.create.mockRejectedValue(
			new MockPrismaClientKnownRequestError("Unique constraint failed", {
				code: "P2002",
			}),
		);

		const result = await toggleReaction("my-slug", "👍", "client-xyz");
		expect(result).toBe("added");
	});
});
