// @ts-check
import { defineConfig } from "astro/config";

import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	site: "https://www.lahijunat.live",
	vite: {
		plugins: [tailwindcss()],
		server: {
			hmr: {
				protocol: "ws",
				host: "localhost",
				port: 24678, // default Vite HMR port
			},
		},
	},

	integrations: [preact()],
});
