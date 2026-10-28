import { MAX_TRAINS } from "./config";
import { decideAlerts, isExpired, withoutMark } from "./decideAlerts";
import type { SendResult } from "./sendPush";
import { type AlertStore, endpointPrefix, trainOfKey } from "./store";
import type {
	AlertPush,
	AlertRecord,
	DigitrafficMessage,
	StoredRecord,
	TrainRef,
	TrainStatus,
} from "./types";

export interface RunSummary {
	skipped?: "disabled" | "empty";
	records: number;
	pushesSent: number;
	pushesFailed: number;
	deleted: number;
	/** Record reads that rejected. Those records are skipped this run. */
	readErrors: number;
	/** Blob deletes and puts that rejected. A lost conditional put is not an error. */
	writeErrors: number;
	messagesOk: boolean;
	trainsOk: boolean;
}

export interface RunDeps {
	store: AlertStore;
	now: Date;
	enabled: boolean;
	siteUrl: string;
	fetchMessages: () => Promise<DigitrafficMessage[]>;
	fetchTrains: (trains: TrainRef[]) => Promise<TrainStatus[]>;
	send: (record: AlertRecord, push: AlertPush) => Promise<SendResult>;
}

const emptySummary = (): RunSummary => ({
	records: 0,
	pushesSent: 0,
	pushesFailed: 0,
	deleted: 0,
	readErrors: 0,
	writeErrors: 0,
	messagesOk: true,
	trainsOk: true,
});

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
	return result.status === "fulfilled" ? result.value : null;
}

const rejectedCount = (results: PromiseSettledResult<unknown>[]) =>
	results.filter((r) => r.status === "rejected").length;

/** One rejected read must not stop the others, so it is skipped and counted. */
async function readRecords(
	store: AlertStore,
	keys: string[],
): Promise<{ records: StoredRecord[]; readErrors: number }> {
	const results = await Promise.allSettled(keys.map((key) => store.get(key)));
	const records = results
		.map(settledValue)
		.filter((r): r is StoredRecord => r !== null);
	return { records, readErrors: rejectedCount(results) };
}

/** The first MAX_TRAINS distinct trains, in key order. */
function trainRefs(records: StoredRecord[]): TrainRef[] {
	const seen = new Set<string>();
	const refs: TrainRef[] = [];
	for (const { key, record } of records) {
		const id = trainOfKey(key);
		if (seen.has(id)) continue;
		seen.add(id);
		refs.push({
			trainNumber: record.trainNumber,
			departureDate: record.departureDate,
		});
		if (refs.length === MAX_TRAINS) break;
	}
	return refs;
}

/**
 * Alerts are off: call no API, send nothing and write no meta, but still
 * delete expired records, because the privacy text promises that.
 */
async function deleteExpiredOnly(
	store: AlertStore,
	keys: string[],
	now: Date,
): Promise<RunSummary> {
	const { records, readErrors } = await readRecords(store, keys);
	const expired = records
		.filter(({ record }) => isExpired(record, now))
		.map(({ key }) => key);
	const results = await Promise.allSettled(
		expired.map((key) => store.delete(key)),
	);
	return {
		...emptySummary(),
		skipped: "disabled",
		records: records.length,
		deleted: expired.length,
		readErrors,
		writeErrors: rejectedCount(results),
	};
}

export async function runAlertCheck(deps: RunDeps): Promise<RunSummary> {
	const { store, now } = deps;
	const listed = await store.list("sub/");
	const keys = listed.map((item) => item.key).sort();
	if (!deps.enabled) return deleteExpiredOnly(store, keys, now);
	if (keys.length === 0) return { ...emptySummary(), skipped: "empty" };

	const { records, readErrors } = await readRecords(store, keys);

	const [messagesResult, trainsResult] = await Promise.allSettled([
		deps.fetchMessages(),
		deps.fetchTrains(trainRefs(records)),
	]);
	const messages = settledValue(messagesResult);
	const trains = settledValue(trainsResult);

	const decision = decideAlerts({
		records,
		messages,
		trains,
		now,
		siteUrl: deps.siteUrl,
	});

	const recordsByKey = new Map(records.map((r) => [r.key, r.record]));
	const updates = new Map(decision.updates.map((u) => [u.key, u]));
	const deletes = new Set(decision.deletes);
	const summary: RunSummary = {
		...emptySummary(),
		records: records.length,
		readErrors,
		messagesOk: messages !== null,
		trainsOk: trains !== null,
	};

	const results = await Promise.allSettled(
		decision.pushes.map((push) => {
			const record = recordsByKey.get(push.recordKey);
			if (!record) return Promise.resolve<SendResult>("failed");
			return deps.send(record, push);
		}),
	);

	decision.pushes.forEach((push, index) => {
		const result = settledValue(results[index]) ?? "failed";
		if (result === "sent") {
			summary.pushesSent++;
			return;
		}
		if (result === "gone") {
			const record = recordsByKey.get(push.recordKey);
			if (!record) return;
			const prefix = endpointPrefix(record.endpoint);
			for (const key of keys) if (key.startsWith(prefix)) deletes.add(key);
			return;
		}
		summary.pushesFailed++;
		if (result === "failed") {
			// Undo the mark so the next run tries again.
			const update = updates.get(push.recordKey);
			if (update) {
				updates.set(push.recordKey, {
					...update,
					record: withoutMark(update.record, push.mark),
				});
			}
		}
		// "dropped": the mark stays, so the push is never retried.
	});

	// Deletes and updates touch disjoint keys, so each phase can run in parallel.
	// One rejected write must not stop the others, or their marks would be lost.
	const deleteResults = await Promise.allSettled(
		[...deletes].map((key) => store.delete(key)),
	);
	summary.deleted = deletes.size;
	const liveUpdates = [...updates.values()].filter((u) => !deletes.has(u.key));
	const putResults = await Promise.allSettled(
		liveUpdates.map((u) => store.put(u.key, u.record, { onlyIfMatch: u.etag })),
	);
	summary.writeErrors = rejectedCount([...deleteResults, ...putResults]);

	await store.setMeta("meta/last-run", { at: now.toISOString(), ...summary });
	return summary;
}
