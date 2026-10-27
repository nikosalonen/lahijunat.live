// @vitest-environment node
import { describe, expect, it } from "vitest";
import { alertsEnabled, siteUrl } from "../config";
import {
	isBaseline,
	messagesForTrain,
	messageTextHash,
	pickAlertText,
	textHash,
} from "../messages";
import type { DigitrafficMessage, DigitrafficText } from "../types";

const msg = (over: Partial<DigitrafficMessage> = {}): DigitrafficMessage => ({
	id: "MVM1",
	version: 1,
	creationDateTime: "2026-10-27T06:19:00Z",
	startValidity: "2026-10-27T06:19:00Z",
	endValidity: "2026-10-29T00:00:00Z",
	trainNumber: 9638,
	trainDepartureDate: "2026-10-27",
	stations: ["RI", "HKI"],
	video: {
		text: {
			fi: "Ajetaan poikkeuksellisesti  vain yhdellä junayksiköllä.",
			sv: null,
			en: "Exceptionally, there will be only one train unit running today.",
		},
	},
	...over,
});

describe("pickAlertText", () => {
	it("picks the record language and collapses whitespace", () => {
		expect(pickAlertText(msg(), "fi")).toBe(
			"Ajetaan poikkeuksellisesti vain yhdellä junayksiköllä.",
		);
	});
	it("falls back to fi when sv is missing", () => {
		expect(pickAlertText(msg(), "sv")).toBe(
			"Ajetaan poikkeuksellisesti vain yhdellä junayksiköllä.",
		);
	});
	it("uses audio text when there is no video text", () => {
		expect(
			pickAlertText(
				msg({
					video: undefined,
					audio: { text: { fi: "Ääni", sv: null, en: null } },
				}),
				"en",
			),
		).toBe("Ääni");
	});
	it("returns null when no channel has text", () => {
		expect(pickAlertText(msg({ video: undefined }), "fi")).toBeNull();
	});
	it("trims long text to 1000 characters ending in …", () => {
		const text = pickAlertText(
			msg({ video: { text: { fi: "a".repeat(1500), sv: null, en: null } } }),
			"fi",
		);
		expect(text).toHaveLength(1000);
		expect(text?.endsWith("…")).toBe(true);
	});
});

describe("textHash", () => {
	it("hashes text to 16 hex characters, stable per input", () => {
		expect(textHash("x")).toMatch(/^[0-9a-f]{16}$/);
		expect(textHash("x")).toBe(textHash("x"));
		expect(textHash("x")).not.toBe(textHash("y"));
	});
});

describe("messageTextHash", () => {
	it("ignores whitespace differences", () => {
		const spaced = msg({
			video: { text: { fi: "  Teksti\n yksi ", sv: null, en: "Text one" } },
		});
		const plain = msg({
			video: { text: { fi: "Teksti yksi", sv: null, en: "Text one" } },
		});
		expect(messageTextHash(spaced)).toBe(messageTextHash(plain));
	});

	it("changes when any language changes", () => {
		const text: DigitrafficText = { fi: "Yksi", sv: null, en: "One" };
		const hashOf = (over: Partial<DigitrafficText>) =>
			messageTextHash(msg({ video: { text: { ...text, ...over } } }));
		const base = hashOf({});
		expect(hashOf({ fi: "Kaksi" })).not.toBe(base);
		expect(hashOf({ sv: "Ett" })).not.toBe(base);
		expect(hashOf({ en: "Two" })).not.toBe(base);
	});

	it("hashes the audio texts only when video has no text", () => {
		const audio = { text: { fi: "Ääni", sv: null, en: null } };
		expect(messageTextHash(msg({ audio }))).toBe(messageTextHash(msg()));
		const audioOnly = msg({ video: undefined, audio });
		const otherAudio = msg({
			video: undefined,
			audio: { text: { fi: "Toinen", sv: null, en: null } },
		});
		expect(messageTextHash(audioOnly)).not.toBe(messageTextHash(otherAudio));
	});
});

describe("messagesForTrain", () => {
	it("keeps only messages for the train and origin date", () => {
		const list = [
			msg(),
			msg({ id: "B", trainNumber: 9640 }),
			msg({ id: "C", trainDepartureDate: "2026-10-26" }),
			msg({ id: "D", trainNumber: null }),
		];
		expect(
			messagesForTrain(list, {
				trainNumber: 9638,
				departureDate: "2026-10-27",
			}).map((m) => m.id),
		).toEqual(["MVM1"]);
	});
});

describe("isBaseline", () => {
	const marked = (createdAt = "2026-10-27T06:21:00Z") => ({
		from: "RI",
		to: "HKI",
		createdAt,
	});
	const videoText: DigitrafficText = { fi: "Teksti", sv: null, en: null };
	// A daily window in Helsinki time. 06:21Z is 08:21 in Helsinki.
	const shownDaily = (startTime: string, endTime: string) =>
		msg({
			video: {
				text: videoText,
				deliveryRules: {
					startDateTime: "2026-10-26T00:00:00Z",
					endDateTime: "2026-10-29T00:00:00Z",
					startTime,
					endTime,
					weekDays: [],
					deliveryType: "WHEN",
				},
			},
		});

	it("treats a message as baseline when its version is 2+ minutes older than createdAt", () => {
		expect(isBaseline(msg(), marked("2026-10-27T06:21:00Z"))).toBe(true);
		expect(isBaseline(msg(), marked("2026-10-27T06:20:59Z"))).toBe(false);
	});
	it("falls back to startValidity when creationDateTime is missing", () => {
		expect(isBaseline(msg({ creationDateTime: undefined }), marked())).toBe(
			true,
		);
	});
	it("is baseline when the card showed it at createdAt", () => {
		expect(isBaseline(shownDaily("8:00", "9:00"), marked())).toBe(true);
	});
	it("is not baseline outside its display hours at createdAt", () => {
		expect(isBaseline(shownDaily("10:00", "12:00"), marked())).toBe(false);
	});
	it("is not baseline when it lists neither from nor to", () => {
		expect(isBaseline(msg({ stations: ["TPE"] }), marked())).toBe(false);
		expect(isBaseline(msg({ stations: ["HKI"] }), marked())).toBe(true);
	});
	it("is not baseline for an audio-only message", () => {
		const audioOnly = msg({ video: undefined, audio: { text: videoText } });
		expect(isBaseline(audioOnly, marked())).toBe(false);
	});
});

describe("config", () => {
	it("enables alerts unless explicitly turned off", () => {
		expect(alertsEnabled({})).toBe(true);
		expect(alertsEnabled({ PUBLIC_PUSH_ALERTS_ENABLED: "false" })).toBe(false);
	});
	it("defaults the site URL", () => {
		expect(siteUrl({})).toBe("https://www.lahijunat.live");
	});
});
