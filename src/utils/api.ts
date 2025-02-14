import type { Station, TimeTableRow, Train } from "../types";

const GRAPHQL_ENDPOINT = "https://rata.digitraffic.fi/api/v2/graphql/graphql";
const STATIONS_ENDPOINT =
	"https://rata.digitraffic.fi/api/v1/metadata/stations";
const LIVE_ENDPOINT = "https://rata.digitraffic.fi/api/v1/live-trains/station/";

export async function fetchStations() {
	const query = `{
    stations(where:{passengerTraffic: {equals: true}}){name, shortCode}
  }`;

	const response = await fetch(GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept-Encoding": "gzip",
		},
		body: JSON.stringify({ query }),
	});

	if (!response.ok) {
		throw new Error("Failed to fetch stations");
	}

	const data = await response.json();
	return data.data.stations;
}

export async function fetchTrainsLeavingFromStation(
	stationCode: string,
): Promise<Station[]> {
	const response = await fetch(
		`${LIVE_ENDPOINT}${stationCode}?arrived_trains=100&arriving_trains=100&departed_trains=100&departing_trains=100&include_nonstopping=false&train_categories=Commuter`,
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
	const stations = await fetch(STATIONS_ENDPOINT);
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
) {
	const where = "departed_trains:0, departing_trains:100";

	const departureDate = new Date().toISOString().split("T")[0];
	//   const query = `{
	//   trainsByDepartureDate(
	//     departureDate:  "${departureDate}"
	//     where: {and: [{timeTableRows: {contains: {station: {shortCode: {equals: "PLA"}}}}}, {commuterLineid: {unequals: ""}},{cancelled:{equals:false}}]}

	//   ) {
	//     cancelled
	//     commuterLineid
	//     trainNumber
	//     timeTableRows(where: {and:[{cancelled:{equals:false}},{type:{equals:"DEPARTURE"}},{trainStopping:{equals:true}},]}) {
	//       trainStopping
	//       type
	//       commercialStop
	//       commercialTrack
	//       cancelled
	//       liveEstimateTime
	//       actualTime
	//       differenceInMinutes
	//       scheduledTime
	//       station {
	//         name
	//         shortCode
	//       }
	//     }
	//   }
	// }`;

	// const response = await fetch(GRAPHQL_ENDPOINT, {
	//   method: 'POST',
	//   headers: {
	//     'Content-Type': 'application/json',
	//     'Accept-Encoding': 'gzip',
	//   },
	//   body: JSON.stringify({ query }),
	// });
	const minutesBeforeDeparture = 60;
	const minutesAfterDeparture = 1;

	const trainCategories = "Commuter";
	// const response = await fetch(LIVE_ENDPOINT + stationCode + '?minutes_before_departure=' + minutesBeforeDeparture + '&arriving_trains=0&departed_trains=0&arrived_trains=0&departing_trains=100&minutes_after_departure=' + minutesAfterDeparture +  '&train_categories=' + trainCategories);

	const startDate = new Date().toISOString();
	const endDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

	const response = await fetch(
		`https://rata.digitraffic.fi/api/v1/live-trains/station/${stationCode}/${destinationCode}?limit=100&startDate=${startDate}&endDate=${endDate}`,
	);

	if (!response.ok) {
		throw new Error("Failed to fetch trains", { cause: response.statusText });
	}

	const data = await response.json();

	const filteredData = data
		.filter((train: Train) => {
			// Check if train is a commuter train
			if (train.trainCategory !== "Commuter") {
				return false;
			}

			// Filter timeTableRows to only include origin and destination stations
			train.timeTableRows = train.timeTableRows.filter(
				(row: TimeTableRow) =>
					row.stationShortCode === destinationCode ||
					row.stationShortCode === stationCode,
			);

			// Get the rows for origin and destination
			const originRow = train.timeTableRows.find(
				(row: TimeTableRow) => row.stationShortCode === stationCode,
			);
			const destinationRow = train.timeTableRows.find(
				(row: TimeTableRow) => row.stationShortCode === destinationCode,
			);

			// Check if both stations exist and destination is after origin
			return (
				originRow &&
				destinationRow &&
				new Date(originRow.scheduledTime) <
					new Date(destinationRow.scheduledTime)
			);
		})
		.sort((a: Train, b: Train) => {
			const aDeparture = a.timeTableRows.find(
				(row: TimeTableRow) => row.stationShortCode === stationCode,
			)?.scheduledTime;
			const bDeparture = b.timeTableRows.find(
				(row: TimeTableRow) => row.stationShortCode === stationCode,
			)?.scheduledTime;
			return (
				new Date(aDeparture ?? "").getTime() -
				new Date(bDeparture ?? "").getTime()
			);
		});

	return filteredData;
}
