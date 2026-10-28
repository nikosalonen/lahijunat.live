/** @format */

import { useEffect, useRef, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import {
	ALERT_OPT_IN_EVENT,
	type AlertTarget,
	enableAlerts,
	resyncAlerts,
	snoozeOptIn,
	subscribeTrainAlerts,
} from "../utils/pushAlerts";
import { t } from "../utils/translations";

interface OptIn {
	target: AlertTarget;
	removeAfter: string;
}

/**
 * Asks once, after the first favorite, whether the user wants alerts, and
 * re-registers favorites with the server when the app starts.
 */
export default function PushAlerts() {
	const [optIn, setOptIn] = useState<OptIn | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	useLanguageChange();

	useEffect(() => {
		void resyncAlerts();
		const handleOptIn = (event: Event) => {
			setOptIn((event as CustomEvent<OptIn>).detail);
		};
		window.addEventListener(ALERT_OPT_IN_EVENT, handleOptIn);
		return () => window.removeEventListener(ALERT_OPT_IN_EVENT, handleOptIn);
	}, []);

	// Move focus into the dialog when it opens.
	useEffect(() => {
		if (optIn) dialogRef.current?.focus();
	}, [optIn]);

	if (!optIn) return null;

	const close = () => setOptIn(null);

	const handleYes = async () => {
		const { target, removeAfter } = optIn;
		close();
		const result = await enableAlerts();
		if (result !== "granted") return;
		const subscribed = await subscribeTrainAlerts(target, removeAfter);
		// Favorites saved before alerts were on need registering too. Skip it
		// when the server is full or down, since each try would fail the same way.
		if (subscribed === "ok") await resyncAlerts();
	};

	const handleNotNow = () => {
		snoozeOptIn();
		close();
	};

	return (
		<div
			className="modal modal-open"
			role="dialog"
			aria-modal="true"
			aria-labelledby="alerts-prompt-title"
			ref={dialogRef}
			tabIndex={-1}
			onKeyDown={(event) => {
				if (event.key === "Escape") handleNotNow();
			}}
		>
			<div className="modal-box max-w-sm">
				<h3 id="alerts-prompt-title" className="font-bold text-lg mb-2">
					{t("alertsPromptTitle")}
				</h3>
				<p className="text-sm mb-2">{t("alertsPromptBody")}</p>
				<p className="text-xs text-base-content/70 mb-4">
					{t("alertsPromptPrivacy")}
				</p>
				<div className="flex flex-col gap-2">
					<button type="button" onClick={handleYes} className="btn btn-primary">
						{t("alertsPromptYes")}
					</button>
					<button
						type="button"
						onClick={handleNotNow}
						className="btn btn-ghost"
					>
						{t("alertsPromptNotNow")}
					</button>
				</div>
			</div>
		</div>
	);
}
