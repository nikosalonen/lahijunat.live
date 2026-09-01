/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { LineStats, Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t, tf } from "../utils/translations";

interface Props {
	stations: Station[];
	lines: { line: string; stats: LineStats }[];
}

/** The index of commuter lines, each labelled with the route it runs. */
export default function LineLinks({ stations, lines }: Props) {
	useLanguageChange();

	const stationName = (shortCode: string): string => {
		const station = stations.find((s) => s.shortCode === shortCode);
		return station
			? getLocalizedStationName(station.name, station.shortCode)
			: shortCode;
	};

	return (
		<ul class="flex flex-col gap-2">
			{lines.map(({ line, stats }) => (
				<li key={line}>
					<a
						href={`/linja/${line.toLowerCase()}/`}
						class="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:border-base-400 hover:bg-base-200 transition-colors"
					>
						<span class="font-mono font-bold text-lg w-8 text-center shrink-0">
							{line}
						</span>
						<span class="text-sm dark:text-white">
							{[
								stationName(stats.endpoints[0]),
								...(stats.via ? [stationName(stats.via)] : []),
								stationName(stats.endpoints[1]),
							].join(" – ")}
							<span class="opacity-60">
								{" · "}
								{tf("stationCount", { count: stats.stations.length })}
							</span>
						</span>
					</a>
				</li>
			))}
			<li class="text-sm text-center mt-4">
				<a href="/" class="link link-hover">
					{t("homePage")}
				</a>
			</li>
		</ul>
	);
}
