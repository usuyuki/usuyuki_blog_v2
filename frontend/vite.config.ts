import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
	plugins: [
		svelte({
			hot: !process.env.VITEST,
			compilerOptions: {
				dev: !process.env.VITEST,
			},
		}),
	],
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.{test,spec}.{js,ts}"],
	},
	resolve: {
		alias: {
			"~": new URL("./src", import.meta.url).pathname,
		},
	},
});
