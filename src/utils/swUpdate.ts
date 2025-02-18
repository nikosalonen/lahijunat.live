export function registerSWUpdateHandler() {
	if ("serviceWorker" in navigator) {
		let refreshing = false;

		// Handle the controllerchange event
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			if (refreshing) return;
			refreshing = true;
			window.location.reload();
		});

		// Check for updates every 60 minutes
		setInterval(
			async () => {
				const registration = await navigator.serviceWorker.getRegistration();
				if (registration) {
					try {
						await registration.update();
					} catch (err) {
						console.error("Error checking for SW updates:", err);
					}
				}
			},
			60 * 60 * 1000,
		);

		// Handle updates immediately when found
		navigator.serviceWorker.ready.then((registration) => {
			registration.addEventListener("updatefound", () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener("statechange", () => {
					if (
						newWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						const shouldUpdate = window.confirm(
							"Uusi versio sovelluksesta on saatavilla. Haluatko päivittää nyt?",
						);
						if (shouldUpdate) {
							newWorker.postMessage({ type: "SKIP_WAITING" });
						}
					}
				});
			});
		});
	}
}
