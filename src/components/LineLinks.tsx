/** @format */

import { useLanguageChange } from "../hooks/useLanguageChange";
import type { LineStats, Station } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t } from "../utils/translations";

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
		<ul class="flex flex-col gap-3">
			{lines.map(({ line, stats }) => {
				const isRing = stats.endpoints[0] === stats.endpoints[1];
				const route = [
					stationName(stats.endpoints[0]),
					...(stats.via ? [stationName(stats.via)] : []),
					stationName(stats.endpoints[1]),
				].join(" – ");
				return (
					<li key={line}>
						<a
							href={`/linja/${line.toLowerCase()}/`}
							class="flex items-center gap-4 p-4 rounded-2xl border border-base-300 hover:border-primary/40 hover:bg-base-200 transition-colors"
						>
							{/* The same badge the train cards wear, so a line looks alike everywhere */}
							<span class="flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl bg-primary text-primary-content text-xl font-bold shadow-brand-soft">
								{line}
							</span>
							<span class="text-base leading-snug dark:text-white">
								{route}
								{isRing && (
									<>
										<svg
											aria-hidden="true"
											class="inline-block w-4 h-4 ml-1.5 -mt-0.5 text-primary"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M20 12a8 8 0 1 1-2.3-5.7" />
											<path d="M20 4v4h-4" />
										</svg>
										<span class="sr-only"> ({t("ringLine")})</span>
									</>
								)}
							</span>
						</a>
					</li>
				);
			})}
			<li class="text-sm text-center mt-4">
				<a href="/" class="link link-hover">
					{t("homePage")}
				</a>
			</li>
		</ul>
	);
}
