/** @format */

// Import version from package.json to keep announcement version in sync
import packageJson from "../../package.json";

/**
 * Extract base semver version (major.minor.patch) without prerelease suffix.
 * e.g., "1.13.0-beta.1" → "1.13.0"
 */
function getBaseVersion(version: string): string {
	const match = version.match(/^(\d+\.\d+\.\d+)/);
	return match ? match[1] : version;
}

/**
 * Configuration for the feature announcement banner.
 *
 * To show the announcement for a new release:
 * 1. Set `enabled: true`
 * 2. Update `features` array with the new features to announce
 *
 * The version is automatically synced from package.json (base semver only).
 * To disable the announcement, set `enabled: false`
 */
export const featureAnnouncementConfig = {
	/** Set to false to disable the announcement entirely */
	enabled: true,

	/**
	 * Version string used to track if user has seen this announcement.
	 * Automatically derived from package.json base version (without prerelease suffix).
	 * e.g., "1.13.0-beta.1" and "1.13.0" both use "1.13.0" so users see announcement once.
	 */
	version: getBaseVersion(packageJson.version),

	/** Delay in ms before showing the announcement (to avoid layout shift) */
	showDelay: 500,

	/**
	 * Features to announce. Each feature has:
	 * - icon: emoji or "svg:iconName" for built-in SVG icons (currently: "lightning")
	 * - translationKey: key from translations.ts for the feature description
	 */
	features: [
		{ icon: "✨", translationKey: "newFeaturesImprovedCardDesign" },
		{ icon: "💫", translationKey: "newFeaturesSmoothAnimations" },
	] as Array<{ icon: string; translationKey: string }>,
};

export type FeatureConfig = { icon: string; translationKey: string };
