/** @format */

import { useEffect, useState } from "preact/hooks";

const DEBUG_KEY = "traincard-debug";

export function getDebugMode(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem(DEBUG_KEY) === "true";
}

export function subscribeToDebugMode(callback: (enabled: boolean) => void) {
	const handler = (e: Event) => {
		const customEvent = e as CustomEvent<boolean>;
		callback(customEvent.detail);
	};
	window.addEventListener("debugModeChange", handler);
	return () => window.removeEventListener("debugModeChange", handler);
}

export default function DebugToggle() {
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		setEnabled(getDebugMode());
	}, []);

	const toggle = () => {
		const newValue = !enabled;
		setEnabled(newValue);
		localStorage.setItem(DEBUG_KEY, String(newValue));
		window.dispatchEvent(
			new CustomEvent("debugModeChange", { detail: newValue }),
		);
	};

	// Only show in dev mode
	if (!import.meta.env.DEV) return null;

	return (
		<button
			type="button"
			onClick={toggle}
			class={`text-xs px-2 py-1 rounded transition-colors ${
				enabled
					? "bg-yellow-500 text-black"
					: "bg-white/20 text-white/60 hover:bg-white/30"
			}`}
			title="Toggle debug mode"
		>
			DBG
		</button>
	);
}
