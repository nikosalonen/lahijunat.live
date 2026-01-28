/** @format */

import { useEffect, useState } from "preact/hooks";
import {
	type FeatureConfig,
	featureAnnouncementConfig,
} from "../config/featureAnnouncement";
import { useLanguageChange } from "../hooks/useLanguageChange";
import { hapticLight } from "../utils/haptics";
import { t } from "../utils/translations";

const STORAGE_KEY_PREFIX = "featureAnnouncement_";

function FeatureIcon({ icon }: { icon: string }) {
	// Handle SVG icons
	if (icon === "svg:lightning") {
		return (
			<svg
				className="w-4 h-4 flex-shrink-0"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
			</svg>
		);
	}

	// Default: emoji or text
	return <span aria-hidden="true">{icon}</span>;
}

function FeatureItem({ feature }: { feature: FeatureConfig }) {
	return (
		<li className="flex items-center gap-2">
			<FeatureIcon icon={feature.icon} />
			<span>{t(feature.translationKey)}</span>
		</li>
	);
}

export default function FeatureAnnouncement() {
	const [isVisible, setIsVisible] = useState(false);
	useLanguageChange();

	const { enabled, version, showDelay, features } = featureAnnouncementConfig;
	const storageKey = `${STORAGE_KEY_PREFIX}${version}`;

	useEffect(() => {
		// Don't show if disabled in config
		if (!enabled || features.length === 0) {
			return;
		}

		try {
			const dismissed = localStorage.getItem(storageKey);
			if (!dismissed) {
				const timer = setTimeout(() => setIsVisible(true), showDelay);
				return () => clearTimeout(timer);
			}
		} catch {
			// Ignore localStorage errors
		}
	}, [enabled, storageKey, showDelay, features.length]);

	const handleDismiss = () => {
		hapticLight();
		setIsVisible(false);
		try {
			localStorage.setItem(storageKey, "true");
		} catch {
			// Ignore localStorage errors
		}
	};

	if (!isVisible) return null;

	return (
		<output
			aria-live="polite"
			className="fixed left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[1000] animate-slide-up block"
			style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
		>
			<div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-xl p-4 border border-purple-400/30">
				<div className="flex items-start gap-3">
					<span className="text-2xl flex-shrink-0" aria-hidden="true">
						✨
					</span>
					<div className="flex-grow min-w-0">
						<h3 className="font-bold text-base mb-2">
							{t("newFeaturesTitle")}
						</h3>
						<ul className="text-sm text-purple-100 space-y-1 mb-3">
							{features.map((feature) => (
								<FeatureItem key={feature.translationKey} feature={feature} />
							))}
						</ul>
						<button
							type="button"
							onClick={handleDismiss}
							className="btn btn-sm bg-white/20 hover:bg-white/30 border-white/30 hover:border-white/50 text-white font-medium transition-all"
						>
							{t("newFeaturesDismiss")}
						</button>
					</div>
					<button
						type="button"
						onClick={handleDismiss}
						className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
						aria-label={t("dismiss")}
					>
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>
		</output>
	);
}
