import type { Config } from "@netlify/functions";
import { alertsEnabled } from "../lib/config";
import { handleAlertsRequest } from "../lib/handleAlertsRequest";
import { createBlobAlertStore } from "../lib/store";

export default (req: Request) =>
	handleAlertsRequest(req, {
		store: createBlobAlertStore(),
		now: new Date(),
		enabled: alertsEnabled(),
	});

export const config: Config = {
	path: "/api/alerts",
	rateLimit: {
		windowLimit: 30,
		windowSize: 60,
		aggregateBy: ["ip", "domain"],
	},
};
