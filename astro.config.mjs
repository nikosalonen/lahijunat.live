// @ts-check

import fs from "node:fs/promises";
import path from "node:path";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

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
								const updatedHtml = alreadyInjected
									? html
									: html.replace("</head>", `${injection}</head>`);
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
	vite: {
		plugins: [tailwindcss()],
	},

	integrations: [preact(), mySwPlugin()],
});
