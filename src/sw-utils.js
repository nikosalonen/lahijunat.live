// Custom service worker utilities
// This file will be imported via importScripts in the generated service worker

import { pageCache } from "workbox-recipes";

// Use workbox-recipes pageCache for proper navigation preload support
pageCache({
	cacheName: "pages",
	networkTimeoutSeconds: 3,
	matchCallback: ({ request }) => request.mode === "navigate",
});

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});
