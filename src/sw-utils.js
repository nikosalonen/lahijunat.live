// Custom service worker utilities
// This file will be imported via importScripts in the generated service worker

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});
