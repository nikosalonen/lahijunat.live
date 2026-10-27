import type {
	DigitrafficMessage,
	TrainRef,
	TrainRow,
	TrainStatus,
} from "./types";

const ACTIVE_MESSAGES_URL =
	"https://rata.digitraffic.fi/api/v1/passenger-information/active";
const GRAPHQL_URL = "https://rata.digitraffic.fi/api/v2/graphql/graphql";

export const DIGITRAFFIC_HEADERS: Record<string, string> = {
	"Accept-Encoding": "gzip",
	"Digitraffic-User": "lahijunat.live/push-alerts",
};

/** A fetch that rejects after `ms`. Node's own fetch can wait minutes. */
export function fetchWithDeadline(
	ms: number,
	base: typeof fetch = fetch,
): typeof fetch {
	return (input, init) =>
		base(input, { ...init, signal: AbortSignal.timeout(ms) });
}

export async function fetchActiveMessages(
	fetchImpl: typeof fetch = fetch,
): Promise<DigitrafficMessage[]> {
	const response = await fetchImpl(ACTIVE_MESSAGES_URL, {
		method: "GET",
		headers: DIGITRAFFIC_HEADERS,
	});
	if (!response.ok) {
		throw new Error(`Digitraffic messages request failed: ${response.status}`);
	}
	const body: unknown = await response.json();
	// Fail this fetch, not the whole run, when a 200 carries something else.
	if (!Array.isArray(body)) {
		throw new Error("Digitraffic messages response is not an array");
	}
	return body as DigitrafficMessage[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The query is built by string interpolation, so refuse anything unexpected. */
function isValidRef(ref: TrainRef): boolean {
	return (
		Number.isInteger(ref.trainNumber) &&
		ref.trainNumber >= 1 &&
		ref.trainNumber <= 99999 &&
		typeof ref.departureDate === "string" &&
		DATE_PATTERN.test(ref.departureDate)
	);
}

/** Alias tN always refers to trains[N], even when other refs are skipped. */
export function buildTrainStatusQuery(trains: TrainRef[]): string {
	const fields: string[] = [];
	trains.forEach((train, index) => {
		if (!isValidRef(train)) return;
		fields.push(
			`t${index}: train(trainNumber: ${train.trainNumber}, departureDate: "${train.departureDate}") { trainNumber cancelled timeTableRows { type cancelled scheduledTime liveEstimateTime actualTime station { shortCode } } }`,
		);
	});
	return fields.length === 0 ? "" : `{ ${fields.join(" ")} }`;
}

interface GraphqlRow {
	type: TrainRow["type"];
	cancelled: boolean;
	scheduledTime: string;
	liveEstimateTime: string | null;
	actualTime: string | null;
	station: { shortCode: string };
}

interface GraphqlTrain {
	trainNumber: number;
	cancelled: boolean;
	timeTableRows: GraphqlRow[] | null;
}

interface GraphqlResponse {
	data?: Record<string, GraphqlTrain[] | null>;
	errors?: unknown[];
}

export async function fetchTrainStatuses(
	trains: TrainRef[],
	fetchImpl: typeof fetch = fetch,
): Promise<TrainStatus[]> {
	const query = buildTrainStatusQuery(trains);
	if (query === "") return [];

	const response = await fetchImpl(GRAPHQL_URL, {
		method: "POST",
		headers: { ...DIGITRAFFIC_HEADERS, "Content-Type": "application/json" },
		body: JSON.stringify({ query }),
	});
	if (!response.ok) {
		throw new Error(`Digitraffic GraphQL request failed: ${response.status}`);
	}
	const body = (await response.json()) as GraphqlResponse;
	if (body.errors?.length) {
		throw new Error(
			`Digitraffic GraphQL returned ${body.errors.length} error(s)`,
		);
	}

	const statuses: TrainStatus[] = [];
	trains.forEach((ref, index) => {
		if (!isValidRef(ref)) return;
		const train = body.data?.[`t${index}`]?.[0];
		if (!train) return;
		statuses.push({
			trainNumber: train.trainNumber,
			departureDate: ref.departureDate,
			cancelled: train.cancelled,
			rows: (train.timeTableRows ?? []).map((row) => ({
				station: row.station.shortCode,
				type: row.type,
				cancelled: row.cancelled,
				scheduledTime: row.scheduledTime,
				liveEstimateTime: row.liveEstimateTime,
				actualTime: row.actualTime,
			})),
		});
	});
	return statuses;
}
