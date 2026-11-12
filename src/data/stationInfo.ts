/** @format */

import type { StationPlace, Ticket } from "../types";
import stationInfoData from "./station-info.json";

/**
 * Server-only lookup into HSL's zones, addresses and tickets.
 *
 * Import this from Astro page frontmatter, like routeStats.ts, and pass the
 * one station's or trip's answer to the island as a prop.
 */

const stations = stationInfoData.stations as Record<string, StationPlace>;
const fares = stationInfoData.fares as {
	id: string;
	price: number;
	zones: string[];
}[];

/** A station's HSL zone and address, or null for one HSL does not list. */
export const getStationPlace = (
	shortCode: string | null,
): StationPlace | null => (shortCode ? (stations[shortCode] ?? null) : null);

/** Every zone letter from `low` to `high`, e.g. A..C -> A, B, C. */
const zoneRange = (low: string, high: string): string[] =>
	Array.from({ length: high.charCodeAt(0) - low.charCodeAt(0) + 1 }, (_, i) =>
		String.fromCharCode(low.charCodeAt(0) + i),
	);

/**
 * The ticket a trip between two stations needs.
 *
 * HSL's zones are rings from A in central Helsinki outwards, so a rail trip
 * crosses every zone between its two ends and needs a ticket covering all of
 * them. Of the tickets that do, the cheapest wins; HSL sells no single-zone
 * ticket for A, B or C, so a trip inside B is "AB or BC". A station HSL does
 * not list, or lists without a zone, is outside the area: a VR ticket then.
 */
export const getTicket = (
	from: string | null,
	to: string | null,
): Ticket | null => {
	if (!from || !to) return null;
	const fromZone = stations[from]?.zone;
	const toZone = stations[to]?.zone;
	if (!fromZone || !toZone) return { kind: "outsideHsl" };

	const [low, high] = [fromZone, toZone].sort();
	const needed = zoneRange(low, high);
	const covering = fares.filter((fare) =>
		needed.every((zone) => fare.zones.includes(zone)),
	);
	if (covering.length === 0) return { kind: "outsideHsl" };

	const cheapest = Math.min(...covering.map((fare) => fare.price));
	return {
		kind: "hsl",
		fares: covering
			.filter((fare) => fare.price === cheapest)
			.map((fare) => fare.id)
			.sort(),
	};
};
