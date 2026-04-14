import { describe, it, expect, vi } from "vitest";

vi.mock("~/libs/reactionClient", () => ({
	getReactions: vi.fn(async () => []),
	toggleReaction: vi.fn(async () => "added"),
	validateEmoji: vi.fn((emoji: string) => emoji === "👍"),
}));

vi.mock("~/libs/errorHandler", () => ({
	default: {
		handleApiError: vi.fn(),
	},
}));

describe("Reactions API", () => {
	it("GET handler is defined", async () => {
		const mod = await import("../reactions/[slug]");
		expect(typeof mod.GET).toBe("function");
	});

	it("POST handler is defined", async () => {
		const mod = await import("../reactions/[slug]");
		expect(typeof mod.POST).toBe("function");
	});

	it("GET returns 400 when slug is missing", async () => {
		const { GET } = await import("../reactions/[slug]");
		const ctx = {
			params: { slug: undefined },
			cookies: {
				get: vi.fn(() => undefined),
				set: vi.fn(),
			},
			request: new Request("http://localhost/api/reactions/"),
		} as unknown as Parameters<typeof GET>[0];
		const res = await GET(ctx);
		expect(res.status).toBe(400);
	});

	it("POST returns 400 for invalid emoji", async () => {
		const { POST } = await import("../reactions/[slug]");
		const ctx = {
			params: { slug: "test-post" },
			cookies: {
				get: vi.fn(() => ({ value: "test-client-id" })),
				set: vi.fn(),
			},
			request: new Request("http://localhost/api/reactions/test-post", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emoji: "invalid" }),
			}),
		} as unknown as Parameters<typeof POST>[0];
		const res = await POST(ctx);
		expect(res.status).toBe(400);
	});

	it("POST returns 200 for valid emoji with existing cookie", async () => {
		const { POST } = await import("../reactions/[slug]");
		const ctx = {
			params: { slug: "test-post" },
			cookies: {
				get: vi.fn(() => ({ value: "test-client-id" })),
				set: vi.fn(),
			},
			request: new Request("http://localhost/api/reactions/test-post", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emoji: "👍" }),
			}),
		} as unknown as Parameters<typeof POST>[0];
		const res = await POST(ctx);
		expect(res.status).toBe(200);
	});
});
