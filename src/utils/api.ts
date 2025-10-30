/** biome-ignore-all lint/security/noGlobalEval: we're intentionally using it to avoid bundling issues */
import type { Station, Train } from "../types";
import { getDepartureDate } from "./trainUtils";

/**
 * Resolve the app version from environment variables or package.json as a fallback.
 */
const getAppVersion = (): string => {
	// Browser environment (Astro/Vite)
	if (typeof import.meta !== "undefined" && import.meta.env) {
		return import.meta.env.PUBLIC_APP_VERSION || "1.8.0";
	}

	// Node.js environment - read from package.json
	try {
		// Dynamic import to avoid bundling issues
		const fs = eval("require")("node:fs");
		const path = eval("require")("node:path");
		const packagePath = path.join(process.cwd(), "package.json");
		const packageContent = fs.readFileSync(packagePath, "utf-8");
		const packageJson = JSON.parse(packageContent);
		return packageJson.version;
	} catch {
		return "1.8.0";
	}
};

const APP_VERSION = getAppVersion();

const BASE_URL = "https://rata.digitraffic.fi/api";
const ENDPOINTS = {
	GRAPHQL: `${BASE_URL}/v2/graphql/graphql`,
	STATIONS: `${BASE_URL}/v1/metadata/stations`,
	LIVE_TRAINS: `${BASE_URL}/v1/live-trains/station`,
} as const;

const DEFAULT_HEADERS = {
	"Content-Type": "application/json",
	"Accept-Encoding": "gzip",
	"User-Agent": `lahijunat.live/${APP_VERSION}`,
} as const;

// Cache configuration
const CACHE_CONFIG = {
	STATION_DURATION: 60 * 60 * 1000, // 1 hour
	STATION_KEY: "stations",
	TRAIN_DURATION: 2 * 60 * 1000, // 2 minutes (shorter for real-time updates)
	TRAIN_DURATION_URGENT: 30 * 1000, // 30 seconds for imminent trains
	DESTINATION_DURATION: 5 * 60 * 1000, // 5 minutes for destination cache
	MAX_SIZE: 100, // Maximum number of entries in the cache
} as const;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
	MAX_CONCURRENT_REQUESTS: 3,
	BASE_DELAY: 1000, // 1 second base delay
	MAX_DELAY: 30000, // 30 seconds max delay
	RETRY_COUNT: 3,
} as const;

// Global request tracking
let activeRequests = 0;
let lastRequestTime = 0;
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Guard outbound requests with deduplication and concurrency limits.
 */
async function makeRateLimitedRequest<T>(
	key: string,
	requestFn: () => Promise<T>,
): Promise<T> {
	// Check if this exact request is already in progress
	if (pendingRequests.has(key)) {
		console.log(`[API] Deduplicating request: ${key}`);
		return pendingRequests.get(key) as Promise<T>;
	}

	// Wait if we have too many concurrent requests
	while (activeRequests >= RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS) {
		await delay(100);
	}

	// Ensure minimum delay between requests
	const timeSinceLastRequest = Date.now() - lastRequestTime;
	const minInterval = 500; // 500ms minimum between requests
	if (timeSinceLastRequest < minInterval) {
		await delay(minInterval - timeSinceLastRequest);
	}

	activeRequests++;
	lastRequestTime = Date.now();

	const requestPromise = requestFn().finally(() => {
		activeRequests--;
		pendingRequests.delete(key);
	});

	pendingRequests.set(key, requestPromise);
	return requestPromise;
}

/**
 * Retry a request with exponential backoff when the API responds with 429 or transient failures.
 */
async function makeRequestWithBackoff(
	requestFn: () => Promise<Response>,
	retryCount = 0,
): Promise<Response> {
	try {
		const response = await requestFn();

		if (response.status === 429) {
			if (retryCount >= RATE_LIMIT_CONFIG.RETRY_COUNT) {
				throw new Error("Rate limit exceeded. Please try again later.");
			}

			const delayMs = Math.min(
				RATE_LIMIT_CONFIG.BASE_DELAY * 2 ** retryCount,
				RATE_LIMIT_CONFIG.MAX_DELAY,
			);

			console.log(
				`[API] Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1})`,
			);
			await delay(delayMs);

			return makeRequestWithBackoff(requestFn, retryCount + 1);
		}

		return response;
	} catch (error) {
		if (retryCount < RATE_LIMIT_CONFIG.RETRY_COUNT) {
			const delayMs = Math.min(
				RATE_LIMIT_CONFIG.BASE_DELAY * 2 ** retryCount,
				RATE_LIMIT_CONFIG.MAX_DELAY,
			);
			console.log(
				`[API] Request failed, retrying in ${delayMs}ms (attempt ${retryCount + 1})`,
			);
			await delay(delayMs);
			return makeRequestWithBackoff(requestFn, retryCount + 1);
		}
		throw error;
	}
}

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

interface GraphQLStation {
	name: string;
	shortCode: string;
	location: [number, number];
}

// Improved cache implementation with type safety
const stationCache = new Map<string, CacheEntry<Station[]>>();

/**
 * Return cached station metadata when it is still fresh.
 */
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

// Cache for destination data
const destinationCache = new Map<string, CacheEntry<Station[]>>();

/**
 * Lookup destination stations for a given origin from the destination cache.
 */
function getCachedDestinations(stationCode: string): Station[] | null {
	const cached = destinationCache.get(stationCode);
	if (!cached) return null;

	if (Date.now() - cached.timestamp > CACHE_CONFIG.DESTINATION_DURATION) {
		destinationCache.delete(stationCode);
		return null;
	}

	return cached.data;
}

// Cleanup function to prevent cache from growing too large
/**
 * Trim cache size by removing the oldest entries once the configured limit is exceeded.
 */
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

/**
 * Resolve cached train lists for an origin-destination pair, respecting urgency TTLs.
 */
function getCachedTrains(
	stationCode: string,
	destinationCode: string,
): Train[] | null {
	const cacheKey = `${stationCode}-${destinationCode}`;
	const cached = trainCache.get(cacheKey);
	if (!cached) return null;

	const now = Date.now();
	const age = now - cached.timestamp;

	// Check if there are urgent trains (departing within 5 minutes)
	const hasUrgentTrains = cached.data.some((train) => {
		const departureRow = train.timeTableRows.find(
			(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
		);
		if (!departureRow) return false;

		const departureTime = new Date(
			departureRow.liveEstimateTime ?? departureRow.scheduledTime,
		).getTime();
		const minutesToDeparture = (departureTime - now) / (1000 * 60);
		return minutesToDeparture > 0 && minutesToDeparture <= 5;
	});

	const maxAge = hasUrgentTrains
		? CACHE_CONFIG.TRAIN_DURATION_URGENT
		: CACHE_CONFIG.TRAIN_DURATION;

	if (age > maxAge) {
		// Don't delete expired entries - keep them for fallback in case API fails
		// They will be replaced when fresh data is successfully fetched
		return null;
	}

	return cached.data;
}

// Get cached trains even if expired (for fallback when API fails)
/**
 * Provide cached train data even if it has expired, used as a resilience fallback.
 */
function getCachedTrainsEvenIfExpired(
	stationCode: string,
	destinationCode: string,
): Train[] | null {
	const cacheKey = `${stationCode}-${destinationCode}`;
	const cached = trainCache.get(cacheKey);
	if (!cached) return null;

	// Return data even if expired - don't delete from cache
	return cached.data;
}

// Optimized GraphQL query with better filtering
const STATION_QUERY = `query GetStations {
	stations(where:{
		and:[
			{passengerTraffic:{equals:true}},
			{shortCode:{unequals:"ALV"}},
			{shortCode:{unequals:"ENO"}},
			{shortCode:{unequals:"EPZ"}},
			{shortCode:{unequals:"HH"}},
			{shortCode:{unequals:"HKS"}},
			{shortCode:{unequals:"HLS"}},
			{shortCode:{unequals:"HM"}},
			{shortCode:{unequals:"HNV"}},
			{shortCode:{unequals:"HP"}},
			{shortCode:{unequals:"HPA"}},
			{shortCode:{unequals:"HPJ"}},
			{shortCode:{unequals:"HPK"}},
			{shortCode:{unequals:"HSI"}},
			{shortCode:{unequals:"HVA"}},
			{shortCode:{unequals:"HÖL"}},
			{shortCode:{unequals:"IKY"}},
			{shortCode:{unequals:"ILM"}},
			{shortCode:{unequals:"IMR"}},
			{shortCode:{unequals:"JJ"}},
			{shortCode:{unequals:"JNS"}},
			{shortCode:{unequals:"JTS"}},
			{shortCode:{unequals:"JY"}},
			{shortCode:{unequals:"JÄS"}},
			{shortCode:{unequals:"KAJ"}},
			{shortCode:{unequals:"KEM"}},
			{shortCode:{unequals:"KEU"}},
			{shortCode:{unequals:"KHA"}},
			{shortCode:{unequals:"KIA"}},
			{shortCode:{unequals:"KIT"}},
			{shortCode:{unequals:"KIÄ"}},
			{shortCode:{unequals:"KJÄ"}},
			{shortCode:{unequals:"KKI"}},
			{shortCode:{unequals:"KLI"}},
			{shortCode:{unequals:"KLO"}},
			{shortCode:{unequals:"KML"}},
			{shortCode:{unequals:"KNS"}},
			{shortCode:{unequals:"KOH"}},
			{shortCode:{unequals:"KOK"}},
			{shortCode:{unequals:"KON"}},
			{shortCode:{unequals:"KRU"}},
			{shortCode:{unequals:"KRV"}},
			{shortCode:{unequals:"KTI"}},
			{shortCode:{unequals:"KUO"}},
			{shortCode:{unequals:"KUT"}},
			{shortCode:{unequals:"KYN"}},
			{shortCode:{unequals:"LAI"}},
			{shortCode:{unequals:"LIS"}},
			{shortCode:{unequals:"LM"}},
			{shortCode:{unequals:"LNA"}},
			{shortCode:{unequals:"LPA"}},
			{shortCode:{unequals:"LR"}},
			{shortCode:{unequals:"LUS"}},
			{shortCode:{unequals:"LVT"}},
			{shortCode:{unequals:"MH"}},
			{shortCode:{unequals:"MI"}},
			{shortCode:{unequals:"MIS"}},
			{shortCode:{unequals:"MR"}},
			{shortCode:{unequals:"MUL"}},
			{shortCode:{unequals:"MVA"}},
			{shortCode:{unequals:"MY"}},
			{shortCode:{unequals:"NLÄ"}},
			{shortCode:{unequals:"NRM"}},
			{shortCode:{unequals:"NVL"}},
			{shortCode:{unequals:"OL"}},
			{shortCode:{unequals:"OU"}},
			{shortCode:{unequals:"OV"}},
			{shortCode:{unequals:"OVK"}},
			{shortCode:{unequals:"PAR"}},
			{shortCode:{unequals:"PAU"}},
			{shortCode:{unequals:"PEL"}},
			{shortCode:{unequals:"PH"}},
			{shortCode:{unequals:"PHÄ"}},
			{shortCode:{unequals:"PKO"}},
			{shortCode:{unequals:"PKY"}},
			{shortCode:{unequals:"PM"}},
			{shortCode:{unequals:"PNÄ"}},
			{shortCode:{unequals:"PRI"}},
			{shortCode:{unequals:"PRV"}},
			{shortCode:{unequals:"PTL"}},
			{shortCode:{unequals:"PTO"}},
			{shortCode:{unequals:"PTR"}},
			{shortCode:{unequals:"PUN"}},
			{shortCode:{unequals:"PUR"}},
			{shortCode:{unequals:"PVI"}},
			{shortCode:{unequals:"REE"}},
			{shortCode:{unequals:"RKI"}},
			{shortCode:{unequals:"RNN"}},
			{shortCode:{unequals:"ROI"}},
			{shortCode:{unequals:"SIJ"}},
			{shortCode:{unequals:"SK"}},
			{shortCode:{unequals:"SKV"}},
			{shortCode:{unequals:"SL"}},
			{shortCode:{unequals:"SLO"}},
			{shortCode:{unequals:"SNJ"}},
			{shortCode:{unequals:"SPL"}},
			{shortCode:{unequals:"TK"}},
			{shortCode:{unequals:"TKU"}},
			{shortCode:{unequals:"TOR"}},
			{shortCode:{unequals:"TRI"}},
			{shortCode:{unequals:"TRV"}},
			{shortCode:{unequals:"TUS"}},
			{shortCode:{unequals:"TUU"}},
			{shortCode:{unequals:"TVE"}},
			{shortCode:{unequals:"UIM"}},
			{shortCode:{unequals:"UTJ"}},
			{shortCode:{unequals:"VAA"}},
			{shortCode:{unequals:"VAR"}},
			{shortCode:{unequals:"VIH"}},
			{shortCode:{unequals:"VLP"}},
			{shortCode:{unequals:"VMA"}},
			{shortCode:{unequals:"VNA"}},
			{shortCode:{unequals:"VNJ"}},
			{shortCode:{unequals:"VS"}},
			{shortCode:{unequals:"VSL"}},
			{shortCode:{unequals:"VTI"}},
			{shortCode:{unequals:"VYB"}},
			{shortCode:{unequals:"YST"}},
			{shortCode:{unequals:"YTR"}},
			{shortCode:{unequals:"YV"}},
			{shortCode:{unequals:"ÄHT"}},
		]
	}){
		name
		shortCode
		location
	}
}`;

/**
 * Fetch station metadata via GraphQL, caching results for subsequent lookups.
 */
export async function fetchStations(): Promise<Station[]> {
	const cached = getCachedStations();
	if (cached) return cached;

	return makeRateLimitedRequest("stations", async () => {
		const response = await makeRequestWithBackoff(() =>
			fetch(ENDPOINTS.GRAPHQL, {
				method: "POST",
				headers: DEFAULT_HEADERS,
				body: JSON.stringify({ query: STATION_QUERY }),
			}),
		);

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
	});
}

/**
 * Fetch commuter trains departing from an origin station and return unique destination stations.
 */
export async function fetchTrainsLeavingFromStation(
	stationCode: string,
): Promise<Station[]> {
	// Check cache first
	const cached = getCachedDestinations(stationCode);
	if (cached) {
		console.log(`[API] Using cached destinations for ${stationCode}`);
		return cached;
	}

	return makeRateLimitedRequest(`destinations-${stationCode}`, async () => {
		console.log(`[API] Fetching trains from station: ${stationCode}`);
		const url = `${ENDPOINTS.LIVE_TRAINS}/${stationCode}?arrived_trains=100&arriving_trains=100&departed_trains=100&departing_trains=100&include_nonstopping=false&train_categories=Commuter`;
		console.log(`[API] Request URL: ${url}`);

		const response = await makeRequestWithBackoff(() =>
			fetch(url, { headers: DEFAULT_HEADERS }),
		);

		console.log(
			`[API] Response status: ${response.status} ${response.statusText}`,
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

		// Early return if no trains - no destinations to process
		if (data.length === 0) {
			console.log(
				`[API] No trains found for ${stationCode}, returning empty destinations`,
			);
			const result: Station[] = [];
			// Cache the empty result
			destinationCache.set(stationCode, {
				data: result,
				timestamp: Date.now(),
			});
			return result;
		}

		// Extract unique station codes more efficiently, excluding current station
		const shortCodes = new Set<string>();
		for (const train of data) {
			for (const row of train.timeTableRows) {
				if (
					row.commercialStop &&
					row.trainStopping &&
					row.stationShortCode !== stationCode
				) {
					shortCodes.add(row.stationShortCode);
				}
			}
		}

		console.log(
			`[API] Found ${shortCodes.size} unique destination stations for ${stationCode}`,
		);

		// Early return if no destination codes found
		if (shortCodes.size === 0) {
			console.log(
				`[API] No destination codes found for ${stationCode}, returning empty destinations`,
			);
			const result: Station[] = [];
			destinationCache.set(stationCode, {
				data: result,
				timestamp: Date.now(),
			});
			return result;
		}

		// Reuse cached station data instead of fetching all stations again
		console.log("[API] Fetching station details using cached data");
		const allStations = await fetchStations();
		console.log(
			`[API] Received ${allStations.length} stations from cache/GraphQL`,
		);

		const filteredStations = allStations.filter((station: Station) =>
			shortCodes.has(station.shortCode),
		);

		console.log(
			`[API] Filtered to ${filteredStations.length} valid destination stations for ${stationCode}`,
		);

		// Stations are already in the correct format from fetchStations()
		const result = filteredStations;

		// Cache the result
		destinationCache.set(stationCode, {
			data: result,
			timestamp: Date.now(),
		});
		cleanupCache(destinationCache);

		return result;
	});
}

/**
 * Fetch commuter trains for an origin and destination pair, combining API data with local caching.
 */
export async function fetchTrains(
	stationCode = "HKI",
	destinationCode = "TKL",
): Promise<Train[]> {
	// Check cache first
	const cached = getCachedTrains(stationCode, destinationCode);
	if (cached) {
		console.log("Using cached train data");
		return cached;
	}

	return makeRateLimitedRequest(
		`trains-${stationCode}-${destinationCode}`,
		async () => {
			const params = new URLSearchParams({
				limit: "100",
				startDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago to capture delayed trains
				endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			});

			const url = `${ENDPOINTS.LIVE_TRAINS}/${stationCode}/${destinationCode}?${params}`;
			console.log("Fetching trains from URL:", url);

			const response = await makeRequestWithBackoff(() =>
				fetch(url, {
					headers: DEFAULT_HEADERS,
				}),
			);

			if (!response.ok) {
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

		// Use server time from Date header to reduce client clock skew
		const serverDateHeader = response.headers.get("date");
		let serverNowMs = Date.now();
		if (serverDateHeader) {
			const parsedDate = new Date(serverDateHeader);
			const parsedMs = parsedDate.getTime();
			if (Number.isFinite(parsedMs)) {
				serverNowMs = parsedMs;
			}
		}

			if (!Array.isArray(data)) {
				console.error("Invalid API response format:", data);
				throw new Error("Invalid API response format: expected an array");
			}

			console.log(`Received ${data.length} trains from API`);
			const processedData = processTrainData(
				data,
				stationCode,
				destinationCode,
				serverNowMs,
			);
			console.log(`Processed ${processedData.length} valid trains`);

			// Cache the processed data
			trainCache.set(`${stationCode}-${destinationCode}`, {
				data: processedData,
				timestamp: Date.now(),
			});
			cleanupCache(trainCache);

			return processedData;
		},
	).catch(async (error) => {
		console.error("Error fetching trains:", error);
		// If we have cached data, return it even if it's expired
		const cachedFallback = getCachedTrainsEvenIfExpired(
			stationCode,
			destinationCode,
		);
		if (cachedFallback) {
			console.log("Using expired cached data due to error");
			return cachedFallback;
		}
		throw error;
	});
}

/**
 * Normalise and filter raw API train data so downstream consumers only see valid journeys.
 */
const DEPARTED_HYSTERESIS_MS = 10_000; // 10 seconds to avoid flicker when no actualTime

function processTrainData(
    data: Train[],
    stationCode: string,
    destinationCode: string,
    serverNowMs: number,
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
		// Derive isDeparted/departedAt once here using server time
		.map((train) =>
			deriveDepartureStatus(train, stationCode, serverNowMs),
		)
		.sort((a, b) => sortByDepartureTime(a, b, stationCode));

	console.log(`Found ${filteredTrains.length} valid trains after processing`);
	return filteredTrains;
}

function deriveDepartureStatus(
	train: Train,
	stationCode: string,
	serverNowMs: number,
): Train {
	const departureRow = train.timeTableRows.find(
		(row) => row.stationShortCode === stationCode && row.type === "DEPARTURE",
	);

	if (!departureRow) {
		return train;
	}

	const actual = departureRow.actualTime;
	if (actual) {
		return {
			...train,
			isDeparted: true,
			departedAt: actual,
		};
	}

	const departureMs = getDepartureDate(departureRow).getTime();
	if (serverNowMs - departureMs >= DEPARTED_HYSTERESIS_MS) {
		return {
			...train,
			isDeparted: true,
			departedAt: new Date(departureMs).toISOString(),
		};
	}

	return {
		...train,
		isDeparted: false,
	};
}

/**
 * Ensure PSL→HKI round trips only expose the final Pasila departure and Helsinki arrival.
 */
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

/**
 * Extract a consistent track assignment for a journey, handling I/P round trips and return legs.
 */
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

/**
 * Confirm the train visits both the origin and destination in the correct chronological order.
 */
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

/**
 * Compare trains by their live or scheduled departure time at a given station.
 */
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

/**
 * Promise-based timeout helper used throughout the API client.
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Iterate over all stations and log those without active destination services.
 */
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
				await delay(15000); // 15 second delay between requests
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
