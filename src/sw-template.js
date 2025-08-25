import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
	CacheFirst,
	NetworkFirst,
	StaleWhileRevalidate,
} from "workbox-strategies";

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

// Take control of uncontrolled clients as soon as this SW activates
clientsClaim();

// Enable navigation preload to speed up first navigation after SW activation
self.addEventListener("activate", (event) => {
	event.waitUntil(self.registration.navigationPreload?.enable?.());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Runtime caching

// 1) API responses from Digitraffic: prefer fresh data, fall back to cache
registerRoute(
	({ url }) =>
		url.origin === "https://rata.digitraffic.fi" &&
		url.pathname.startsWith("/api/"),
	new NetworkFirst({
		cacheName: "api-digitraffic",
		networkTimeoutSeconds: 5,
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 5 }), // 5 minutes
		],
	}),
);

// 2) Static JS/CSS from our origin: SWR
registerRoute(
	({ request, url }) =>
		url.origin === self.location.origin &&
		(request.destination === "script" || request.destination === "style"),
	new StaleWhileRevalidate({
		cacheName: "static-resources",
		plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
	}),
);

// 3) Images: SWR with expiration
registerRoute(
	({ request }) => request.destination === "image",
	new StaleWhileRevalidate({
		cacheName: "images",
		plugins: [
			new ExpirationPlugin({
				maxEntries: 200,
				maxAgeSeconds: 60 * 60 * 24 * 30,
			}),
		], // 30 days
	}),
);

// 4) Fonts: Cache-first, long TTL
registerRoute(
	({ url, request }) =>
		request.destination === "font" ||
		/\.(?:woff2?|ttf|eot)$/i.test(url.pathname),
	new CacheFirst({
		cacheName: "fonts",
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({
				maxEntries: 30,
				maxAgeSeconds: 60 * 60 * 24 * 365,
			}), // 1 year
		],
	}),
);
