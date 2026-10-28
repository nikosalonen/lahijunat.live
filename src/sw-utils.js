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

// Declarative Web Push payloads are shown by the browser itself when it
// supports them. This handler covers browsers that still deliver a push event.
self.addEventListener("push", (event) => {
	let notification;
	try {
		notification = event.data.json().notification;
	} catch {
		// Bad or missing JSON: still show something, because browsers may
		// revoke the subscription of a push that shows nothing.
	}
	const { title, body, tag, lang, navigate } = notification ?? {};

	event.waitUntil(
		self.registration.showNotification(title ?? "Lähijunat", {
			body: body ?? "",
			tag,
			lang,
			icon: "/icons/icon-192-maskable.png",
			data: { url: navigate ?? "/" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url ?? "/";

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then(async (windowClients) => {
				const openClient = windowClients[0];
				// navigate() rejects for windows this worker does not control, and
				// older browsers lack it, so fall back to a new window.
				if (openClient && typeof openClient.navigate === "function") {
					try {
						await openClient.focus();
						return await openClient.navigate(url);
					} catch {
						// Fall through to openWindow below.
					}
				}
				return self.clients.openWindow(url);
			}),
	);
});
