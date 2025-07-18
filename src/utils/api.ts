import type { Station, Train } from "../types";

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
	TRAIN_DURATION: 10 * 1000, // 10 seconds
	MAX_SIZE: 100, // Maximum number of entries in the cache
} as const;

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

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
const stationCache = new Map<string, CacheEntry<Station[]>>();

function getCachedStations(): Station[] | null {
	const cached = stationCache.get(CACHE_CONFIG.STATION_KEY);
	if (!cached) return null;

	if (Date.now() - cached.timestamp > CACHE_CONFIG.STATION_DURATION) {
		stationCache.delete(CACHE_CONFIG.STATION_KEY);
		return null;
	}

	return cached.data;
}

// Cache for train data
const trainCache = new Map<string, CacheEntry<Train[]>>();

// Cleanup function to prevent cache from growing too large
function cleanupCache<T>(cache: Map<string, CacheEntry<T>>): void {
	if (cache.size <= CACHE_CONFIG.MAX_SIZE) return;

	// Convert entries to array and sort by timestamp
	const entries = Array.from(cache.entries()).sort(
		(a, b) => a[1].timestamp - b[1].timestamp,
	);

	// Remove oldest entries until we're under the limit
	const entriesToRemove = entries.slice(0, cache.size - CACHE_CONFIG.MAX_SIZE);
	for (const [key] of entriesToRemove) {
		cache.delete(key);
	}
}

function getCachedTrains(
	stationCode: string,
	destinationCode: string,
): Train[] | null {
	const cacheKey = `${stationCode}-${destinationCode}`;
	const cached = trainCache.get(cacheKey);
	if (!cached) return null;

	if (Date.now() - cached.timestamp > CACHE_CONFIG.TRAIN_DURATION) {
		trainCache.delete(cacheKey);
		return null;
	}

	return cached.data;
}

// Optimized GraphQL query with better filtering
const STATION_QUERY = `query GetStations {
	stations(where:{
		and:[
			{passengerTraffic:{equals:true}},
			{shortCode:{unequals:"ALV"}},
			{shortCode:{unequals:"EPZ"}},
			{shortCode:{unequals:"ENO"}},
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
			{shortCode:{unequals:"IKY"}},
			{shortCode:{unequals:"JNS"}},
			{shortCode:{unequals:"JTS"}},
			{shortCode:{unequals:"JJ"}},
			{shortCode:{unequals:"JY"}},
			{shortCode:{unequals:"JÄS"}},
			{shortCode:{unequals:"KAJ"}},
			{shortCode:{unequals:"KNS"}},
			{shortCode:{unequals:"KRU"}},
			{shortCode:{unequals:"KHA"}},
			{shortCode:{unequals:"KEM"}},
			{shortCode:{unequals:"KJÄ"}},
			{shortCode:{unequals:"KML"}},
			{shortCode:{unequals:"KIÄ"}},
			{shortCode:{unequals:"KTI"}},
			{shortCode:{unequals:"KEU"}},
			{shortCode:{unequals:"KIA"}},
			{shortCode:{unequals:"KIT"}},
			{shortCode:{unequals:"KRV"}},
			{shortCode:{unequals:"KOH"}},
			{shortCode:{unequals:"KKI"}},
			{shortCode:{unequals:"KOK"}},
			{shortCode:{unequals:"KLI"}},
			{shortCode:{unequals:"KLO"}},
			{shortCode:{unequals:"KON"}},
			{shortCode:{unequals:"KUO"}},
			{shortCode:{unequals:"KUT"}},
			{shortCode:{unequals:"KYN"}},
			{shortCode:{unequals:"LAI"}},
			{shortCode:{unequals:"LNA"}},
			{shortCode:{unequals:"LR"}},
			{shortCode:{unequals:"LPA"}},
			{shortCode:{unequals:"LIS"}},
			{shortCode:{unequals:"LVT"}},
			{shortCode:{unequals:"LM"}},
			{shortCode:{unequals:"LUS"}},
			{shortCode:{unequals:"MI"}},
			{shortCode:{unequals:"MIS"}},
			{shortCode:{unequals:"MVA"}},
			{shortCode:{unequals:"MH"}},
			{shortCode:{unequals:"MUL"}},
			{shortCode:{unequals:"MY"}},
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
			{shortCode:{unequals:"PAU"}},
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
			{shortCode:{unequals:"SKV"}},
			{shortCode:{unequals:"SNJ"}},
			{shortCode:{unequals:"TK"}},
			{shortCode:{unequals:"TRV"}},
			{shortCode:{unequals:"TOR"}},
			{shortCode:{unequals:"TRI"}},
			{shortCode:{unequals:"TKU"}},
			{shortCode:{unequals:"TUS"}},
			{shortCode:{unequals:"TUU"}},
			{shortCode:{unequals:"TVE"}},
			{shortCode:{unequals:"UIM"}},
			{shortCode:{unequals:"UTJ"}},
			{shortCode:{unequals:"VAA"}},
			{shortCode:{unequals:"VS"}},
			{shortCode:{unequals:"VNA"}},
			{shortCode:{unequals:"VMA"}},
			{shortCode:{unequals:"VAR"}},
			{shortCode:{unequals:"VTI"}},
			{shortCode:{unequals:"VIH"}},
			{shortCode:{unequals:"VNJ"}},
			{shortCode:{unequals:"VYB"}},
			{shortCode:{unequals:"VLP"}},
			{shortCode:{unequals:"VSL"}},
			{shortCode:{unequals:"YST"}},
			{shortCode:{unequals:"YTR"}},
			{shortCode:{unequals:"YV"}},
			{shortCode:{unequals:"ÄHT"}}
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
			throw new Error(
				`Invalid response format from GraphQL API. Response: ${JSON.stringify(result)}`,
			);
		}

		const stations = result.data.stations.map((station: GraphQLStation) => ({
			...station,
			name: station.name.replace(" asema", ""),
			location: {
				longitude: station.location[0],
				latitude: station.location[1],
			},
		}));

		stationCache.set(CACHE_CONFIG.STATION_KEY, {
			data: stations,
			timestamp: Date.now(),
		});
		cleanupCache(stationCache);
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
		console.log(`[API] Fetching trains from station: ${stationCode}`);
		const url = `${ENDPOINTS.LIVE_TRAINS}/${stationCode}?arrived_trains=100&arriving_trains=100&departed_trains=100&departing_trains=100&include_nonstopping=false&train_categories=Commuter`;
		console.log(`[API] Request URL: ${url}`);

		const response = await fetch(url, { headers: DEFAULT_HEADERS });

		console.log(
			`[API] Response status: ${response.status} ${response.statusText}`,
		);
		console.log(
			"[API] Response headers:",
			Object.fromEntries(response.headers.entries()),
		);

		if (!response.ok) {
			console.error(`[API] Failed to fetch station data for ${stationCode}:`, {
				status: response.status,
				statusText: response.statusText,
				url: url,
			});
			throw new Error(`Failed to fetch station data: ${response.statusText}`);
		}

		const data = await response.json();
		console.log(
			`[API] Received ${data.length} trains for station ${stationCode}`,
		);

		// Extract unique station codes more efficiently
		const shortCodes = new Set<string>();
		for (const train of data) {
			for (const row of train.timeTableRows) {
				if (row.commercialStop && row.trainStopping) {
					shortCodes.add(row.stationShortCode);
				}
			}
		}

		console.log(
			`[API] Found ${shortCodes.size} unique destination stations for ${stationCode}`,
		);

		// Fetch station details in parallel
		console.log(`[API] Fetching station details from: ${ENDPOINTS.STATIONS}`);
		const stationsResponse = await fetch(ENDPOINTS.STATIONS);

		console.log(
			`[API] Stations response status: ${stationsResponse.status} ${stationsResponse.statusText}`,
		);

		if (!stationsResponse.ok) {
			console.error("[API] Failed to fetch station details:", {
				status: stationsResponse.status,
				statusText: stationsResponse.statusText,
				url: ENDPOINTS.STATIONS,
			});
			throw new Error(
				`Failed to fetch station details: ${stationsResponse.statusText}`,
			);
		}

		const stationsData = await stationsResponse.json();
		console.log(`[API] Received ${stationsData.length} total stations`);

		const filteredStations = stationsData.filter(
			(station: RESTStation) =>
				shortCodes.has(station.stationShortCode) &&
				station.passengerTraffic &&
				station.stationShortCode !== stationCode,
		);

		console.log(
			`[API] Filtered to ${filteredStations.length} valid destination stations for ${stationCode}`,
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
		console.error(
			`[API] Error fetching trains from station ${stationCode}:`,
			error,
		);
		throw error;
	}
}

// Optimized fetchTrains with better error handling and data processing
export async function fetchTrains(
	stationCode = "HKI",
	destinationCode = "TKL",
): Promise<Train[]> {
	try {
		// Check cache first
		const cached = getCachedTrains(stationCode, destinationCode);
		if (cached) {
			console.log("Using cached train data");
			return cached;
		}

		const params = new URLSearchParams({
			limit: "100",
			startDate: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
			endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		});

		const url = `${ENDPOINTS.LIVE_TRAINS}/${stationCode}/${destinationCode}?${params}`;
		console.log("Fetching trains from URL:", url);

		const response = await fetch(url, {
			headers: DEFAULT_HEADERS,
		});

		if (!response.ok) {
			if (response.status === 429) {
				// Too Many Requests
				console.log("Rate limit hit, using cached data if available");
				const cached = getCachedTrains(stationCode, destinationCode);
				if (cached) return cached;
				throw new Error(
					"Rate limit exceeded. Please try again in a few seconds.",
				);
			}
			const errorText = await response.text();
			console.error("API Error Response:", {
				status: response.status,
				statusText: response.statusText,
				body: errorText,
			});
			throw new Error(
				`Failed to fetch trains: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		if (!Array.isArray(data)) {
			console.error("Invalid API response format:", data);
			throw new Error("Invalid API response format: expected an array");
		}

		console.log(`Received ${data.length} trains from API`);
		const processedData = processTrainData(data, stationCode, destinationCode);
		console.log(`Processed ${processedData.length} valid trains`);

		// Cache the processed data
		trainCache.set(`${stationCode}-${destinationCode}`, {
			data: processedData,
			timestamp: Date.now(),
		});
		cleanupCache(trainCache);

		return processedData;
	} catch (error) {
		console.error("Error fetching trains:", error);
		// If we have cached data, return it even if it's expired
		const cached = getCachedTrains(stationCode, destinationCode);
		if (cached) {
			console.log("Using expired cached data due to error");
			return cached;
		}
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
	if (!data.length) {
		if (process.env.NODE_ENV === "development") {
			console.log("No train data received from API");
		}
		return [];
	}

	// Use debug level or remove for production
	if (process.env.NODE_ENV === "development") {
		console.log(
			`Processing ${data.length} trains for route ${stationCode} -> ${destinationCode}`,
		);
	}
	const isPSLHKIRoute = stationCode === "PSL" && destinationCode === "HKI";

	const filteredTrains = data
		.filter((train) => {
			const isCommuter = train.trainCategory === "Commuter";
			if (!isCommuter && process.env.NODE_ENV === "development") {
				console.log(`Skipping non-commuter train ${train.trainNumber}`);
			}
			return isCommuter;
		})
		.map((train) => {
			// Find and slice timeTableRows once
			const firstStationIndex = train.timeTableRows.findIndex(
				(row) => row.stationShortCode === stationCode,
			);
			if (firstStationIndex === -1 && process.env.NODE_ENV === "development") {
				console.log(
					`Train ${train.trainNumber} does not stop at ${stationCode}`,
				);
			}
			return firstStationIndex === -1
				? null
				: {
						...train,
						timeTableRows: train.timeTableRows.slice(firstStationIndex),
					};
		})
		.filter((train): train is Train => {
			if (!train) return false;

			// Special handling for PSL to HKI route
			if (isPSLHKIRoute) {
				const isValid = isPSLtoHKI(train);
				if (!isValid && process.env.NODE_ENV === "development") {
					console.log(
						`Train ${train.trainNumber} is not a valid PSL->HKI journey`,
					);
				}
				return isValid;
			}

			const isValid = isValidJourney(train, stationCode, destinationCode);
			if (!isValid && process.env.NODE_ENV === "development") {
				console.log(
					`Train ${train.trainNumber} is not a valid journey from ${stationCode} to ${destinationCode}`,
				);
			}
			return isValid;
		})
		.sort((a, b) => sortByDepartureTime(a, b, stationCode));

	console.log(`Found ${filteredTrains.length} valid trains after processing`);
	return filteredTrains;
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

// New function to handle track changes for I and P trains
export function getRelevantTrackInfo(
	train: Train,
	stationCode: string,
	destinationCode: string,
): { track: string; timestamp: string; journeyKey: string } | null {
	// Create a unique key for this journey
	const journeyKey = `${train.trainNumber}-${stationCode}-${destinationCode}`;

	// For I and P trains that make round trips
	if (train.trainType === "I" || train.trainType === "P") {
		const stationStops = train.timeTableRows.filter(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);

		if (stationStops.length === 0) return null;

		// For Helsinki and Pasila, we need to handle the round trip case
		if (stationCode === "HKI" || stationCode === "PSL") {
			// Find the last departure from this station that's part of the return journey
			const returnJourneyStops = stationStops.filter((stop, index) => {
				if (index === stationStops.length - 1) return true; // Always include the last stop

				// Check if this is part of the return journey by looking at subsequent stops
				const nextStops = train.timeTableRows.slice(
					train.timeTableRows.indexOf(stop) + 1,
				);

				// If we find a stop at the other station (HKI/PSL) after this one, it's part of the return journey
				return nextStops.some(
					(nextStop) =>
						(nextStop.stationShortCode === "HKI" ||
							nextStop.stationShortCode === "PSL") &&
						nextStop.type === "ARRIVAL",
				);
			});

			if (returnJourneyStops.length > 0) {
				const lastReturnStop =
					returnJourneyStops[returnJourneyStops.length - 1];
				return {
					track: lastReturnStop.commercialTrack,
					timestamp: lastReturnStop.scheduledTime,
					journeyKey,
				};
			}
		}

		// For other stations or if we couldn't determine the return journey
		const lastStop = stationStops[stationStops.length - 1];
		return {
			track: lastStop.commercialTrack,
			timestamp: lastStop.scheduledTime,
			journeyKey,
		};
	}

	// For other train types, just get the first departure
	const firstDeparture = train.timeTableRows.find(
		(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
	);

	return firstDeparture
		? {
				track: firstDeparture.commercialTrack,
				timestamp: firstDeparture.scheduledTime,
				journeyKey,
			}
		: null;
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
				await delay(15000); // 10 second delay between requests
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
