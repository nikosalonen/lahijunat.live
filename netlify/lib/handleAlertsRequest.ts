import { MAX_PER_ENDPOINT, MAX_RECORDS, MAX_TRAINS } from "./config";
import {
	type AlertStore,
	endpointPrefix,
	recordKey,
	trainOfKey,
} from "./store";
import type { AlertRecord } from "./types";
import {
	parseDeleteBody,
	parseSubscribeBody,
	type SubscribeInput,
} from "./validate";

export interface AlertsDeps {
	store: AlertStore;
	now: Date;
	enabled: boolean;
}

const MAX_BODY_BYTES = 8192;

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
const noContent = () => new Response(null, { status: 204 });

/**
 * A form or text/plain POST from another site needs no CORS preflight.
 * Requiring JSON keeps such cross-site requests out.
 */
function isJson(request: Request): boolean {
	const type = request.headers.get("Content-Type") ?? "";
	return type.split(";")[0].trim().toLowerCase() === "application/json";
}

/**
 * Read the body as text, giving up as soon as it passes MAX_BODY_BYTES so a
 * large body is never buffered whole. Returns null when it is too large.
 */
async function readBodyWithLimit(request: Request): Promise<string | null> {
	const declared = Number(request.headers.get("Content-Length"));
	if (declared > MAX_BODY_BYTES) return null;
	if (!request.body) return "";

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_BODY_BYTES) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

/** Everything except the job's bookkeeping (`sent`, `cancelSent`, `createdAt`). */
function routeFields(input: SubscribeInput) {
	return {
		endpoint: input.subscription.endpoint,
		keys: input.subscription.keys,
		trainNumber: input.trainNumber,
		departureDate: input.departureDate,
		from: input.from,
		to: input.to,
		fromName: input.fromName,
		toName: input.toName,
		title: input.title,
		lang: input.lang,
		removeAfter: input.removeAfter,
	};
}

async function subscribe(
	input: SubscribeInput,
	{ store, now }: AlertsDeps,
): Promise<Response> {
	const endpoint = input.subscription.endpoint;
	const key = recordKey(endpoint, input);

	const existing = await store.get(key);
	if (!existing) {
		const all = await store.list("sub/");
		if (all.length >= MAX_RECORDS) return json(503, { error: "full" });
		const trains = new Set(all.map((entry) => trainOfKey(entry.key)));
		if (trains.size >= MAX_TRAINS && !trains.has(trainOfKey(key))) {
			return json(503, { error: "full" });
		}
		const mine = await store.list(endpointPrefix(endpoint));
		if (mine.length >= MAX_PER_ENDPOINT) {
			return json(429, { error: "too-many" });
		}

		const record: AlertRecord = {
			...routeFields(input),
			sent: {},
			// The rider already saw the cancellation on the card, so don't push it.
			cancelSent: input.cancelled,
			createdAt: now.toISOString(),
		};
		await store.put(key, record);
		return noContent();
	}

	// The job may update `sent` between our read and write. Re-merge and retry once.
	let current = existing;
	for (let attempt = 0; attempt < 2; attempt++) {
		const record: AlertRecord = {
			...routeFields(input),
			sent: current.record.sent,
			cancelSent: current.record.cancelSent,
			createdAt: current.record.createdAt,
		};
		if (await store.put(key, record, { onlyIfMatch: current.etag })) {
			return noContent();
		}
		const fresh = await store.get(key);
		// The record vanished (job cleanup or DELETE), so there is nothing to merge into.
		if (!fresh) return json(409, { error: "conflict" });
		current = fresh;
	}
	return json(409, { error: "conflict" });
}

async function remove(body: unknown, { store }: AlertsDeps): Promise<Response> {
	const parsed = parseDeleteBody(body);
	if (!parsed.ok) return json(400, { error: parsed.error });
	const { endpoint, trainNumber, departureDate } = parsed.value;

	if (trainNumber !== undefined && departureDate !== undefined) {
		await store.delete(recordKey(endpoint, { trainNumber, departureDate }));
	} else {
		const entries = await store.list(endpointPrefix(endpoint));
		await Promise.all(entries.map((entry) => store.delete(entry.key)));
	}
	return noContent();
}

export async function handleAlertsRequest(
	request: Request,
	deps: AlertsDeps,
): Promise<Response> {
	if (!deps.enabled) return json(503, { error: "disabled" });
	if (request.method !== "POST" && request.method !== "DELETE") {
		return new Response(null, {
			status: 405,
			headers: { Allow: "POST, DELETE" },
		});
	}
	if (!isJson(request)) return json(415, { error: "unsupported media type" });

	const text = await readBodyWithLimit(request);
	if (text === null) return json(413, { error: "too large" });
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return json(400, { error: "invalid json" });
	}

	if (request.method === "DELETE") return remove(body, deps);
	const parsed = parseSubscribeBody(body, deps.now);
	if (!parsed.ok) return json(400, { error: parsed.error });
	return subscribe(parsed.value, deps);
}
