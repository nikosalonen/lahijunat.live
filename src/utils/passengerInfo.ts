/** @format */

import { helsinkiParts, toMinutes, type Weekday } from "./helsinkiTime";

export interface VideoDeliveryRules {
	startDateTime: string; // ISO UTC
	endDateTime: string; // ISO UTC
	startTime?: string; // Helsinki wall-clock "H:mm" or "HH:mm"
	endTime?: string;
	weekDays: Weekday[];
	deliveryType: "CONTINUOS_VISUALIZATION" | "WHEN";
}

export interface VideoChannel {
	text: {
		fi: string | null;
		sv: string | null;
		en: string | null;
	};
	deliveryRules?: VideoDeliveryRules;
}

export interface PassengerInformationMessage {
	id: string;
	version?: number;
	creationDateTime?: string;
	startValidity: string;
	endValidity: string;
	trainNumber: number | null;
	trainDepartureDate: string | null;
	stations: string[];
	video?: VideoChannel;
	/* Audio channel intentionally omitted — feature is video-only. */
}

export interface ActiveMessage {
	id: string;
	text: string;
	trainNumber: number | null;
	trainDepartureDate: string | null;
	startValidity: string;
	endValidity: string;
}

/**
 * Pick the displayable text for the active language from the video channel.
 * Falls back lang → en → fi → sv. Returns null when the message has no
 * displayable video text (audio is ignored intentionally).
 */
export function pickDisplay(
	msg: PassengerInformationMessage,
	lang: string,
): { text: string; rules: VideoDeliveryRules | undefined } | null {
	const video = msg.video;
	if (!video) return null;
	const text =
		(video.text as Record<string, string | null>)[lang] ??
		video.text.en ??
		video.text.fi ??
		video.text.sv ??
		null;
	if (!text) return null;
	return { text, rules: video.deliveryRules };
}

function inWeekdays(
	weekDays: Weekday[] | undefined,
	weekday: Weekday,
): boolean {
	if (!weekDays || weekDays.length === 0) return true;
	return weekDays.includes(weekday);
}

/**
 * Determine whether a video deliveryRules window currently covers `now`.
 *
 * Two delivery types are supported:
 *
 * - `CONTINUOS_VISUALIZATION` is a single continuous window between
 *   (startDateTime + startTime) and (endDateTime + endTime), gated by
 *   weekDays. The startTime/endTime modify the start/end of the overall
 *   window only — they do NOT create a daily on/off cycle.
 * - `WHEN` is a daily time-of-day window within the outer date range,
 *   honouring weekDays. Handles overnight wrap when startTime > endTime.
 *
 * No rules → true (rely on the server's outer validity).
 */
export function isWithinRules(
	rules: VideoDeliveryRules | undefined,
	now: Date,
): boolean {
	if (!rules) return true;

	const nowMs = now.getTime();
	const here = helsinkiParts(now);

	if (rules.deliveryType === "CONTINUOS_VISUALIZATION") {
		const startMs = applyTimeOfDayToInstant(
			rules.startDateTime,
			rules.startTime,
		);
		const endMs = applyTimeOfDayToInstant(rules.endDateTime, rules.endTime);
		if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
		if (nowMs < startMs || nowMs >= endMs) return false;
		return inWeekdays(rules.weekDays, here.weekday);
	}

	// WHEN
	const outerStartMs = new Date(rules.startDateTime).getTime();
	const outerEndMs = new Date(rules.endDateTime).getTime();
	if (Number.isNaN(outerStartMs) || Number.isNaN(outerEndMs)) return false;
	if (nowMs < outerStartMs || nowMs >= outerEndMs) return false;
	if (!inWeekdays(rules.weekDays, here.weekday)) return false;

	const startMin = toMinutes(rules.startTime);
	const endMin = toMinutes(rules.endTime);
	if (startMin == null || endMin == null) {
		// Without a daily window, fall back to outer-window membership.
		return true;
	}
	const currentMin = here.hour * 60 + here.minute;
	if (startMin === endMin) return false;
	if (startMin < endMin) {
		return currentMin >= startMin && currentMin < endMin;
	}
	// Overnight wrap (e.g. 22:00–06:00)
	return currentMin >= startMin || currentMin < endMin;
}

/**
 * Compose an instant from a UTC datetime plus an optional Helsinki wall-clock
 * time-of-day override. Returns the original instant when no override applies.
 */
function applyTimeOfDayToInstant(
	isoUtc: string,
	timeOfDay: string | undefined,
): number {
	const baseMs = new Date(isoUtc).getTime();
	const mins = toMinutes(timeOfDay);
	if (mins == null) return baseMs;
	// Take the Helsinki-local calendar date of the base instant and combine it
	// with the override time-of-day. Build the resulting instant via UTC math
	// using the Helsinki offset at that instant.
	const baseParts = helsinkiParts(new Date(baseMs));
	const [year, month, day] = baseParts.date.split("-").map(Number);
	const targetHour = Math.floor(mins / 60);
	const targetMinute = mins % 60;
	// Recover the Helsinki UTC offset (in ms) at the base instant.
	const baseHelsinkiMs = Date.UTC(
		year,
		month - 1,
		day,
		baseParts.hour,
		baseParts.minute,
	);
	const offsetMs = baseHelsinkiMs - baseMs;
	const targetHelsinkiMs = Date.UTC(
		year,
		month - 1,
		day,
		targetHour,
		targetMinute,
	);
	return targetHelsinkiMs - offsetMs;
}

/**
 * Filter raw messages down to the active set and route them into the
 * general-banner pool and a per-train key map.
 */
export function partitionActiveMessages(
	messages: PassengerInformationMessage[],
	now: Date,
	lang: string,
	displayedTrainKeys: Set<string>,
): {
	general: ActiveMessage[];
	perTrain: Map<string, ActiveMessage[]>;
} {
	const general: ActiveMessage[] = [];
	const perTrain = new Map<string, ActiveMessage[]>();
	const seen = new Set<string>();

	for (const msg of messages) {
		if (seen.has(msg.id)) continue;
		seen.add(msg.id);

		const display = pickDisplay(msg, lang);
		if (!display) continue;
		if (!isWithinRules(display.rules, now)) continue;

		const active: ActiveMessage = {
			id: msg.id,
			text: display.text,
			trainNumber: msg.trainNumber,
			trainDepartureDate: msg.trainDepartureDate,
			startValidity: msg.startValidity,
			endValidity: msg.endValidity,
		};

		if (msg.trainNumber == null) {
			general.push(active);
			continue;
		}

		if (!msg.trainDepartureDate) continue;
		const key = `${msg.trainNumber}_${msg.trainDepartureDate}`;
		if (!displayedTrainKeys.has(key)) continue;
		const existing = perTrain.get(key);
		if (existing) {
			existing.push(active);
		} else {
			perTrain.set(key, [active]);
		}
	}

	return { general, perTrain };
}

/**
 * Build the per-train key used to match a displayed train against incoming
 * messages. `trainDepartureDate` is the train's first-origin departure date
 * (which may be the previous calendar day for midnight-crossing trains).
 */
export function trainMessageKey(
	trainNumber: number | string,
	trainDepartureDate: string,
): string {
	return `${trainNumber}_${trainDepartureDate}`;
}
