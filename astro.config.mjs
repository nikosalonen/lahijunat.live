// @ts-check

import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Station pairs with direct commuter service, as "/from/to/" paths. Pairs
// without one are served with noindex (see src/pages/[...stations].astro), so
// listing them in the sitemap would contradict that.
const servedRoutePaths = new Set(
	JSON.parse(
		readFileSync(path.resolve(__dirname, "src/data/route-stats.json"), "utf8"),
	).served.map((/** @type {string} */ key) => {
		const [from, to] = key.split("-");
		return `/${from.toLowerCase()}/${to.toLowerCase()}/`;
	}),
);

/** Keeps the home page, index pages, line pages, station pages and served routes. */
const isSitemapPage = (/** @type {string} */ pageUrl) => {
	let pathname = new URL(pageUrl).pathname;
	try {
		pathname = decodeURIComponent(pathname);
	} catch {
		// Leave a malformed escape sequence as it is
	}
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length < 2) return true;
	if (segments[0] === "linja") return true;
	return servedRoutePaths.has(pathname);
};

const mySwPlugin = () => {
	return {
		name: "customSw",
		hooks: {
			"astro:config:done": async (/** @type {any} */ { config: _cfg }) => {
				// Config received but not used in this plugin
			},
			"astro:build:done": async (/** @type {any} */ _args) => {
				// Use external script to avoid CSP issues with inline scripts
				const injection = `<script src="/sw-register.js" defer></script>`;

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
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		environments: {
			client: {
				build: {
					rolldownOptions: {
						output: {
							// Every island is its own bundle entry, so the modules they
							// share (Preact, translations, hooks) end up as a dozen tiny
							// files the browser requests one by one. Merge them into one
							// chunk. The header, footer and toast islands are on every page,
							// so every page needs nearly all of it anyway.
							codeSplitting: {
								groups: [{ name: "shared", minShareCount: 2 }],
							},
						},
					},
				},
			},
		},
	},

	integrations: [
		preact(),
		sitemap({ filter: isSitemapPage }),
		mySwPlugin(),
	],
});
