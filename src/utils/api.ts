/** biome-ignore-all lint/security/noGlobalEval: we're intentionally using it to avoid bundling issues */
import type { Station, Train } from "../types";
import type { PassengerInformationMessage } from "./passengerInfo";
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
	PASSENGER_INFO: `${BASE_URL}/v1/passenger-information/active`,
	STATUS: "https://status.digitraffic.fi/index.json",
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
	PASSENGER_INFO_DURATION: 60 * 1000, // 60 seconds for passenger information
	STATUS_DURATION: 5 * 60 * 1000, // 5 minutes for the Digitraffic status check
	STATUS_KEY: "digitraffic-status",
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

// Digitraffic status types
interface DigitrafficStatusIssue {
	title: string;
	createdAt: string;
	severity: string;
	affected: string[];
	permalink?: string;
}

interface DigitrafficStatusSystem {
	name: string;
	description?: string;
	category: string;
	status: "ok" | "down" | "disrupted";
	unresolvedIssues: DigitrafficStatusIssue[];
}

interface DigitrafficStatusResponse {
	summaryStatus: "ok" | "down" | "disrupted";
	systems: DigitrafficStatusSystem[];
}

export interface ServiceStatusIssueInfo {
	title: string;
	createdAt: string;
	permalink?: string;
	severity: string;
}

export interface ServiceStatusInfo {
	isDown: boolean;
	affectedSystems: string[];
	issues: ServiceStatusIssueInfo[];
	statusPageUrl: string;
}

const STATUS_PAGE_URL = "https://status.digitraffic.fi";

// Shared in-flight request so a burst of concurrent cold-cache callers (e.g.
// many train fetches failing at once during an outage) awaits a single status
// check instead of each issuing its own fetch.
let inFlightStatusPromise: Promise<ServiceStatusInfo> | null = null;

/**
 * Check Digitraffic service status for Rail systems.
 */
export async function checkDigitrafficStatus(): Promise<ServiceStatusInfo> {
	// Serve a recent determination to avoid hammering the status endpoint when
	// many train fetches fail in quick succession (e.g. during an outage).
	const cached = getCachedStatus();
	if (cached) return cached;

	// A check is already running — share its result rather than fetching again.
	if (inFlightStatusPromise) return inFlightStatusPromise;

	inFlightStatusPromise = fetchDigitrafficStatus();
	try {
		return await inFlightStatusPromise;
	} finally {
		inFlightStatusPromise = null;
	}
}

/**
 * Fetch the live Digitraffic status determination and cache successful results.
 * Always resolves (never rejects): on any failure it returns a "service up"
 * default without caching, so transient status-page outages aren't pinned.
 */
async function fetchDigitrafficStatus(): Promise<ServiceStatusInfo> {
	const defaultResult: ServiceStatusInfo = {
		isDown: false,
		affectedSystems: [],
		issues: [],
		statusPageUrl: STATUS_PAGE_URL,
	};

	try {
		const response = await fetch(ENDPOINTS.STATUS, {
			headers: { Accept: "application/json" },
		});

		if (!response.ok) {
			// Transient failure of the status page itself — don't cache it.
			return defaultResult;
		}

		const data: DigitrafficStatusResponse = await response.json();

		// Only check the exact services we use
		const ourServices = ["rail/api/v1/live-trains", "rail/graphql"];
		const criticalDown = data.systems.filter(
			(system) => ourServices.includes(system.name) && system.status === "down",
		);

		const affectedSystems = criticalDown.map(
			(system) => system.description || system.name,
		);
		const issues: ServiceStatusIssueInfo[] = criticalDown.flatMap((system) =>
			system.unresolvedIssues.map((issue) => ({
				title: issue.title,
				createdAt: issue.createdAt,
				permalink: issue.permalink,
				severity: issue.severity,
			})),
		);

		const result: ServiceStatusInfo =
			criticalDown.length === 0
				? defaultResult
				: {
						isDown: true,
						affectedSystems,
						issues,
						statusPageUrl: STATUS_PAGE_URL,
					};

		// Cache successful determinations (up or down) for STATUS_DURATION.
		statusCache.set(CACHE_CONFIG.STATUS_KEY, {
			data: result,
			timestamp: Date.now(),
		});
		return result;
	} catch (error) {
		console.error("Error checking Digitraffic status:", error);
		// If we can't check status, don't block the user — and don't cache it.
		return defaultResult;
	}
}

interface TrainCacheEntry extends CacheEntry<Train[]> {
	serverOffsetMs?: number;
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

// Cache for the Digitraffic service-status determination
const statusCache = new Map<string, CacheEntry<ServiceStatusInfo>>();

/**
 * Return the cached Digitraffic status determination while it is still fresh.
 */
function getCachedStatus(): ServiceStatusInfo | null {
	const cached = statusCache.get(CACHE_CONFIG.STATUS_KEY);
	if (!cached) return null;

	if (Date.now() - cached.timestamp > CACHE_CONFIG.STATUS_DURATION) {
		statusCache.delete(CACHE_CONFIG.STATUS_KEY);
		return null;
	}

	return cached.data;
}

// Cache for train data
const trainCache = new Map<string, TrainCacheEntry>();

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

	const serverNowMs = now + (cached.serverOffsetMs ?? 0);
	const refreshedData = cached.data.map((train) =>
		deriveDepartureStatus(train, stationCode, serverNowMs),
	);
	cached.data = refreshedData;

	return refreshedData;
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
	const serverNowMs = Date.now() + (cached.serverOffsetMs ?? 0);
	const refreshedData = cached.data.map((train) =>
		deriveDepartureStatus(train, stationCode, serverNowMs),
	);
	cached.data = refreshedData;
	return refreshedData;
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
			{shortCode:{unequals:"IKO"}},
			{shortCode:{unequals:"IKY"}},
			{shortCode:{unequals:"ILM"}},
			{shortCode:{unequals:"IMR"}},
			{shortCode:{unequals:"JJ"}},
			{shortCode:{unequals:"JNS"}},
			{shortCode:{unequals:"JTS"}},
			{shortCode:{unequals:"JY"}},
			{shortCode:{unequals:"JÄS"}},
			{shortCode:{unequals:"KAJ"}},
			{shortCode:{unequals:"KAN"}},
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
			{shortCode:{unequals:"MLO"}},
			{shortCode:{unequals:"MR"}},
			{shortCode:{unequals:"MUL"}},
			{shortCode:{unequals:"MVA"}},
			{shortCode:{unequals:"MY"}},
			{shortCode:{unequals:"MÄK"}},
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
			{shortCode:{unequals:"PJM"}},
			{shortCode:{unequals:"PKO"}},
			{shortCode:{unequals:"PKY"}},
			{shortCode:{unequals:"PM"}},
			{shortCode:{unequals:"PNÄ"}},
			{shortCode:{unequals:"POH"}},
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
			{shortCode:{unequals:"VMO"}},
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

	try {
		return await fetchStationsFromApi();
	} catch (error) {
		// During prerender (CI), Digitraffic occasionally returns 403 to shared
		// runner IPs; fall back to the committed snapshot so a single failed
		// request can't kill the whole build. Browsers still surface the error.
		if (typeof window === "undefined") {
			console.warn(
				"[API] Station fetch failed, falling back to committed snapshot:",
				error,
			);
			const { default: snapshot } = await import(
				"../data/stations-snapshot.json"
			);
			return snapshot as Station[];
		}
		throw error;
	}
}

async function fetchStationsFromApi(): Promise<Station[]> {
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
 * Full-network station name lookup from the REST metadata endpoint. Unlike
 * STATION_QUERY (filtered to commuter stations for the pickers), this covers
 * every station, so passenger announcements that reference long-distance or
 * excluded stations can still show a name instead of a bare short code.
 * Fetched at most once per session; a failure allows a later retry.
 */
let allStationNamesPromise: Promise<Map<string, string>> | null = null;

export function fetchAllStationNames(): Promise<Map<string, string>> {
	if (!allStationNamesPromise) {
		allStationNamesPromise = (async () => {
			const response = await makeRequestWithBackoff(() =>
				fetch(ENDPOINTS.STATIONS, { headers: DEFAULT_HEADERS }),
			);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch station names: ${response.statusText}`,
				);
			}
			const stations: Array<{
				stationShortCode: string;
				stationName: string;
			}> = await response.json();
			const map = new Map<string, string>();
			for (const station of stations) {
				map.set(
					station.stationShortCode,
					station.stationName.replace(" asema", ""),
				);
			}
			return map;
		})().catch((error) => {
			allStationNamesPromise = null;
			throw error;
		});
	}
	return allStationNamesPromise;
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

			const clientNowMs = Date.now();
			const serverOffsetMs = serverNowMs - clientNowMs;

			// Cache the processed data
			trainCache.set(`${stationCode}-${destinationCode}`, {
				data: processedData,
				timestamp: clientNowMs,
				serverOffsetMs: Number.isFinite(serverOffsetMs)
					? serverOffsetMs
					: undefined,
			});
			cleanupCache(trainCache);

			return processedData;
		},
	).catch(async (error) => {
		console.error("Error fetching trains:", error);

		// Check Digitraffic service status
		const status = await checkDigitrafficStatus();
		if (status.isDown) {
			console.log("Digitraffic service is down:", status);
			const issueMessages = status.issues
				.map((i) => i.title || JSON.stringify(i))
				.join(", ");
			const serviceError = new Error(
				`Digitraffic service is experiencing issues: ${issueMessages || "Service unavailable"}`,
			) as Error & { serviceStatus?: ServiceStatusInfo };
			serviceError.serviceStatus = status;
			throw serviceError;
		}

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
const DEPARTED_HYSTERESIS_MS = 2_000; // 2 seconds to avoid flicker when no actualTime

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
			if (firstStationIndex === -1) return null;
			// Capture the train's true first-origin scheduled time before slicing
			// — passenger-information messages key on the train's origin date,
			// which differs from the selected station for midnight-crossing or
			// previously-originated services.
			const sliced: Train = {
				...train,
				originDepartureTime: train.timeTableRows[0]?.scheduledTime,
				timeTableRows: train.timeTableRows.slice(firstStationIndex),
			};
			return sliced;
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
		.map((train) => deriveDepartureStatus(train, stationCode, serverNowMs))
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

// ---------------------------------------------------------------------------
// Passenger information messages
// ---------------------------------------------------------------------------

const passengerInfoCache = new Map<
	string,
	CacheEntry<PassengerInformationMessage[]>
>();

function buildPassengerInfoUrl(params: {
	station: string;
	departureDate?: string;
	generalOnly?: boolean;
}): string {
	const search = new URLSearchParams();
	search.append("station", params.station);
	if (params.generalOnly) {
		search.append("only_general", "true");
	}
	if (params.departureDate) {
		search.append("train_departure_date", params.departureDate);
	}
	return `${ENDPOINTS.PASSENGER_INFO}?${search.toString()}`;
}

async function requestPassengerInfo(
	url: string,
): Promise<PassengerInformationMessage[]> {
	const cached = passengerInfoCache.get(url);
	if (
		cached &&
		Date.now() - cached.timestamp < CACHE_CONFIG.PASSENGER_INFO_DURATION
	) {
		return cached.data;
	}

	const data = await makeRateLimitedRequest(url, async () => {
		const response = await makeRequestWithBackoff(() =>
			fetch(url, { headers: DEFAULT_HEADERS }),
		);
		if (!response.ok) {
			throw new Error(`Passenger info request failed: ${response.status}`);
		}
		const json = (await response.json()) as PassengerInformationMessage[];
		if (!Array.isArray(json)) {
			console.error(
				"[API] Unexpected passenger info response shape (expected array):",
				{ url, json },
			);
			return [];
		}
		return json;
	});

	passengerInfoCache.set(url, { data, timestamp: Date.now() });
	cleanupCache(passengerInfoCache);
	return data;
}

/**
 * Fetch currently-active passenger information messages for an origin and
 * destination station pair.
 *
 * The Digitraffic API quirks the URL must work around:
 * - Repeated `station=` params do NOT OR together — only the last value is
 *   honoured (verified empirically: HKI+LH returns LH-only results). So we
 *   issue one request per station and merge the results client-side.
 * - Comma-separated `station` values are also rejected.
 * - Exactly one `train_departure_date` per request; multiples are rejected or
 *   silently fail. So we also fan out per unique date when requested.
 *
 * Final request count is `stationCodes.length * max(uniqueDates.length, 1)`.
 * Results are merged and deduplicated by message id.
 *
 * Pass `generalOnly: true` to fetch only messages with `trainNumber === null`.
 */
export async function fetchActivePassengerMessages(opts: {
	stationCodes: string[];
	departureDates?: string[];
	generalOnly?: boolean;
}): Promise<PassengerInformationMessage[]> {
	const stationCodes = Array.from(new Set(opts.stationCodes.filter(Boolean)));
	if (stationCodes.length === 0) return [];

	const uniqueDates = opts.generalOnly
		? [undefined]
		: Array.from(new Set((opts.departureDates ?? []).filter(Boolean)));
	if (uniqueDates.length === 0) return [];

	// Each station×date request resolves independently: a single failed leg
	// degrades to an empty list (logged below) and merges into a partial result
	// rather than failing the whole batch. Announcements are non-critical, so we
	// prefer showing what we could fetch over showing nothing.
	const tasks: Promise<PassengerInformationMessage[]>[] = [];
	for (const station of stationCodes) {
		for (const date of uniqueDates) {
			const url = buildPassengerInfoUrl({
				station,
				generalOnly: opts.generalOnly,
				departureDate: date,
			});
			tasks.push(
				requestPassengerInfo(url).catch((error) => {
					console.error(
						`Failed to fetch passenger info for station=${station} date=${date ?? "-"}:`,
						error,
					);
					return [] as PassengerInformationMessage[];
				}),
			);
		}
	}

	const settled = await Promise.all(tasks);
	const merged = new Map<string, PassengerInformationMessage>();
	for (const batch of settled) {
		for (const msg of batch) {
			if (!merged.has(msg.id)) merged.set(msg.id, msg);
		}
	}
	return Array.from(merged.values());
}

// Test-only helper to reset the cache between unit tests.
export function __resetPassengerInfoCacheForTests(): void {
	passengerInfoCache.clear();
}

// Test-only helper to reset the Digitraffic status cache between unit tests.
export function __resetStatusCacheForTests(): void {
	statusCache.clear();
	inFlightStatusPromise = null;
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
