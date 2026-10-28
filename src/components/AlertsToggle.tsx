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
		getAlertsPreference() !== "off" && Notification.permission === "granted"
	);
}

/** Header button that turns train alerts on or off for this device. */
export default function AlertsToggle() {
	// Support can only be checked in the browser, so wait for mount to avoid a
	// server/client mismatch.
	const [available, setAvailable] = useState(false);
	const [isOn, setIsOn] = useState(false);
	// A second tap while the first is still talking to the server could turn
	// alerts back on before the device is unsubscribed, so wait for it.
	const [busy, setBusy] = useState(false);
	useLanguageChange();

	useEffect(() => {
		if (isAlertsFeatureEnabled() && getPushSupport() === "supported") {
			setAvailable(true);
			setIsOn(readIsOn());
		}
		// Alerts can change elsewhere, for example in the first-favorite prompt.
		const syncState = () => setIsOn(readIsOn());
		window.addEventListener(ALERTS_STATE_EVENT, syncState);
		return () => window.removeEventListener(ALERTS_STATE_EVENT, syncState);
	}, []);

	if (!available) return null;

	const handleClick = async () => {
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
