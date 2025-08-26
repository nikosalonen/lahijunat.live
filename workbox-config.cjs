module.exports = {
	globDirectory: "dist/",
	globPatterns: ["**/*.{js,css,xml,eot,ttf,woff,woff2,png,svg,json}"],
	// Avoid precaching HTML pages to keep install size small; use runtime caching instead
	globIgnores: ["**/*.html"],
	swDest: "dist/sw.js",
	mode: "production",

	// Service worker configuration
	skipWaiting: false, // Let user decide when to update
	clientsClaim: true,

	// Enable navigation preload
	navigationPreload: true,

	// Add custom message handling for skip waiting
	additionalManifestEntries: [],
	cleanupOutdatedCaches: true,

	// Import custom utilities
	importScripts: ["sw-utils.js"],

	// Runtime caching strategies
	// NOTE: Navigation preload for pages is handled in sw-utils.js using workbox-recipes.pageCache()
	runtimeCaching: [
		{
			// API responses from Digitraffic: prefer fresh data, fall back to cache
			urlPattern: ({ url }) =>
				url.origin === "https://rata.digitraffic.fi" &&
				url.pathname.startsWith("/api/"),
			handler: "NetworkFirst",
			options: {
				cacheName: "api-digitraffic",
				networkTimeoutSeconds: 5,
				cacheableResponse: {
					statuses: [0, 200],
				},
				expiration: {
					maxEntries: 100,
					maxAgeSeconds: 60 * 5, // 5 minutes
				},
			},
		},
		{
			// Static JS/CSS from our origin: StaleWhileRevalidate
			urlPattern: ({ request, url }) =>
				url.origin === self.location.origin &&
				(request.destination === "script" || request.destination === "style"),
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-resources",
				cacheableResponse: {
					statuses: [0, 200],
				},
			},
		},
		{
			// Images: StaleWhileRevalidate with expiration
			urlPattern: ({ request }) => request.destination === "image",
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "images",
				expiration: {
					maxEntries: 200,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			// Fonts: Cache-first, long TTL
			urlPattern: ({ url, request }) =>
				request.destination === "font" ||
				/\.(?:woff2?|ttf|eot)$/i.test(url.pathname),
			handler: "CacheFirst",
			options: {
				cacheName: "fonts",
				cacheableResponse: {
					statuses: [0, 200],
				},
				expiration: {
					maxEntries: 30,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
	],
};
