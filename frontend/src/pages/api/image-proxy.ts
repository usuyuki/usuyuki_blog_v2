import type { APIRoute } from "astro";
import { getGhostFrontUrl } from "~/libs/env";
import loggerService from "~/libs/logger";

export const GET: APIRoute = async ({ url }) => {
	const imagePath = url.searchParams.get("path");

	if (!imagePath) {
		return new Response(
			JSON.stringify({ error: "Path parameter is required" }),
			{
				status: 400,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	try {
		// blogapiの方でないとエラーになる
		const ghostApiUrl = getGhostFrontUrl();

		if (!ghostApiUrl) {
			return new Response(
				JSON.stringify({ error: "Ghost API URL not configured" }),
				{
					status: 500,
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}

		if (imagePath.includes("..") || imagePath.startsWith("/")) {
			return new Response(JSON.stringify({ error: "Invalid image path" }), {
				status: 400,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		const imageUrl = `${ghostApiUrl}/content/images/${imagePath}`;
		const response = await fetch(imageUrl);

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
		await loggerService.warn(
			`Image proxy error: ${(error as Error).message}`,
			error as Error,
			{
				endpoint: "/api/image-proxy",
				imagePath,
				errorType: "image_proxy_error",
			},
		);

		return new Response(JSON.stringify({ error: "Failed to proxy image" }), {
			status: 404,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};
