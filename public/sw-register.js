// Service Worker registration and update handling
if ("serviceWorker" in navigator) {
	let refreshing = false;
	let updateBanner = null;
	let dismissTimeoutId = null;

	// Simple translation system for PWA banner
	const bannerTranslations = {
		fi: {
			title: "🚀 Uusi versio sovelluksesta on saatavilla!",
			updateButton: "Päivitä nyt",
			dismissButton: "Myöhemmin",
		},
		en: {
      			title: "🚀 New version of the app is available!",
			updateButton: "Update now",
			dismissButton: "Later",
		},
	};

	// Get current language from localStorage (same as main app)
	function getCurrentLanguage() {
		return localStorage.getItem("lang") || "fi";
	}

	// Get translation for current language
	function getBannerTranslation(key) {
		const lang = getCurrentLanguage();
		return bannerTranslations[lang]?.[key] || bannerTranslations.fi[key];
	}

	// Create update notification banner
	function createUpdateBanner() {
		if (updateBanner) return updateBanner;

		// Detect mobile device
		const isMobile = window.innerWidth < 640;

		updateBanner = document.createElement("div");
		updateBanner.innerHTML = `
      <div id="pwa-banner" role="status" aria-live="polite" tabindex="-1" class="fixed top-0 left-0 right-0 z-[1001] transition-transform duration-300 ease-in-out bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-b-4 border-emerald-400 shadow-lg shadow-emerald-500/30 ${isMobile ? "py-2 px-3 text-sm min-h-[48px]" : "py-3 px-4 text-base min-h-[60px]"}" style="transform: translateY(-100%);">
        <div class="flex items-center justify-center ${isMobile ? "gap-2" : "gap-3"} flex-wrap w-full max-w-full">
          <span class="flex-shrink-1 min-w-0 text-center font-medium text-white">
            ${getBannerTranslation("title")}
          </span>
          <div class="flex gap-2 flex-shrink-0">
            <button id="sw-update-btn" aria-label="${getBannerTranslation("updateButton")}" style="-webkit-tap-highlight-color: transparent;" class="btn btn-sm min-h-[44px] min-w-[44px] px-4 py-2 touch-manipulation select-none active:scale-95 bg-white/90 text-emerald-700 border-white hover:bg-white hover:border-white hover:-translate-y-0.5 transition-all font-semibold shadow-sm">
              ${getBannerTranslation("updateButton")}
            </button>
            <button id="sw-dismiss-btn" aria-label="${getBannerTranslation("dismissButton")}" style="-webkit-tap-highlight-color: transparent;" class="btn btn-outline btn-sm min-h-[44px] min-w-[44px] px-4 py-2 touch-manipulation select-none active:scale-95 border-white/60 text-white hover:bg-white/20 hover:border-white hover:-translate-y-0.5 transition-all font-medium">
              ${getBannerTranslation("dismissButton")}
            </button>
          </div>
        </div>
      </div>
    `;

		document.body.appendChild(updateBanner);

		// Animate in and push header down
		setTimeout(() => {
			const bannerElement = document.getElementById("pwa-banner");
			if (bannerElement) {
				bannerElement.style.transform = "translateY(0)";

				// Wait for layout to complete after transform, then measure actual height
				requestAnimationFrame(() => {
					const bannerHeight = bannerElement.getBoundingClientRect().height;

					// Push header down based on actual banner height
					const nav = document.querySelector("nav");
					if (nav) {
						// Capture original marginTop before changing it
						if (!nav.dataset.originalMarginTop) {
							const computedStyle = getComputedStyle(nav);
							nav.dataset.originalMarginTop = nav.style.marginTop || computedStyle.marginTop || "0px";
						}
						nav.style.marginTop = `${bannerHeight}px`;
						nav.style.transition = "margin-top 0.3s ease-in-out";
					}

					// Set focus for screen readers and assistive technology
					bannerElement.focus();
				});
			}
		}, 100);

		return updateBanner;
	}

	// Show update banner
	function showUpdateBanner(newWorker, registration) {
		const banner = createUpdateBanner();
		const updateBtn = banner.querySelector("#sw-update-btn");
		const dismissBtn = banner.querySelector("#sw-dismiss-btn");

		// Only bind event listeners once per banner instance
		if (!banner.dataset.listenersBound) {
			updateBtn.addEventListener("click", () => {
				// Prefer registration.waiting (most current) over newWorker (potentially stale)
				const workerToUpdate = registration?.waiting || newWorker;
				if (workerToUpdate) {
					workerToUpdate.postMessage({ type: "SKIP_WAITING" });
				}
				hideUpdateBanner();
			});

			dismissBtn.addEventListener("click", () => {
				hideUpdateBanner();

				// Clear any existing timeout to prevent multiple scheduled re-shows
				if (dismissTimeoutId) {
					clearTimeout(dismissTimeoutId);
					dismissTimeoutId = null;
				}

				// Show again in 30 minutes with fresh worker reference
				dismissTimeoutId = setTimeout(async () => {
					try {
						// Get fresh registration and worker references
						const currentRegistration = await navigator.serviceWorker.getRegistration();
						const currentWorker = currentRegistration?.waiting || currentRegistration?.installing;

						if (currentWorker && currentRegistration) {
							showUpdateBanner(currentWorker, currentRegistration);
						}
					} catch (error) {
						console.warn("Failed to re-show update banner:", error);
					} finally {
						dismissTimeoutId = null;
					}
				}, 30 * 60 * 1000);
			});

			// Mark that listeners have been bound to prevent duplicates
			banner.dataset.listenersBound = "1";
		}

		// Remove any existing language change listener to prevent duplicates
		if (banner._languageChangeHandler) {
			window.removeEventListener("languagechange", banner._languageChangeHandler);
		}

		// Listen for language changes and update banner text
		const handleLanguageChange = () => {
			if (updateBanner) {
				// Update the banner text elements
				const titleSpan = banner.querySelector("span");
				const updateButton = banner.querySelector("#sw-update-btn");
				const dismissButton = banner.querySelector("#sw-dismiss-btn");

				if (titleSpan) titleSpan.textContent = getBannerTranslation("title");
				if (updateButton)
					updateButton.textContent = getBannerTranslation("updateButton");
				if (dismissButton)
					dismissButton.textContent = getBannerTranslation("dismissButton");
			}
		};

		window.addEventListener("languagechange", handleLanguageChange);

		// Store the cleanup function for later removal
		banner._languageChangeHandler = handleLanguageChange;
	}

	// Hide update banner
	function hideUpdateBanner() {
		if (updateBanner) {
			const bannerEl = document.getElementById("pwa-banner");
			if (bannerEl) {
				bannerEl.style.transform = "translateY(-100%)";
			}

			// Clear any pending re-show timeout
			if (dismissTimeoutId) {
				clearTimeout(dismissTimeoutId);
				dismissTimeoutId = null;
			}

			// Clean up language change listener
			if (updateBanner._languageChangeHandler) {
				window.removeEventListener(
					"languagechange",
					updateBanner._languageChangeHandler,
				);
			}

			// Reset header margin to original with smooth transition
			const nav = document.querySelector("nav");
			if (nav) {
				// Restore original marginTop value with fallback to empty string
				const originalMargin = nav.dataset.originalMarginTop;
				nav.style.marginTop = originalMargin || "";
				if (originalMargin) {
					delete nav.dataset.originalMarginTop;
				}
				nav.style.transition = "margin-top 0.3s ease-in-out";
			}
			setTimeout(() => {
				if (updateBanner?.parentNode) {
					updateBanner.parentNode.removeChild(updateBanner);
				}
				updateBanner = null;
			}, 300);
		}
	}

	// Handle controller change (when SW is updated)
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (refreshing) return;
		refreshing = true;
		hideUpdateBanner();
		window.location.reload();
	});

	// Register service worker
	const registerSW = async () => {
		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			console.log("SW registered successfully");

			// Check if there's already a worker waiting (e.g., updated while page wasn't active)
			if (registration.waiting) {
				showUpdateBanner(registration.waiting, registration);
			}

			// Handle updates immediately when found
			registration.addEventListener("updatefound", () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener("statechange", () => {
					if (
						newWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						// Show update banner instead of confirm dialog
						showUpdateBanner(newWorker, registration);
					}
				});
			});

			// Check for updates every 30 minutes (more frequent than before)
			setInterval(
				async () => {
					try {
						await registration.update();
					} catch (err) {
						console.error("Error checking for SW updates:", err);
					}
				},
				30 * 60 * 1000,
			);
		} catch (err) {
			console.error("SW registration failed:", err);
		}
	};

	// Register when ready
	if (
		document.readyState === "complete" ||
		document.readyState === "interactive"
	) {
		registerSW();
	} else {
		window.addEventListener("load", registerSW);
	}
}
