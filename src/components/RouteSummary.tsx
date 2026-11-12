/** @format */

import type { ComponentChildren } from "preact";
import { useLanguageChange } from "../hooks/useLanguageChange";
import type { RouteStats, Station, StationStats, Ticket } from "../types";
import { getLocalizedStationName } from "../utils/stationNames";
import { t, tf } from "../utils/translations";
import LineBadge from "./LineBadge";

interface Props {
	/**
	 * The station this page is about: a route page's departure station, or the
	 * single station of a station page.
	 */
	from: Station;
	/** The destination, on a route page. */
	to?: Station;
	/** Facts about the pair, when a direct train runs it. */
	route?: RouteStats | null;
	/** Facts about departures from `from`, on a station page. */
	station?: StationStats | null;
	/** The ticket the trip needs, on a route page. */
	ticket?: Ticket | null;
	/** The HSL zone of `from`, on a station page; null outside the HSL area. */
	zone?: string | null;
}

/**
 * Lines whose journey times differ by at most this many minutes share a row,
 * so "D, R, Z: 14 min" is one row rather than three.
 */
const SAME_DURATION_MINUTES = 2;

/**
 * Daytime gaps at or above this are worth stating. In the Helsinki region a
 * train leaves every few minutes and saying so tells nobody anything; on
 * rural routes the gap is 30 minutes or more and decides when to leave home.
 */
const RURAL_GAP_MINUTES = 30;

/** Lines grouped by journey time, fastest first. */
const durationGroups = (
	lineDurations: Record<string, number>,
): { lines: string[]; min: number; max: number }[] => {
	const sorted = Object.entries(lineDurations).sort(
		([lineA, a], [lineB, b]) => a - b || lineA.localeCompare(lineB),
	);
	const groups: { lines: string[]; min: number; max: number }[] = [];
	for (const [line, minutes] of sorted) {
		const group = groups.at(-1);
		if (group && minutes - group.min <= SAME_DURATION_MINUTES) {
			group.lines.push(line);
			group.max = minutes;
		} else {
			groups.push({ lines: [line], min: minutes, max: minutes });
		}
	}
	for (const group of groups) group.lines.sort();
	return groups;
};

const formatGap = (minutes: number): string => {
	if (minutes === 60) return t("everyHour");
	if (minutes > 60 && minutes % 60 === 0) {
		return tf("everyHours", { hours: minutes / 60 });
	}
	return tf("everyMinutes", { minutes });
};

const formatTicket = (ticket: Ticket): string =>
	ticket.kind === "hsl"
		? `HSL ${ticket.fares.join(` ${t("ticketOr")} `)}`
		: t("outsideHslTicket");

const Fact = ({
	label,
	children,
}: {
	label: string;
	children: ComponentChildren;
}) => (
	<>
		<dt class="opacity-70">{label}</dt>
		<dd>{children}</dd>
	</>
);

/**
 * The facts a traveller acts on: which line gets there fastest, which ticket
 * to buy, and on rural routes how long the wait between trains is.
 *
 * Also what a crawler reads about the page without running JavaScript: the
 * live train list is fetched client-side, and every page's facts here are its
 * own. Rendered inside RouteInfo's panel, which StationManager prerenders;
 * the panel starts closed but stays in the HTML.
 */
export default function RouteSummary({
	from,
	to,
	route,
	station,
	ticket,
	zone,
}: Props) {
	useLanguageChange();

	const fromName = getLocalizedStationName(from.name, from.shortCode);

	// A route page describes the pair; a station page describes the station.
	// An unserved pair has no figures of its own and gets nothing.
	let heading: string;
	let facts: ComponentChildren;

	if (to && route) {
		heading = tf("routeSummaryHeading", {
			from: fromName,
			to: getLocalizedStationName(to.name, to.shortCode),
		});
		const groups = durationGroups(route.lineDurations);
		facts = (
			<>
				{groups.length > 0 && (
					<Fact label={t("travelTime")}>
						<ul class="flex flex-col gap-1.5">
							{groups.map((group) => (
								<li key={group.lines.join()} class="flex items-center gap-2">
									<span class="flex flex-wrap gap-1">
										{group.lines.map((line) => (
											<LineBadge key={line} line={line} />
										))}
									</span>
									<span class="whitespace-nowrap">
										{group.min === group.max
											? group.min
											: `${group.min}–${group.max}`}{" "}
										min
									</span>
								</li>
							))}
						</ul>
					</Fact>
				)}
				{ticket && <Fact label={t("ticket")}>{formatTicket(ticket)}</Fact>}
				{route.daytimeGap !== null && route.daytimeGap >= RURAL_GAP_MINUTES && (
					<Fact label={t("weekdayFrequency")}>
						{formatGap(route.daytimeGap)}
					</Fact>
				)}
			</>
		);
	} else if (station) {
		heading = tf("stationSummaryHeading", { station: fromName });
		facts = (
			<Fact label={t("fareZone")}>
				{zone ? `HSL ${zone}` : t("outsideHslZone")}
			</Fact>
		);
	} else {
		return null;
	}

	return (
		<div>
			<h2 class="text-sm font-semibold mb-2 dark:text-white">{heading}</h2>
			<dl class="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm dark:text-white">
				{facts}
			</dl>
		</div>
	);
}
