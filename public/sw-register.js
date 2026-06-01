// Service Worker registration and update handling.
//
// The service worker uses skipWaiting + clientsClaim (see workbox-config.cjs),
// so a freshly deployed version activates and takes control of open pages
// automatically — no blocking "update available" banner. When that happens we
// surface a small, non-blocking toast instead. Page content already refreshes
// through runtime caching (NetworkFirst HTML / StaleWhileRevalidate assets) on
// the next navigation, so no forced reload is needed.
if ("serviceWorker" in navigator) {
	const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // poll for new versions every 30 min

	// Toast copy lives here (not in translations.ts) because this is a plain
	// public/ script that cannot import the app's module graph.
	const updateToastTranslations = {
		fi: "Sovellus päivitettiin uusimpaan versioon",
		en: "App updated to the latest version",
		sv: "Appen uppdaterades till den senaste versionen",
	};

	function getUpdateToastMessage() {
		const lang = localStorage.getItem("lang") || "fi";
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

	// A controllerchange with no prior controller is the initial install
	// (clientsClaim taking control for the first time), which is not an update
	// worth announcing. Only toast when the page already had a controller.
	const hadControllerAtStart = !!navigator.serviceWorker.controller;
	let updateToastShown = false;

	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (!hadControllerAtStart || updateToastShown) return;
		updateToastShown = true;
		showUpdateToast();
	});

	const registerSW = async () => {
		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			console.log("SW registered successfully");

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
