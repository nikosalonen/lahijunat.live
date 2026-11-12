export interface Station {
	name: string;
	shortCode: string;
	location: {
		latitude: number;
		longitude: number;
	};
}

export interface Train {
	operatorUICCode: string;
	trainCategory: string;
	trainType: string;
	cancelled: boolean;
	commuterLineID: string;
	trainNumber: string;
	timeTableRows: TimeTableRow[];
	// Derived fields (computed in API layer)
	isDeparted?: boolean;
	/** ISO string when train is considered departed (actual or inferred) */
	departedAt?: string;
	/** ISO scheduled time of the train's true first origin, captured before timeTableRows is sliced to the selected station. */
	originDepartureTime?: string;
}

export interface TimeTableRow {
	trainStopping: boolean;
	stationShortCode: string;
	type: string;
	commercialStop: boolean;
	commercialTrack: string;
	cancelled: boolean;
	scheduledTime: string;
	liveEstimateTime?: string;
	actualTime?: string;
	differenceInMinutes?: number;
	unknownDelay?: boolean;
	// The live-trains feed sends stationShortCode only, so this is often absent.
	station?: Station;
}

export type Duration = {
	hours: number;
	minutes: number;
};

/** Build-time facts about one route, from src/data/route-stats.json. */
export interface RouteStats {
	trainsPerDay: number;
	/** Local time, "HH.MM". */
	firstDeparture: string;
	lastDeparture: string;
	medianDuration: number;
	/** Commuter line letters serving the route, e.g. ["I", "P"]. */
	lines: string[];
	/** Each line's median journey time on this route, in minutes. */
	lineDurations: Record<string, number>;
	/**
	 * The typical wait between weekday departures from 07 to 19, in minutes;
	 * null when fewer than two trains leave in that window.
	 */
	daytimeGap: number | null;
}

/** A station's place in HSL's fare system, from src/data/station-info.json. */
export interface StationPlace {
	/** HSL fare zone, e.g. "C"; null for a station outside the HSL area. */
	zone: string | null;
	/** Street address, e.g. "Ratatie 11". */
	address: string | null;
}

/**
 * What ticket a trip needs: the cheapest HSL tickets that cover it (several
 * when they cost the same, e.g. AB or BC), or a VR ticket once either end is
 * outside the HSL area.
 */
export type Ticket = { kind: "hsl"; fares: string[] } | { kind: "outsideHsl" };

/** Build-time facts about departures from one station. */
export interface StationStats {
	/** Stations reachable without changing trains. */
	destinations: number;
	lines: string[];
	firstDeparture: string;
	lastDeparture: string;
}

/** Build-time facts about one commuter line, e.g. I or K. */
export interface LineStats {
	trainsPerDay: number;
	firstDeparture: string;
	lastDeparture: string;
	/** Ends of the run the line makes most often. */
	endpoints: string[];
	/** For a ring line, the far point between identical endpoints. */
	via: string | null;
	/** Every station the line calls at, in the order of its longest run. */
	stations: string[];
	/**
	 * Stops a ring line repeats on its way back to where it started, after
	 * its last new station: for the I train, Pasila then Helsinki. Empty for
	 * a plain line.
	 */
	returnStops: string[];
}
