// Service Worker registration and update handling
if ("serviceWorker" in navigator) {
  let refreshing = false;
  let updateBanner = null;

  // Create update notification banner
  function createUpdateBanner() {
    if (updateBanner) return updateBanner;

    updateBanner = document.createElement('div');
    updateBanner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #8c4799;
        color: white;
        padding: 12px 16px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transform: translateY(-100%);
        transition: transform 0.3s ease-in-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      ">
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <span>🚀 Uusi versio sovelluksesta on saatavilla!</span>
          <div style="display: flex; gap: 8px;">
            <button id="sw-update-btn" style="
              background: rgba(255,255,255,0.2);
              border: 1px solid rgba(255,255,255,0.3);
              color: white;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              Päivitä nyt
            </button>
            <button id="sw-dismiss-btn" style="
              background: transparent;
              border: 1px solid rgba(255,255,255,0.3);
              color: white;
              padding: 6px 12px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
              Myöhemmin
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(updateBanner);

    // Animate in
    setTimeout(() => {
      updateBanner.firstElementChild.style.transform = 'translateY(0)';
    }, 100);

    return updateBanner;
  }

  // Show update banner
  function showUpdateBanner(newWorker) {
    const banner = createUpdateBanner();
    const updateBtn = banner.querySelector('#sw-update-btn');
    const dismissBtn = banner.querySelector('#sw-dismiss-btn');

    updateBtn.addEventListener('click', () => {
      newWorker.postMessage({ type: "SKIP_WAITING" });
      hideUpdateBanner();
    });

    dismissBtn.addEventListener('click', () => {
      hideUpdateBanner();
      // Show again in 30 minutes
      setTimeout(() => showUpdateBanner(newWorker), 30 * 60 * 1000);
    });
  }

  // Hide update banner
  function hideUpdateBanner() {
    if (updateBanner) {
      const bannerEl = updateBanner.firstElementChild;
      bannerEl.style.transform = 'translateY(-100%)';
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
            showUpdateBanner(newWorker);
          }
        });
      });

      // Check for updates every 30 minutes (more frequent than before)
      setInterval(async () => {
        try {
          await registration.update();
        } catch (err) {
          console.error("Error checking for SW updates:", err);
        }
      }, 30 * 60 * 1000);

    } catch (err) {
      console.error("SW registration failed:", err);
    }
  };

  // Register when ready
  if (document.readyState === "complete" || document.readyState === "interactive") {
    registerSW();
  } else {
    window.addEventListener("load", registerSW);
  }
}
