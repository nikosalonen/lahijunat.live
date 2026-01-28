import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
		env: {
			TZ: "Europe/Helsinki",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
