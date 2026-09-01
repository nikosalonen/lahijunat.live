/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t, tf } from "../utils/translations";

interface Props {
	titleKey: string;
	/** Values for {placeholders} in the title. */
	titleValues?: Record<string, string | number>;
	/** Station codes shown as a route under the title, e.g. a line's ends. */
	subtitleCodes?: string[];
	stations?: Station[];
	introKey?: string;
	introValues?: Record<string, string | number>;
}

/**
 * Heading and lead-in for the station and line pages.
 *
 * A Preact island rather than Astro markup so the copy follows the language
 * switcher; Astro renders it at build time, so crawlers still see the text.
 */
export default function PageHeading({
	titleKey,
	titleValues,
	subtitleCodes,
	stations = [],
	introKey,
	introValues,
}: Props) {
	useLanguageChange();

	const subtitle = subtitleCodes
		?.map((code) => {
			const station = stations.find((s) => s.shortCode === code);
			return station
				? getLocalizedStationName(station.name, station.shortCode)
				: code;
		})
		.join(" – ");

	return (
		<>
			<h1 class="text-2xl sm:text-3xl font-bold mb-2 text-center dark:text-white">
				{titleValues ? tf(titleKey, titleValues) : t(titleKey)}
			</h1>
			{subtitle && (
				<p class="text-base text-center mb-1 dark:text-white">{subtitle}</p>
			)}
			{introKey && (
				<p class="text-sm text-center opacity-70 mb-6 dark:text-white">
					{introValues ? tf(introKey, introValues) : t(introKey)}
				</p>
			)}
		</>
	);
}
