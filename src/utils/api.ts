import type { Station, TimeTableRow, Train } from "../types";

const BASE_URL = "https://rata.digitraffic.fi/api";
const ENDPOINTS = {
	GRAPHQL: `${BASE_URL}/v2/graphql/graphql`,
	STATIONS: `${BASE_URL}/v1/metadata/stations`,
	LIVE_TRAINS: `${BASE_URL}/v1/live-trains/station`,
} as const;

const DEFAULT_HEADERS = {
	"Content-Type": "application/json",
	"Accept-Encoding": "gzip",
} as const;

interface GraphQLStation {
	name: string;
	shortCode: string;
	location: [number, number];
}

// Add caching utilities only for stations
const STATION_CACHE_DURATION = 60 * 60 * 1000; // 1 hour since stations rarely change
const stationCache = new Map<string, { data: Station[]; timestamp: number }>();

function getCachedStations(): Station[] | null {
	const cached = stationCache.get("stations");
	if (!cached) return null;

	if (Date.now() - cached.timestamp > STATION_CACHE_DURATION) {
		stationCache.delete("stations");
		return null;
	}

	return cached.data;
}

// Improved fetchStations with caching
export async function fetchStations(): Promise<Station[]> {
	const cached = getCachedStations();
	if (cached) return cached;

	try {
		const query = `{
			stations(where:{passengerTraffic: {equals: true}}){
				name
				shortCode
				location
			}
		}`;

		const response = await fetch(ENDPOINTS.GRAPHQL, {
			method: "POST",
			headers: DEFAULT_HEADERS,
			body: JSON.stringify({ query }),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch stations: ${response.statusText}`);
		}

		const { data } = await response.json();
		const stations = data.stations.map((station: GraphQLStation) => ({
			...station,
			location: {
				longitude: station.location[0],
				latitude: station.location[1],
			},
		}));

		stationCache.set("stations", { data: stations, timestamp: Date.now() });
		return stations;
	} catch (error) {
		console.error("Error fetching stations:", error);
		throw error;
	}
}

export async function fetchTrainsLeavingFromStation(
	stationCode: string,
): Promise<Station[]> {
	const response = await fetch(
		`${ENDPOINTS.LIVE_TRAINS}/${stationCode}?arrived_trains=100&arriving_trains=100&departed_trains=100&departing_trains=100&include_nonstopping=false&train_categories=Commuter`,
		{ headers: DEFAULT_HEADERS },
	);
	if (!response.ok) {
		throw new Error("Failed to fetch station");
	}
	const data = await response.json();
	// Filter trains that have the destination station in their timetable
	const shortCodes = [
		...new Set(
			data.flatMap((train: Train) =>
				train.timeTableRows
					.filter(
						(row: TimeTableRow) => row.commercialStop && row.trainStopping,
					)
					.map((row: TimeTableRow) => row.stationShortCode),
			),
		),
	];

	interface RESTStation {
		stationShortCode: string;
		name: string;
		passengerTraffic: boolean;
		type: string;
		stationName: string;
		stationUICCode: number;
		countryCode: string;
		longitude: number;
		latitude: number;
	}
	const stations = await fetch(ENDPOINTS.STATIONS);
	const stationsData = await stations.json();

	const filteredStations = stationsData.filter(
		(station: RESTStation) =>
			shortCodes.includes(station.stationShortCode) && station.passengerTraffic,
	);
	return filteredStations.map(
		(station: RESTStation): Station => ({
			name: station.stationName,
			shortCode: station.stationShortCode,
			location: {
				latitude: station.latitude,
				longitude: station.longitude,
			},
		}),
	);
}

// Fetch trains without caching for real-time data
export async function fetchTrains(
	stationCode = "HKI",
	destinationCode = "TKL",
): Promise<Train[]> {
	try {
		const params = new URLSearchParams({
			limit: "100",
			startDate: new Date().toISOString(),
			endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		});

		const url = `${ENDPOINTS.LIVE_TRAINS}/${stationCode}/${destinationCode}?${params}`;
		const response = await fetch(url, {
			headers: DEFAULT_HEADERS,
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch trains: ${response.statusText}`);
		}

		const data = await response.json();
		return processTrainData(data, stationCode, destinationCode);
	} catch (error) {
		console.error("Error fetching trains:", error);
		throw error;
	}
}

// Separate data processing logic for better maintainability
function processTrainData(
	data: Train[],
	stationCode: string,
	destinationCode: string,
): Train[] {
	return data
		.filter((train) => {
			if (train.trainCategory !== "Commuter") return false;
			return isValidJourney(train, stationCode, destinationCode);
		})
		.filter((train) => {
			if (stationCode === "PSL" && destinationCode === "HKI") {
				return isPSLtoHKI(train);
			}
			return true;
		})
		.sort((a, b) => sortByDepartureTime(a, b, stationCode));
}

function isPSLtoHKI(train: Train): boolean {
	// Filter timeTableRows to only include last PSL departure and HKI arrival
	const pslDepartures = train.timeTableRows.filter(
		(row) => row.stationShortCode === "PSL" && row.type === "DEPARTURE",
	);
	const hkiArrivals = train.timeTableRows.filter(
		(row) => row.stationShortCode === "HKI" && row.type === "ARRIVAL",
	);

	if (pslDepartures.length === 0 || hkiArrivals.length === 0) {
		return false;
	}

	// Get last PSL departure and HKI arrival
	const [lastPslDeparture] = pslDepartures.slice(-1);
	const [lastHkiArrival] = hkiArrivals.slice(-1);

	if (!lastPslDeparture || !lastHkiArrival) return false;

	// Cache Date objects
	const pslTime = new Date(lastPslDeparture.scheduledTime);
	const hkiTime = new Date(lastHkiArrival.scheduledTime);

	// Ensure PSL departure is before HKI arrival
	if (pslTime >= hkiTime) return false;

	// Update timeTableRows to only include these two stops
	train.timeTableRows = [lastPslDeparture, lastHkiArrival];
	return true;
}

function isValidJourney(
	train: Train,
	stationCode: string,
	destinationCode: string,
): boolean {
	let lastValidOriginIndex = -1;
	let lastValidOriginTime = new Date(0);
	let lastValidDestinationTime = new Date(0);

	for (let i = 0; i < train.timeTableRows.length; i++) {
		const row = train.timeTableRows[i];
		const currentTime = new Date(row.scheduledTime);

		if (
			row.stationShortCode === stationCode &&
			currentTime > lastValidOriginTime
		) {
			lastValidOriginIndex = i;
			lastValidOriginTime = currentTime;
		} else if (
			row.stationShortCode === destinationCode &&
			i > lastValidOriginIndex &&
			currentTime > lastValidOriginTime
		) {
			lastValidDestinationTime = currentTime;
		}
	}

	return lastValidDestinationTime > lastValidOriginTime;
}

function sortByDepartureTime(a: Train, b: Train, stationCode: string): number {
	const getDepartureTime = (train: Train) => {
		const lastDeparture = train.timeTableRows.findLast(
			(row) => row.stationShortCode === stationCode,
		);
		return lastDeparture?.scheduledTime ?? "";
	};

	return (
		new Date(getDepartureTime(a)).getTime() -
		new Date(getDepartureTime(b)).getTime()
	);
}
