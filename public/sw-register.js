// Service Worker registration and update handling.
//
// The service worker uses skipWaiting + clientsClaim (see workbox-config.cjs),
// so a freshly deployed version activates and takes control of open pages
// automatically — no blocking "update available" banner. Page content already
// refreshes through runtime caching (NetworkFirst HTML / StaleWhileRevalidate
// assets) on the next navigation, so no forced reload is needed.
//
// A small toast announces the takeover, but only for real releases: the app
// version is stamped into the service worker at build time (see
// scripts/stampSwVersion.mjs), the new worker is asked for it over a
// MessageChannel, and the toast shows only when the base semver differs from
// the version stored on this device. Deploys that don't bump the version
// (chores, bot commits) update silently.
if ("serviceWorker" in navigator) {
	const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // poll for new versions every 30 min
	const VERSION_REQUEST_TIMEOUT = 3000;
	const VERSION_STORAGE_KEY = "app-version";

	// Toast copy lives here (not in translations.ts) because this is a plain
	// public/ script that cannot import the app's module graph.
	const updateToastTranslations = {
		fi: "Sovellus päivitettiin uusimpaan versioon",
		en: "App updated to the latest version",
		sv: "Appen uppdaterades till den senaste versionen",
	};

	function getUpdateToastMessage() {
		let lang = "fi";
		try {
			// localStorage access throws in some privacy modes (e.g. Safari
			// private browsing); fall back to Finnish rather than losing the toast.
			lang = localStorage.getItem("lang") || "fi";
		} catch {}
		return updateToastTranslations[lang] || updateToastTranslations.fi;
	}

	// Reuse the in-app toast system, which listens for a "show-toast" window
	// CustomEvent (see src/utils/toast.ts and src/components/Toast.tsx).
	function showUpdateToast() {
		window.dispatchEvent(
			new CustomEvent("show-toast", {
				detail: {
					message: getUpdateToastMessage(),
					type: "success",
					duration: 5000,
				},
			}),
		);
	}

	// "1.19.0-beta.2" → "1.19.0"; prerelease churn is not worth announcing.
	function getBaseVersion(version) {
		const match = /^(\d+\.\d+\.\d+)/.exec(version);
		return match ? match[1] : version;
	}

	function getStoredVersion() {
		try {
			return localStorage.getItem(VERSION_STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function storeVersion(version) {
		try {
			localStorage.setItem(VERSION_STORAGE_KEY, version);
		} catch {}
	}

	// Ask the controlling service worker for its stamped version. Resolves
	// null on timeout, e.g. when an older worker without the GET_VERSION
	// handler is still in control.
	function getControllerVersion() {
		return new Promise((resolve) => {
			const controller = navigator.serviceWorker.controller;
			if (!controller) {
				resolve(null);
				return;
			}
			const channel = new MessageChannel();
			const timer = setTimeout(() => resolve(null), VERSION_REQUEST_TIMEOUT);
			channel.port1.onmessage = (event) => {
				clearTimeout(timer);
				resolve((event.data && event.data.version) || null);
			};
			try {
				controller.postMessage({ type: "GET_VERSION" }, [channel.port2]);
			} catch {
				clearTimeout(timer);
				resolve(null);
			}
		});
	}

	async function handleControllerChange() {
		const version = await getControllerVersion();
		if (!version) return;
		const storedVersion = getStoredVersion();
		storeVersion(version);
		// No baseline yet (first run after this feature shipped): seed silently.
		if (!storedVersion) return;
		if (getBaseVersion(storedVersion) === getBaseVersion(version)) return;
		showUpdateToast();
	}

	// Record the current version on load so the next real release has a
	// baseline to compare against, even on devices that never saw a toast.
	async function seedStoredVersion() {
		if (getStoredVersion()) return;
		const version = await getControllerVersion();
		if (version) storeVersion(version);
	}

	// A controllerchange with no prior controller is the initial install
	// (clientsClaim taking control for the first time), which is not an update
	// worth announcing — just record the version. Later controllerchanges in
	// the same page session are real takeovers; serialize the async checks so
	// back-to-back deploys can't race each other into a duplicate toast.
	let hasBeenClaimed = !!navigator.serviceWorker.controller;
	let pendingCheck = Promise.resolve();

	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (!hasBeenClaimed) {
			hasBeenClaimed = true;
			pendingCheck = pendingCheck.then(seedStoredVersion);
			return;
		}
		pendingCheck = pendingCheck.then(handleControllerChange);
	});

	const registerSW = async () => {
		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			console.log("SW registered successfully");

			if (navigator.serviceWorker.controller) seedStoredVersion();

			// Periodically check for a newer deployment while the page stays open.
			setInterval(async () => {
				try {
					await registration.update();
				} catch (err) {
					console.error("Error checking for SW updates:", err);
				}
			}, UPDATE_CHECK_INTERVAL);
		} catch (err) {
			console.error("SW registration failed:", err);
		}
	};

	// Register when the document is ready.
	if (
		document.readyState === "complete" ||
		document.readyState === "interactive"
	) {
		registerSW();
	} else {
		window.addEventListener("load", registerSW);
	}
}
