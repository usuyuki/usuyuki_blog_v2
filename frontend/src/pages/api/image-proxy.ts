import type { APIRoute } from "astro";
import errorHandler from "~/libs/errorHandler";

export const GET: APIRoute = async ({ url }) => {
	const imageUrl = url.searchParams.get("url");

	if (!imageUrl) {
		return new Response(
			JSON.stringify({ error: "URL parameter is required" }),
			{
				status: 400,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	try {
		const decodedUrl = decodeURIComponent(imageUrl);

		if (!decodedUrl.startsWith("https://blogapi.usuyuki.net/content/images/")) {
			return new Response(JSON.stringify({ error: "Invalid image URL" }), {
				status: 400,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		const response = await fetch(decodedUrl);

		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.status}`);
		}

		const contentType =
			response.headers.get("content-type") || "application/octet-stream";
		const imageBuffer = await response.arrayBuffer();

		return new Response(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=31536000",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		errorHandler.handleApiError("/api/image-proxy", error as Error, {
			imageUrl,
		});

		return new Response(JSON.stringify({ error: "Failed to proxy image" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};
