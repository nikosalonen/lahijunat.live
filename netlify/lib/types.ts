import type { VideoDeliveryRules } from "../../src/utils/passengerInfo";

export type AlertLang = "fi" | "sv" | "en";

export interface PushKeys {
	p256dh: string;
	auth: string;
}

/** One stored subscription for one train. */
export interface AlertRecord {
	endpoint: string;
	keys: PushKeys;
	trainNumber: number;
	departureDate: string; // Helsinki origin date, YYYY-MM-DD
	from: string; // uppercase station codes
	to: string;
	fromName: string;
	toName: string;
	title: string;
	lang: AlertLang;
	removeAfter: string; // ISO
	sent: Record<string, string>; // message id -> textHash
	cancelSent: boolean;
	createdAt: string; // ISO, server time of first POST
}

export interface DigitrafficText {
	fi: string | null;
	sv: string | null;
	en: string | null;
}

export interface DigitrafficMessage {
	id: string;
	version?: number;
	creationDateTime?: string;
	startValidity: string;
	endValidity: string;
	trainNumber: number | null;
	trainDepartureDate: string | null;
	stations: string[];
	/** The rules say when station screens and the app show the message. */
	video?: { text: DigitrafficText; deliveryRules?: VideoDeliveryRules };
	audio?: { text: DigitrafficText };
}

export interface TrainRow {
	station: string;
	type: "ARRIVAL" | "DEPARTURE";
	cancelled: boolean;
	scheduledTime: string;
	liveEstimateTime: string | null;
	actualTime: string | null;
}

export interface TrainStatus {
	trainNumber: number;
	departureDate: string;
	cancelled: boolean;
	rows: TrainRow[];
}

export interface TrainRef {
	trainNumber: number;
	departureDate: string;
}

export type PushMark =
	| { kind: "message"; id: string; hash: string }
	| { kind: "cancel" };

export interface AlertPush {
	recordKey: string;
	tag: string;
	title: string;
	body: string;
	url: string;
	lang: AlertLang;
	ttlSeconds: number;
	mark: PushMark;
}

export interface StoredRecord {
	key: string;
	etag: string;
	record: AlertRecord;
}
