// @ts-check

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mySwPlugin = () => {
	return {
		name: "customSw",
		hooks: {
			"astro:config:done": async (/** @type {any} */ { config: _cfg }) => {
				// Config received but not used in this plugin
			},
			"astro:build:done": async (/** @type {any} */ _args) => {
				// Use external script to avoid CSP issues with inline scripts
				const injection = `<script src="/sw-register.js"></script>`;

				// Recursively find all HTML files
				/**
				 * @param {string} dirPath
				 * @returns {Promise<void>}
				 */
				async function processDirectory(dirPath) {
					try {
						const normalizedPath = path.resolve(dirPath);
						const entries = await fs.readdir(normalizedPath, {
							withFileTypes: true,
						});
						for (const entry of entries) {
							const fullPath = path.join(normalizedPath, entry.name);
							if (entry.isDirectory()) {
								await processDirectory(fullPath);
							} else if (entry.name.endsWith(".html")) {
								const html = await fs.readFile(fullPath, "utf8");
								// Guard against duplicate injection
								const alreadyInjected = html.includes('src="/sw-register.js"');
								let updatedHtml = html;
								if (!alreadyInjected) {
									const headCloseRe = /<\/head\s*>/i;
									const bodyCloseRe = /<\/body\s*>/i;
									if (headCloseRe.test(html)) {
										updatedHtml = html.replace(headCloseRe, `${injection}</head>`);
									} else if (bodyCloseRe.test(html)) {
										updatedHtml = html.replace(bodyCloseRe, `${injection}</body>`);
									} else {
										updatedHtml = `${html}\n${injection}\n`;
									}
								}
								await fs.writeFile(fullPath, updatedHtml);
							}
						}
					} catch (error) {
						console.error(`Error processing directory ${dirPath}:`, error);
						throw error;
					}
				}

				const distPath = path.resolve(process.cwd(), "dist");
				await processDirectory(distPath);
			},
		},
	};
};

// https://astro.build/config
export default defineConfig({
	site: "https://www.lahijunat.live",
	image: {
		service: { entrypoint: "astro/assets/services/noop" },
	},
	vite: {
		// @ts-expect-error - Suppresses Vite plugin type mismatch caused by different Vite
		// versions in the dependency tree (Astro's bundled Vite vs @tailwindcss/vite's Vite).
		// This is a known issue and not a bug in Tailwind itself.
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
	},

	integrations: [preact(), sitemap(), mySwPlugin()],
});
