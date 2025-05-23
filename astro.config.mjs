// @ts-check
import { defineConfig } from "astro/config";

import fs from "node:fs/promises";
import path, { join } from "node:path";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

const mySwPlugin = () => {
	let config;
	return {
		name: "customSw",
		hooks: {
			"astro:config:done": async ({ config: cfg }) => {
				config = cfg;
			},
			"astro:build:done": async (args) => {
				const swUrl = join("/", "sw.js");
				const injection = `
                    <script>
                        if ('serviceWorker' in navigator) {
                            window.addEventListener('load', () => {
                                navigator.serviceWorker.register('${swUrl}');
                            });
														self.addEventListener('message', (event) => {
														if (event.data && event.data.type === 'SKIP_WAITING') {
															self.skipWaiting();
														}
													});
                        }
                    </script>`
					.split("\n")
					.map((x) => x.trim())
					.join("");

				// Recursively find all HTML files
				async function processDirectory(dirPath) {
					try {
						const normalizedPath = path.resolve(dirPath);
						const entries = await fs.readdir(normalizedPath, { withFileTypes: true });
						for (const entry of entries) {
							const fullPath = path.join(normalizedPath, entry.name);
							if (entry.isDirectory()) {
								await processDirectory(fullPath);
							} else if (entry.name.endsWith(".html")) {
								const html = await fs.readFile(fullPath, "utf8");
								const updatedHtml = html.replace(
									"</head>",
									`${injection}</head>`,
								);
								await fs.writeFile(fullPath, updatedHtml);
							}
						}
					} catch (error) {
						console.error(`Error processing directory ${dirPath}:`, error);
						throw error;
					}
				}

				const distPath = path.resolve(process.cwd(), 'dist');
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
