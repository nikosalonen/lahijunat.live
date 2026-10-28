import { helsinkiParts } from "../../src/utils/helsinkiTime";
import { cancelledText, doesNotStopText } from "./i18n";
import {
	isBaseline,
	messagesForTrain,
	messageTextHash,
	pickAlertText,
} from "./messages";
import type {
	AlertPush,
	AlertRecord,
	DigitrafficMessage,
	PushMark,
	StoredRecord,
	TrainRow,
	TrainStatus,
} from "./types";

export interface AlertDecision {
	pushes: AlertPush[];
	/** Records whose content changed, with the etag they were read with. */
	updates: StoredRecord[];
	/** Record keys. */
	deletes: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REMOVE_AFTER_DELAY_MS = 10 * 60_000;
const REMOVE_AFTER_DRIFT_MS = 60_000;
const MIN_TTL_SECONDS = 60;

/**
 * Past its removeAfter, or from before yesterday's Helsinki date. The date
 * check is a hard cap in case removeAfter never moves into the past.
 */
export function isExpired(record: AlertRecord, now: Date): boolean {
	const yesterday = helsinkiParts(new Date(now.getTime() - DAY_MS)).date;
	return (
		Date.parse(record.removeAfter) <= now.getTime() ||
		record.departureDate < yesterday
	);
}

/** Undo the bookkeeping of a push that failed to send, so it is retried. */
export function withoutMark(record: AlertRecord, mark: PushMark): AlertRecord {
	if (mark.kind === "cancel") return { ...record, cancelSent: false };
	const sent = { ...record.sent };
	if (mark.previousHash === undefined) delete sent[mark.id];
	else sent[mark.id] = mark.previousHash;
	return { ...record, sent };
}

function findTrain(
	trains: TrainStatus[],
	record: AlertRecord,
): TrainStatus | undefined {
	return trains.find(
		(t) =>
			t.trainNumber === record.trainNumber &&
			t.departureDate === record.departureDate,
	);
}

interface Segment {
	departure: TrainRow;
	arrival: TrainRow;
}

/**
 * The rider's part of the trip: a departure at `from` followed by an arrival
 * at `to`. Ring trains (I, P) pass Pasila and Helsinki twice, so when several
 * pairs qualify the shortest ride wins.
 */
function findSegment(
	rows: TrainRow[],
	from: string,
	to: string,
): Segment | null {
	let best: Segment | null = null;
	let bestLength = Number.POSITIVE_INFINITY;
	// The closest departure before an arrival gives that arrival's shortest ride.
	let lastDeparture = -1;
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		if (row.type === "ARRIVAL" && row.station === to && lastDeparture >= 0) {
			if (index - lastDeparture < bestLength) {
				best = { departure: rows[lastDeparture], arrival: row };
				bestLength = index - lastDeparture;
			}
		}
		if (row.type === "DEPARTURE" && row.station === from) {
			lastDeparture = index;
		}
	}
	return best;
}

/** Moves removeAfter to the live departure estimate plus 10 minutes. */
function followLiveEstimate(record: AlertRecord, departure: TrainRow): void {
	const time =
		departure.actualTime ??
		departure.liveEstimateTime ??
		departure.scheduledTime;
	const target = Date.parse(time) + REMOVE_AFTER_DELAY_MS;
	if (Number.isNaN(target)) return;
	if (
		Math.abs(target - Date.parse(record.removeAfter)) > REMOVE_AFTER_DRIFT_MS
	) {
		record.removeAfter = new Date(target).toISOString();
	}
}

/** Returns the notification body if the train or the rider's segment is cancelled. */
function cancellationBody(
	record: AlertRecord,
	status: TrainStatus,
	segment: Segment | null,
): string | null {
	if (status.cancelled) return cancelledText(record.lang);
	if (segment?.departure.cancelled) {
		return doesNotStopText(record.lang, record.fromName);
	}
	if (segment?.arrival.cancelled) {
		return doesNotStopText(record.lang, record.toName);
	}
	return null;
}

export function decideAlerts(input: {
	records: StoredRecord[];
	messages: DigitrafficMessage[] | null;
	trains: TrainStatus[] | null;
	now: Date;
	siteUrl: string;
}): AlertDecision {
	const { messages, trains, now, siteUrl } = input;
	const decision: AlertDecision = { pushes: [], updates: [], deletes: [] };

	for (const stored of input.records) {
		const record: AlertRecord = {
			...stored.record,
			sent: { ...stored.record.sent },
		};

		// 1. Follow the live estimate.
		const status = trains ? findTrain(trains, record) : undefined;
		const segment = status
			? findSegment(status.rows, record.from, record.to)
			: null;
		if (segment) followLiveEstimate(record, segment.departure);

		// 2. Expire.
		if (isExpired(record, now)) {
			decision.deletes.push(stored.key);
			continue;
		}

		const url = `${siteUrl}/${encodeURIComponent(record.from.toLowerCase())}/${encodeURIComponent(record.to.toLowerCase())}`;
		const ttlSeconds = Math.max(
			MIN_TTL_SECONDS,
			Math.floor((Date.parse(record.removeAfter) - now.getTime()) / 1000),
		);
		const push = (tag: string, body: string, mark: PushMark) => {
			decision.pushes.push({
				recordKey: stored.key,
				tag,
				title: record.title,
				body,
				url,
				lang: record.lang,
				ttlSeconds,
				mark,
			});
		};

		// 3. Cancellation.
		if (status && !record.cancelSent) {
			const body = cancellationBody(record, status, segment);
			if (body !== null) {
				push(`cancel-${record.trainNumber}-${record.departureDate}`, body, {
					kind: "cancel",
				});
				record.cancelSent = true;
			}
		}

		// 4. Announcements.
		if (messages) {
			for (const msg of messagesForTrain(messages, record)) {
				const text = pickAlertText(msg, record.lang);
				if (text === null) continue;
				const hash = messageTextHash(msg);
				if (record.sent[msg.id] === hash) continue;
				const previousHash = record.sent[msg.id];
				record.sent[msg.id] = hash;
				if (previousHash === undefined && isBaseline(msg, record)) continue;
				push(msg.id, text, {
					kind: "message",
					id: msg.id,
					hash,
					...(previousHash !== undefined && { previousHash }),
				});
			}
		}

		if (JSON.stringify(record) !== JSON.stringify(stored.record)) {
			decision.updates.push({ key: stored.key, etag: stored.etag, record });
		}
	}

	return decision;
}
