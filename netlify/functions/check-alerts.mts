import type { Config } from "@netlify/functions";
import { alertsEnabled, siteUrl } from "../lib/config";
import {
	fetchActiveMessages,
	fetchTrainStatuses,
	fetchWithDeadline,
} from "../lib/digitraffic";
import { runAlertCheck } from "../lib/runAlertCheck";
import { sendAlertPush } from "../lib/sendPush";
import { createBlobAlertStore } from "../lib/store";

// Leaves room for sends and writes inside the 30 s limit.
const DIGITRAFFIC_DEADLINE_MS = 5_000;

export default async () => {
	const fetchImpl = fetchWithDeadline(DIGITRAFFIC_DEADLINE_MS);
	const summary = await runAlertCheck({
		store: createBlobAlertStore(),
		now: new Date(),
		enabled: alertsEnabled(),
		siteUrl: siteUrl(),
		fetchMessages: () => fetchActiveMessages(fetchImpl),
		fetchTrains: (trains) => fetchTrainStatuses(trains, fetchImpl),
		send: (record, push) => sendAlertPush(record, push),
	});
	// Counts and flags only: never log endpoints, keys or titles.
	console.log(JSON.stringify(summary));
};

export const config: Config = { schedule: "* * * * *" };
