// Custom service worker utilities
// This file will be imported via importScripts in the generated service worker

// Replaced with the package.json version by scripts/stampSwVersion.mjs during
// the build; lets clients tell real releases apart from routine deploys.
const APP_VERSION = "__APP_VERSION__";

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
	if (event.data && event.data.type === "GET_VERSION" && event.ports?.[0]) {
		event.ports[0].postMessage({ version: APP_VERSION });
	}
});
