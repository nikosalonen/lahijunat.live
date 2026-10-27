import { createHash } from "node:crypto";
import { isWithinRules } from "../../src/utils/passengerInfo";
import { BASELINE_GRACE_MS, MAX_BODY_CHARS } from "./config";
import type {
	AlertLang,
	AlertRecord,
	DigitrafficMessage,
	DigitrafficText,
	TrainRef,
} from "./types";

const FALLBACK_ORDER: AlertLang[] = ["fi", "en", "sv"];

const normalize = (value: string | null | undefined): string =>
	value?.replace(/\s+/g, " ").trim() ?? "";

function pickFromChannel(
	text: DigitrafficText | undefined,
	lang: AlertLang,
): string | null {
	if (!text) return null;
	for (const l of [lang, ...FALLBACK_ORDER]) {
		const value = normalize(text[l]);
		if (value) return value;
	}
	return null;
}

function hasText(text: DigitrafficText | undefined): boolean {
	return [text?.fi, text?.sv, text?.en].some((value) => normalize(value));
}

/**
 * Picks the announcement text to push: video channel first, then audio.
 * Within a channel the record's language wins, then fi, en, sv.
 */
export function pickAlertText(
	msg: DigitrafficMessage,
	lang: AlertLang,
): string | null {
	const text =
		pickFromChannel(msg.video?.text, lang) ??
		pickFromChannel(msg.audio?.text, lang);
	if (!text) return null;
	return text.length > MAX_BODY_CHARS
		? `${text.slice(0, MAX_BODY_CHARS - 1)}…`
		: text;
}

/** Short stable hash, used to notice when a message's text was edited. */
export function textHash(text: string): string {
	return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Hash of the message's fi, sv and en texts, from the channel pickAlertText
 * reads (video when it has text, else audio). It does not depend on the
 * record's language, so a language switch does not make a seen message look
 * edited.
 */
export function messageTextHash(msg: DigitrafficMessage): string {
	const channel = hasText(msg.video?.text) ? msg.video?.text : msg.audio?.text;
	return textHash(
		JSON.stringify([
			normalize(channel?.fi),
			normalize(channel?.sv),
			normalize(channel?.en),
		]),
	);
}

export function messagesForTrain(
	messages: DigitrafficMessage[],
	ref: TrainRef,
): DigitrafficMessage[] {
	return messages.filter(
		(m) =>
			m.trainNumber === ref.trainNumber &&
			m.trainDepartureDate === ref.departureDate,
	);
}

/**
 * A message the train card could already show when the train was marked is
 * not pushed. The card shows a train's message only when it lists the
 * rider's `from` or `to` station, has video text and is inside its video
 * delivery window. Anything else the rider has not seen, so it is pushed.
 * The grace period covers the app's own polling lag.
 */
export function isBaseline(
	msg: DigitrafficMessage,
	record: Pick<AlertRecord, "from" | "to" | "createdAt">,
): boolean {
	const versionTime = Date.parse(msg.creationDateTime ?? msg.startValidity);
	const createdAt = Date.parse(record.createdAt);
	const liveBeforeMarking = versionTime <= createdAt - BASELINE_GRACE_MS;
	if (!liveBeforeMarking) return false;
	if (
		!msg.stations.includes(record.from) &&
		!msg.stations.includes(record.to)
	) {
		return false;
	}
	if (!hasText(msg.video?.text)) return false;
	return isWithinRules(msg.video?.deliveryRules, new Date(createdAt));
}
