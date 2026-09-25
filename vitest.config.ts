import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests assert Finnish local times. vmThreads workers share this process's
// timezone, and setting TZ inside a worker thread has no effect, so set it
// here before any workers start instead of through `test.env`.
process.env.TZ = "Europe/Helsinki";

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
