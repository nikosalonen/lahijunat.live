/** @format */

import { useEffect, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import {
	ALERTS_STATE_EVENT,
	disableAllAlerts,
	enableAlerts,
	getAlertsPreference,
	getPushSupport,
	isAlertsFeatureEnabled,
	resyncAlerts,
} from "../utils/pushAlerts";
import { showToast } from "../utils/toast";
import { t } from "../utils/translations";

function readIsOn(): boolean {
	return (
		// iPhone Safari has no Notification outside a Home Screen app
		typeof Notification !== "undefined" &&
		getAlertsPreference() !== "off" &&
		Notification.permission === "granted"
	);
}

/**
 * Header button that turns train alerts on or off for this device.
 *
 * On an iPhone the button also shows in a Safari tab, where push does not
 * work yet. Hiding it there would hide the feature from most phone users, so
 * a tap explains that the app must be added to the Home Screen first.
 */
export default function AlertsToggle() {
	// Support can only be checked in the browser, so wait for mount to avoid a
	// server/client mismatch.
	const [available, setAvailable] = useState(false);
	const [needsHomeScreen, setNeedsHomeScreen] = useState(false);
	const [isOn, setIsOn] = useState(false);
	// A second tap while the first is still talking to the server could turn
	// alerts back on before the device is unsubscribed, so wait for it.
	const [busy, setBusy] = useState(false);
	useLanguageChange();

	useEffect(() => {
		if (isAlertsFeatureEnabled()) {
			const support = getPushSupport();
			if (support === "supported") {
				setAvailable(true);
				setIsOn(readIsOn());
			} else if (support === "needs-home-screen") {
				setAvailable(true);
				setNeedsHomeScreen(true);
			}
		}
		// Alerts can change elsewhere, for example in the first-favorite prompt.
		const syncState = () => setIsOn(readIsOn());
		window.addEventListener(ALERTS_STATE_EVENT, syncState);
		return () => window.removeEventListener(ALERTS_STATE_EVENT, syncState);
	}, []);

	if (!available) return null;

	const handleClick = async () => {
		if (needsHomeScreen) {
			showToast(t("alertsHomeScreenHint"), "info");
			return;
		}
		if (busy) return;
		setBusy(true);
		try {
			if (isOn) {
				setIsOn(false);
				await disableAllAlerts();
				return;
			}
			const result = await enableAlerts();
			if (result === "granted") {
				setIsOn(true);
				await resyncAlerts();
			} else if (result === "denied") {
				showToast(t("alertsBlocked"), "warning");
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={busy}
			aria-pressed={isOn}
			aria-label={isOn ? t("alertsToggleOn") : t("alertsToggleOff")}
			className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:bg-white/20 cursor-pointer transition-colors"
		>
			<svg
				className="w-5 h-5 sm:w-6 sm:h-6"
				viewBox="0 0 24 24"
				fill={isOn ? "currentColor" : "none"}
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
				<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
				{!isOn && <line x1="3" y1="3" x2="21" y2="21" />}
			</svg>
		</button>
	);
}
