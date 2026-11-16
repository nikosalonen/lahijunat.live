import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests assert Finnish local times. vmThreads workers share this process's
// timezone, and setting TZ inside a worker thread has no effect, so set it
// here before any workers start instead of through `test.env`.
process.env.TZ = "Europe/Helsinki";

// Files named `*.foreign-tz.test.*` run with the browser in another time zone.
// Firefox's anti-fingerprinting reports Atlantic/Reykjavik (UTC+0), and these
// tests check that the site still shows Helsinki times there.
const FOREIGN_TZ_TESTS = "src/**/*.foreign-tz.test.{ts,tsx}";

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					// Creates jsdom once per worker instead of once per test file, while
					// still giving each file its own module graph. Much faster on
					// low-core machines such as CI runners.
					pool: "vmThreads",
					include: [
						"src/**/*.{test,spec}.{js,ts,jsx,tsx}",
						"scripts/**/*.{test,spec}.ts",
						"netlify/**/*.{test,spec}.ts",
					],
					exclude: [...configDefaults.exclude, FOREIGN_TZ_TESTS],
				},
			},
			{
				extends: true,
				test: {
					name: "foreign-tz",
					// Each fork is its own process, so changing TZ there takes effect.
					pool: "forks",
					env: { TZ: "Atlantic/Reykjavik" },
					include: [FOREIGN_TZ_TESTS],
				},
			},
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
