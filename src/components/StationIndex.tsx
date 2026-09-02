/** @format */

import { useEffect, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { Station } from "../types";
import { getCurrentLanguage } from "../utils/language";
import { getLocalizedStationName } from "../utils/stationNames";
import { buildRoutePath } from "../utils/stationRoute";
import { t, tf } from "../utils/translations";

interface Props {
	stations: Station[];
	/** Commuter line letters serving each station, by short code. */
	lines: Record<string, string[]>;
	/** Short codes set in bold: the stations most readers are after. */
	popular: readonly string[];
}

interface Entry {
	code: string;
	href: string;
	label: string;
	finnishName: string;
	lines: string[];
	popular: boolean;
}

/**
 * The alphabetical index of every station, with a filter box, a header per
 * initial letter and the lines that call at each station.
 *
 * Names, sort order and letters follow the active language: Leppävaara sits
 * under L in Finnish and, as Alberga, under A in Swedish. The filter matches
 * the Finnish name too, so "Helsinki" still finds Helsingfors.
 *
 * The first client render repeats the server's Finnish output so hydration
 * finds the DOM it expects; the reader's language is applied right after.
 */
export default function StationIndex({ stations, lines, popular }: Props) {
	useLanguageChange();
	const [query, setQuery] = useState("");
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	const lang = hydrated ? getCurrentLanguage() : "fi";
	const popularSet = new Set(popular);
	const needle = query.trim().toLocaleLowerCase(lang);

	const matches = (entry: Entry) =>
		needle === "" ||
		entry.label.toLocaleLowerCase(lang).includes(needle) ||
		entry.finnishName.toLocaleLowerCase(lang).includes(needle);

	const entries = stations
		.map(
			(station): Entry => ({
				code: station.shortCode,
				href: buildRoutePath(station.shortCode, null),
				label: hydrated
					? getLocalizedStationName(station.name, station.shortCode)
					: station.name,
				finnishName: station.name,
				lines: lines[station.shortCode] ?? [],
				popular: popularSet.has(station.shortCode),
			}),
		)
		.filter(matches)
		.sort((a, b) => a.label.localeCompare(b.label, lang));

	const groups: { letter: string; entries: Entry[] }[] = [];
	for (const entry of entries) {
		const letter = entry.label.charAt(0).toLocaleUpperCase(lang);
		const last = groups.at(-1);
		if (last && last.letter === letter) {
			last.entries.push(entry);
		} else {
			groups.push({ letter, entries: [entry] });
		}
	}

	return (
		<div class="dark:text-white">
			<label class="input w-full max-w-sm mx-auto flex items-center gap-2 mb-6">
				<svg
					aria-hidden="true"
					class="w-4 h-4 opacity-60 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
				>
					<circle cx="11" cy="11" r="7" />
					<path d="m20 20-3.5-3.5" />
				</svg>
				<input
					type="search"
					class="grow"
					placeholder={t("filterStations")}
					aria-label={t("filterStations")}
					value={query}
					onInput={(event) =>
						setQuery((event.currentTarget as HTMLInputElement).value)
					}
				/>
			</label>

			{groups.length === 0 ? (
				<p class="text-center opacity-70 py-8">{t("noStationsFound")}</p>
			) : (
				// Columns fill top to bottom, so the alphabet still reads down the page
				<div class="sm:columns-2 gap-x-10">
					{groups.map((group) => (
						<section key={group.letter} class="break-inside-avoid mb-6">
							<h2 class="text-sm font-bold text-primary border-b-2 border-primary/30 pb-1 mb-1">
								{group.letter}
							</h2>
							<ul class="divide-y divide-base-300">
								{group.entries.map((entry) => (
									<li
										key={entry.code}
										class="flex items-center justify-between gap-3 py-2.5"
									>
										<a
											href={entry.href}
											class={`link link-hover underline-offset-2 text-base leading-snug ${
												entry.popular ? "font-bold" : ""
											}`}
										>
											{entry.label}
										</a>
										{entry.lines.length > 0 && (
											<span class="flex flex-wrap justify-end gap-1 shrink-0">
												{entry.lines.map((line) => (
													<a
														key={line}
														href={`/linja/${line.toLowerCase()}/`}
														aria-label={tf("lineHeading", { line })}
														class="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-primary text-primary-content text-xs font-bold hover:opacity-80 transition-opacity"
													>
														{line}
													</a>
												))}
											</span>
										)}
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	);
}
