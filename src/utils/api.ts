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

// Cache configuration
const CACHE_CONFIG = {
	STATION_DURATION: 60 * 60 * 1000, // 1 hour
	STATION_KEY: "stations",
} as const;

interface GraphQLStation {
	name: string;
	shortCode: string;
	location: [number, number];
}

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

// Improved cache implementation with type safety
const stationCache = new Map<string, { data: Station[]; timestamp: number }>();

function getCachedStations(): Station[] | null {
	const cached = stationCache.get(CACHE_CONFIG.STATION_KEY);
	if (!cached) return null;

	if (Date.now() - cached.timestamp > CACHE_CONFIG.STATION_DURATION) {
		stationCache.delete(CACHE_CONFIG.STATION_KEY);
		return null;
	}

	return cached.data;
}

// Optimized GraphQL query with better filtering
const STATION_QUERY = `query GetStations {
	stations(where:{
		and:[
			{passengerTraffic:{equals:true}},
			{shortCode:{unequals:"ENO"}},
			{shortCode:{unequals:"EPZ"}},
			{shortCode:{unequals:"PAU"}},
			{shortCode:{unequals:"ALV"}},
			{shortCode:{unequals:"HPJ"}},
			{shortCode:{unequals:"HPK"}},
			{shortCode:{unequals:"HPA"}},
			{shortCode:{unequals:"HSI"}},
			{shortCode:{unequals:"HKS"}},
			{shortCode:{unequals:"HVA"}},
			{shortCode:{unequals:"HNV"}},
			{shortCode:{unequals:"HLS"}},
			{shortCode:{unequals:"HH"}},
			{shortCode:{unequals:"HP"}},
			{shortCode:{unequals:"HM"}},
			{shortCode:{unequals:"HÖL"}},
			{shortCode:{unequals:"ILM"}},
			{shortCode:{unequals:"IMR"}},
			{shortCode:{unequals:"IKO"}},
			{shortCode:{unequals:"IKY"}},
			{shortCode:{unequals:"JNS"}},
			{shortCode:{unequals:"JTS"}},
			{shortCode:{unequals:"JJ"}},
			{shortCode:{unequals:"JY"}},
			{shortCode:{unequals:"JÄS"}},
			{shortCode:{unequals:"KAJ"}},
			{shortCode:{unequals:"KNS"}},
			{shortCode:{unequals:"KRU"}},
			{shortCode:{unequals:"KEM"}},
			{shortCode:{unequals:"KJÄ"}},
			{shortCode:{unequals:"KIÄ"}},
			{shortCode:{unequals:"KTI"}},
			{shortCode:{unequals:"KEU"}},
			{shortCode:{unequals:"KIA"}},
			{shortCode:{unequals:"KIT"}},
			{shortCode:{unequals:"KRV"}},
			{shortCode:{unequals:"KOK"}},
			{shortCode:{unequals:"LUS"}},
			{shortCode:{unequals:"MR"}},
			{shortCode:{unequals:"NLÄ"}},
			{shortCode:{unequals:"NVL"}},
			{shortCode:{unequals:"NRM"}},
			{shortCode:{unequals:"OV"}},
			{shortCode:{unequals:"OVK"}},
			{shortCode:{unequals:"OU"}},
			{shortCode:{unequals:"OL"}},
			{shortCode:{unequals:"PTO"}},
			{shortCode:{unequals:"PAR"}},
			{shortCode:{unequals:"PKO"}},
			{shortCode:{unequals:"PEL"}},
			{shortCode:{unequals:"PVI"}},
			{shortCode:{unequals:"PM"}},
			{shortCode:{unequals:"PTR"}},
			{shortCode:{unequals:"PTL"}},
			{shortCode:{unequals:"PH"}},
			{shortCode:{unequals:"PRI"}},
			{shortCode:{unequals:"PRV"}},
			{shortCode:{unequals:"PUN"}},
			{shortCode:{unequals:"PUR"}},
			{shortCode:{unequals:"PHÄ"}},
			{shortCode:{unequals:"PNÄ"}},
			{shortCode:{unequals:"PKY"}},
			{shortCode:{unequals:"REE"}},
			{shortCode:{unequals:"ROI"}},
			{shortCode:{unequals:"RNN"}},
			{shortCode:{unequals:"RKI"}},
			{shortCode:{unequals:"SLO"}},
			{shortCode:{unequals:"SL"}},
			{shortCode:{unequals:"SK"}},
			{shortCode:{unequals:"SIJ"}},
			{shortCode:{unequals:"SPL"}},
			{shortCode:{unequals:"ÄHT"}},
			{shortCode:{unequals:"YV"}},
			{shortCode:{unequals:"YTR"}},
			{shortCode:{unequals:"YST"}},
			{shortCode:{unequals:"VSL"}},
			{shortCode:{unequals:"VLP"}},
			{shortCode:{unequals:"VYB"}},
			{shortCode:{unequals:"VNJ"}},
			{shortCode:{unequals:"VIH"}},
			{shortCode:{unequals:"VTI"}},
			{shortCode:{unequals:"VAR"}},
			{shortCode:{unequals:"VMA"}},
			{shortCode:{unequals:"VNA"}},
			{shortCode:{unequals:"VS"}},
			{shortCode:{unequals:"VAA"}},
			{shortCode:{unequals:"UTJ"}},
			{shortCode:{unequals:"UIM"}},
			{shortCode:{unequals:"TVE"}},
			{shortCode:{unequals:"TUU"}},
			{shortCode:{unequals:"TUS"}},
			{shortCode:{unequals:"TKU"}},
			{shortCode:{unequals:"TRI"}},
			{shortCode:{unequals:"TOR"}},
			{shortCode:{unequals:"TRV"}},
			{shortCode:{unequals:"TK"}},
			{shortCode:{unequals:"SNJ"}},
			{shortCode:{unequals:"SKV"}},
			{shortCode:{unequals:"MY"}},
			{shortCode:{unequals:"MUL"}},
			{shortCode:{unequals:"MH"}},
			{shortCode:{unequals:"MVA"}},
			{shortCode:{unequals:"MIS"}},
			{shortCode:{unequals:"MI"}},
			{shortCode:{unequals:"LM"}},
			{shortCode:{unequals:"LVT"}},
			{shortCode:{unequals:"LIS"}},
			{shortCode:{unequals:"LPA"}},
			{shortCode:{unequals:"LR"}},
			{shortCode:{unequals:"LNA"}},
			{shortCode:{unequals:"LAI"}},
			{shortCode:{unequals:"KYN"}},
			{shortCode:{unequals:"KUT"}},
			{shortCode:{unequals:"KUO"}},
			{shortCode:{unequals:"KON"}},
			{shortCode:{unequals:"KLO"}},
			{shortCode:{unequals:"KLI"}},
			{shortCode:{unequals:"KKI"}},
			{shortCode:{unequals:"KOH"}},
			{shortCode:{unequals:"KML"}},
			{shortCode:{unequals:"KHA"}}
		]
	}){
		name
		shortCode
		location
	}
}`;

// Improved fetchStations with better error handling and caching
export async function fetchStations(): Promise<Station[]> {
	const cached = getCachedStations();
	if (cached) return cached;

	try {
		const response = await fetch(ENDPOINTS.GRAPHQL, {
			method: "POST",
			headers: DEFAULT_HEADERS,
			body: JSON.stringify({ query: STATION_QUERY }),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch stations: ${response.statusText}`);
		}

		const result = await response.json();
		
		// Check for GraphQL errors
		if (result.errors) {
			throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
		}

		// Check if the response has the expected structure
		if (!result?.data?.stations) {
			throw new Error(`Invalid response format from GraphQL API. Response: ${JSON.stringify(result)}`);
		}

		const stations = result.data.stations.map((station: GraphQLStation) => ({
			...station,
			name: station.name.replace(" asema", ""),
			location: {
				longitude: station.location[0],
				latitude: station.location[1],
			},
		}));

		stationCache.set(CACHE_CONFIG.STATION_KEY, { data: stations, timestamp: Date.now() });
		return stations;
	} catch (error) {
		console.error("Error fetching stations:", error);
		throw error;
	}
}

// Optimized fetchTrainsLeavingFromStation with better error handling and data processing
export async function fetchTrainsLeavingFromStation(
	stationCode: string,
): Promise<Station[]> {
	try {
		const response = await fetch(
			`${ENDPOINTS.LIVE_TRAINS}/${stationCode}?arrived_trains=100&arriving_trains=100&departed_trains=100&departing_trains=100&include_nonstopping=false&train_categories=Commuter`,
			{ headers: DEFAULT_HEADERS },
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch station data: ${response.statusText}`);
		}

		const data = await response.json();
		
		// Extract unique station codes more efficiently
		const shortCodes = new Set<string>();
		for (const train of data) {
			for (const row of train.timeTableRows) {
				if (row.commercialStop && row.trainStopping) {
					shortCodes.add(row.stationShortCode);
				}
			}
		}

		// Fetch station details in parallel
		const stationsResponse = await fetch(ENDPOINTS.STATIONS);
		if (!stationsResponse.ok) {
			throw new Error(`Failed to fetch station details: ${stationsResponse.statusText}`);
		}

		const stationsData = await stationsResponse.json();
		const filteredStations = stationsData.filter(
			(station: RESTStation) =>
				shortCodes.has(station.stationShortCode) &&
				station.passengerTraffic &&
				station.stationShortCode !== stationCode,
		);

		return filteredStations.map(
			(station: RESTStation): Station => ({
				name: station.stationName.replace(" asema", ""),
				shortCode: station.stationShortCode,
				location: {
					latitude: station.latitude,
					longitude: station.longitude,
				},
			}),
		);
	} catch (error) {
		console.error(`Error fetching trains from station ${stationCode}:`, error);
		throw error;
	}
}

// Optimized fetchTrains with better error handling and data processing
export async function fetchTrains(
	stationCode = "HKI",
	destinationCode = "TKL",
): Promise<Train[]> {
	try {
		const params = new URLSearchParams({
			limit: "100",
			startDate: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
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
	// Early return for empty data
	if (!data.length) return [];

	const isPSLHKIRoute = stationCode === "PSL" && destinationCode === "HKI";

	return data
		.filter((train) => train.trainCategory === "Commuter")
		.map((train) => {
			// Find and slice timeTableRows once
			const firstStationIndex = train.timeTableRows.findIndex(
				(row) => row.stationShortCode === stationCode,
			);
			if (firstStationIndex === -1) return null;

			// Create new train object to avoid mutating original
			return {
				...train,
				timeTableRows: train.timeTableRows.slice(firstStationIndex),
			};
		})
		.filter((train): train is Train => {
			if (!train) return false;

			// Special handling for PSL to HKI route
			if (isPSLHKIRoute) {
				return isPSLtoHKI(train);
			}

			return isValidJourney(train, stationCode, destinationCode);
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
	let foundValidOrigin = false;
	let foundValidDestination = false;
	let lastOriginTime = new Date(0);

	for (const row of train.timeTableRows) {
		const currentTime = new Date(row.scheduledTime);

		if (row.stationShortCode === stationCode && row.type === "DEPARTURE") {
			foundValidOrigin = true;
			lastOriginTime = currentTime;
		} else if (
			row.stationShortCode === destinationCode &&
			row.type === "ARRIVAL" &&
			currentTime > lastOriginTime
		) {
			foundValidDestination = true;
		}
	}

	return foundValidOrigin && foundValidDestination;
}

function sortByDepartureTime(a: Train, b: Train, stationCode: string): number {
	const getDepartureTime = (train: Train) => {
		const departureRow = train.timeTableRows.find(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);
		return departureRow?.liveEstimateTime ?? departureRow?.scheduledTime ?? "";
	};

	return (
		new Date(getDepartureTime(a)).getTime() -
		new Date(getDepartureTime(b)).getTime()
	);
}

// Helper function to delay execution
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function findStationsWithoutDestinations(): Promise<void> {
	try {
		console.log("Finding stations without destinations...");
		const stations = await fetchStations();
		const stationsWithoutDestinations: Station[] = [];

		console.log(`Checking ${stations.length} stations...`);

		for (const station of stations) {
			try {
				console.log(
					`Checking station ${station.name} (${station.shortCode})...`,
				);
				await delay(2000); // 2 second delay between requests
				const destinations = await fetchTrainsLeavingFromStation(
					station.shortCode,
				);

				if (destinations.length === 0) {
					stationsWithoutDestinations.push(station);
					console.log(
						`No destinations found for: ${station.name} (${station.shortCode})`,
					);
				}
			} catch (error) {
				console.error(`Error checking station ${station.name}:`, error);
				stationsWithoutDestinations.push(station);
			}
		}
		console.log("\nSummary of stations without destinations:");
		for (const station of stationsWithoutDestinations) {
			console.log(`${station.name} (${station.shortCode})`);
		}
		console.log(
			`\nTotal: ${stationsWithoutDestinations.length} stations without destinations`,
		);
	} catch (error) {
		console.error("Error in findStationsWithoutDestinations:", error);
		throw error;
	}
}
