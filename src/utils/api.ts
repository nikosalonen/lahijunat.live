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

export async function fetchStations(): Promise<Station[]> {
	try {
		const query = `{
			stations(where:{passengerTraffic: {equals: true}}){name, shortCode}
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
		return data.stations;
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

	console.log(shortCodes);
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
		}),
	);
}

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

		return data
			.filter((train: Train) => {
				if (train.trainCategory !== "Commuter") return false;

				const relevantRows = train.timeTableRows.filter((row: TimeTableRow) =>
					[destinationCode, stationCode].includes(row.stationShortCode),
				);

				const [originRow, destinationRow] = [
					relevantRows.find((row) => row.stationShortCode === stationCode),
					relevantRows.find((row) => row.stationShortCode === destinationCode),
				];

				return (
					originRow &&
					destinationRow &&
					new Date(originRow.scheduledTime) <
						new Date(destinationRow.scheduledTime)
				);
			})
			.sort((a: Train, b: Train) => {
				const getDepartureTime = (train: Train) =>
					train.timeTableRows.find(
						(row) => row.stationShortCode === stationCode,
					)?.scheduledTime ?? "";

				return (
					new Date(getDepartureTime(a)).getTime() -
					new Date(getDepartureTime(b)).getTime()
				);
			});
	} catch (error) {
		console.error("Error fetching trains:", error);
		throw error;
	}
}
