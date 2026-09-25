import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		// Creates jsdom once per worker instead of once per test file, while
		// still giving each file its own module graph. Much faster on
		// low-core machines such as CI runners.
		pool: "vmThreads",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: [
			"src/**/*.{test,spec}.{js,ts,jsx,tsx}",
			"scripts/**/*.{test,spec}.ts",
		],
		env: {
			TZ: "Europe/Helsinki",
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/__tests__/**",
				"src/**/*.test.*",
				"src/**/*.spec.*",
				"src/**/*.d.ts",
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
