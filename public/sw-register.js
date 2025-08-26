// Service Worker registration and update handling
if ("serviceWorker" in navigator) {
	let refreshing = false;
	let updateBanner = null;

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

		updateBanner = document.createElement("div");
		updateBanner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        padding: 12px 16px;
        text-align: center;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3), 0 2px 4px rgba(0,0,0,0.15);
        transform: translateY(-100%);
        transition: transform 0.3s ease-in-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        border-bottom: 3px solid #10b981;
      ">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <span>${getBannerTranslation("title")}</span>
          <div style="display: flex; gap: 8px;">
            <button id="sw-update-btn" style="
              background: rgba(255,255,255,0.9);
              border: 1px solid rgba(255,255,255,1);
              color: #047857;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 600;
              transition: all 0.2s;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            " onmouseover="this.style.background='rgba(255,255,255,1)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'">
${getBannerTranslation("updateButton")}
            </button>
            <button id="sw-dismiss-btn" style="
              background: transparent;
              border: 1px solid rgba(255,255,255,0.6);
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.borderColor='rgba(255,255,255,0.8)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='transparent'; this.style.borderColor='rgba(255,255,255,0.6)'; this.style.transform='translateY(0)'">
${getBannerTranslation("dismissButton")}
            </button>
          </div>
        </div>
      </div>
    `;

		document.body.appendChild(updateBanner);

		// Animate in and adjust body padding
		setTimeout(() => {
			updateBanner.firstElementChild.style.transform = "translateY(0)";
			// Push content down to avoid overlap with header
			document.body.style.paddingTop = "calc(env(safe-area-inset-top) + 60px)";
		}, 100);

		return updateBanner;
	}

	// Show update banner
	function showUpdateBanner(newWorker, registration) {
		const banner = createUpdateBanner();
		const updateBtn = banner.querySelector("#sw-update-btn");
		const dismissBtn = banner.querySelector("#sw-dismiss-btn");

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
			// Show again in 30 minutes
			setTimeout(
				() => showUpdateBanner(newWorker, registration),
				30 * 60 * 1000,
			);
		});

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
			const bannerEl = updateBanner.firstElementChild;
			bannerEl.style.transform = "translateY(-100%)";

			// Clean up language change listener
			if (updateBanner._languageChangeHandler) {
				window.removeEventListener(
					"languagechange",
					updateBanner._languageChangeHandler,
				);
			}

			// Reset body padding to original
			document.body.style.paddingTop = "env(safe-area-inset-top)";
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
