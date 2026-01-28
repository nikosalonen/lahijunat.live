/** @format */

/**
 * Configuration for the feature announcement banner.
 *
 * To show the announcement for a new release:
 * 1. Set `enabled: true`
 * 2. Update `version` to match the release version
 * 3. Update `features` array with the new features to announce
 *
 * To disable the announcement, set `enabled: false`
 */
export const featureAnnouncementConfig = {
	/** Set to false to disable the announcement entirely */
	enabled: true,

	/**
	 * Version string used to track if user has seen this announcement.
	 * Change this when you want to show the announcement again.
	 * Typically synced with package.json version.
	 */
	version: "1.13.0",

	/** Delay in ms before showing the announcement (to avoid layout shift) */
	showDelay: 500,

	/**
	 * Features to announce. Each feature has:
	 * - icon: emoji or "svg:iconName" for built-in SVG icons (currently: "lightning")
	 * - translationKey: key from translations.ts for the feature description
	 */
	features: [
		{ icon: "🇸🇪", translationKey: "newFeaturesSwedish" },
		{ icon: "svg:lightning", translationKey: "newFeaturesHideSlowTrains" },
	] as Array<{ icon: string; translationKey: string }>,
};

export type FeatureConfig = { icon: string; translationKey: string };
