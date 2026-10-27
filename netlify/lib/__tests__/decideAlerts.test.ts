// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decideAlerts, withoutMark } from "../decideAlerts";
import { cancelledText, doesNotStopText } from "../i18n";
import type {
	AlertRecord,
	DigitrafficMessage,
	StoredRecord,
	TrainRow,
	TrainStatus,
} from "../types";

const now = new Date("2026-10-27T06:20:00Z");
const siteUrl = "https://www.lahijunat.live";

const rec = (over: Partial<AlertRecord> = {}): StoredRecord => ({
	key: "sub/abc/2026-10-27-9638",
	etag: "e1",
	record: {
		endpoint: "https://fcm.googleapis.com/x",
		keys: { p256dh: "p", auth: "a" },
		trainNumber: 9638,
		departureDate: "2026-10-27",
		from: "RI",
		to: "HKI",
		fromName: "Riihimäki",
		toName: "Helsinki",
		title: "9638 Riihimäki → Helsinki",
		lang: "fi",
		removeAfter: "2026-10-27T08:00:00Z",
		sent: {},
		cancelSent: false,
		createdAt: "2026-10-27T06:00:00Z",
		...over,
	},
});

const msg = (over: Partial<DigitrafficMessage> = {}): DigitrafficMessage => ({
	id: "MVM1",
	version: 1,
	creationDateTime: "2026-10-27T06:19:00Z",
	startValidity: "2026-10-27T06:19:00Z",
	endValidity: "2026-10-29T00:00:00Z",
	trainNumber: 9638,
	trainDepartureDate: "2026-10-27",
	stations: ["RI", "HKI"],
	video: { text: { fi: "Teksti yksi", sv: null, en: "Text one" } },
	...over,
});

const row = (over: Partial<TrainRow> = {}): TrainRow => ({
	station: "RI",
	type: "DEPARTURE",
	cancelled: false,
	scheduledTime: "2026-10-27T07:50:00Z",
	liveEstimateTime: null,
	actualTime: null,
	...over,
});

const arrivalRow = (over: Partial<TrainRow> = {}): TrainRow =>
	row({
		station: "HKI",
		type: "ARRIVAL",
		scheduledTime: "2026-10-27T08:40:00Z",
		...over,
	});

const train = (over: Partial<TrainStatus> = {}): TrainStatus => ({
	trainNumber: 9638,
	departureDate: "2026-10-27",
	cancelled: false,
	rows: [row(), arrivalRow()],
	...over,
});

const run = (
	records: StoredRecord[],
	messages: DigitrafficMessage[] | null,
	trains: TrainStatus[] | null,
	at = now,
) => decideAlerts({ records, messages, trains, now: at, siteUrl });

describe("decideAlerts messages", () => {
	it("pushes a new message once", () => {
		const first = run([rec()], [msg()], [train()]);
		expect(first.pushes).toHaveLength(1);
		expect(first.pushes[0]).toMatchObject({
			tag: "MVM1",
			body: "Teksti yksi",
			url: "https://www.lahijunat.live/ri/hki",
			title: "9638 Riihimäki → Helsinki",
			recordKey: "sub/abc/2026-10-27-9638",
			lang: "fi",
		});
		expect(first.pushes[0].mark.kind).toBe("message");
		expect(first.updates).toHaveLength(1);
		const second = run([first.updates[0]], [msg()], [train()]);
		expect(second.pushes).toHaveLength(0);
	});

	it("does not push a message that was live when the train was marked", () => {
		const r = rec({ createdAt: "2026-10-27T06:30:00Z" });
		const d = run([r], [msg()], [train()]);
		expect(d.pushes).toHaveLength(0);
		expect(d.updates[0].record.sent.MVM1).toBeTruthy();
	});

	it("pushes again when the text changes, not when only the version changes", () => {
		const first = run([rec()], [msg()], [train()]);
		const stored = first.updates[0];
		const versionOnly = run([stored], [msg({ version: 2 })], [train()]);
		expect(versionOnly.pushes).toHaveLength(0);
		const edited = run(
			[stored],
			[
				msg({
					version: 2,
					video: { text: { fi: "Uusi", sv: null, en: null } },
				}),
			],
			[train()],
		);
		expect(edited.pushes).toHaveLength(1);
		expect(edited.pushes[0].body).toBe("Uusi");
	});

	it("pushes a message the card could not show yet when the train was marked", () => {
		// Helsinki time: created 07:10, shown from 08:00, train marked at 07:30.
		const notShownYet = msg({
			creationDateTime: "2026-10-27T05:10:00Z",
			startValidity: "2026-10-27T05:10:00Z",
			video: {
				text: { fi: "Teksti yksi", sv: null, en: null },
				deliveryRules: {
					startDateTime: "2026-10-27T05:10:00Z",
					endDateTime: "2026-10-27T10:00:00Z",
					startTime: "8:00",
					endTime: "12:00",
					weekDays: [],
					deliveryType: "WHEN",
				},
			},
		});
		const d = run(
			[rec({ createdAt: "2026-10-27T05:30:00Z" })],
			[notShownYet],
			[train()],
		);
		expect(d.pushes).toHaveLength(1);
	});

	it("does not push a seen message again after the app language changes", () => {
		const baselined = run(
			[rec({ createdAt: "2026-10-27T06:30:00Z" })],
			[msg()],
			[train()],
		);
		expect(baselined.pushes).toHaveLength(0);
		const stored = baselined.updates[0];
		// A re-POST after a language switch replaces lang and keeps sent.
		const switched: StoredRecord = {
			...stored,
			record: { ...stored.record, lang: "en" },
		};
		expect(run([switched], [msg()], [train()]).pushes).toHaveLength(0);
	});

	it("pushes an edit in a language other than the record's", () => {
		const first = run([rec()], [msg()], [train()]);
		const edited = run(
			[first.updates[0]],
			[
				msg({
					video: {
						text: { fi: "Teksti yksi", sv: "Ny text", en: "Text one" },
					},
				}),
			],
			[train()],
		);
		expect(edited.pushes).toHaveLength(1);
		expect(edited.pushes[0].body).toBe("Teksti yksi");
	});

	it("ignores messages for other trains", () => {
		const d = run([rec()], [msg({ trainNumber: 1 })], [train()]);
		expect(d.pushes).toHaveLength(0);
	});
});

describe("decideAlerts cancellations", () => {
	it("pushes a whole-train cancellation once", () => {
		const t = train({ cancelled: true });
		const first = run([rec()], [], [t]);
		expect(first.pushes).toHaveLength(1);
		expect(first.pushes[0]).toMatchObject({
			body: cancelledText("fi"),
			tag: "cancel-9638-2026-10-27",
			mark: { kind: "cancel" },
		});
		expect(first.updates[0].record.cancelSent).toBe(true);
		expect(run([first.updates[0]], [], [t]).pushes).toHaveLength(0);
	});

	it("pushes doesNotStopText(fromName) when only the from-row is cancelled", () => {
		const t = train({ rows: [row({ cancelled: true }), arrivalRow()] });
		const d = run([rec()], [], [t]);
		expect(d.pushes[0].body).toBe(doesNotStopText("fi", "Riihimäki"));
	});

	it("pushes doesNotStopText(toName) when only the to-row is cancelled", () => {
		const t = train({ rows: [row(), arrivalRow({ cancelled: true })] });
		const d = run([rec()], [], [t]);
		expect(d.pushes[0].body).toBe(doesNotStopText("fi", "Helsinki"));
	});

	it("skips cancellations when trains is null but still checks messages", () => {
		const d = run([rec()], [msg()], null);
		expect(d.pushes).toHaveLength(1);
		expect(d.pushes[0].tag).toBe("MVM1");
	});

	it("skips messages when messages is null but still checks cancellations", () => {
		const d = run([rec()], null, [train({ cancelled: true })]);
		expect(d.pushes).toHaveLength(1);
		expect(d.pushes[0].tag).toBe("cancel-9638-2026-10-27");
	});
});

describe("decideAlerts removeAfter and expiry", () => {
	it("moves removeAfter to live estimate + 10 min when drift > 1 min", () => {
		const t = train({
			rows: [row({ liveEstimateTime: "2026-10-27T07:30:00Z" }), arrivalRow()],
		});
		const d = run([rec()], [], [t]);
		expect(d.updates[0].record.removeAfter).toBe("2026-10-27T07:40:00.000Z");
	});

	it("prefers actualTime over the live estimate", () => {
		const t = train({
			rows: [
				row({
					actualTime: "2026-10-27T07:00:00Z",
					liveEstimateTime: "2026-10-27T07:30:00Z",
				}),
				arrivalRow(),
			],
		});
		const d = run([rec()], [], [t]);
		expect(d.updates[0].record.removeAfter).toBe("2026-10-27T07:10:00.000Z");
	});

	it("keeps removeAfter when drift is within 1 min", () => {
		const t = train({
			rows: [row({ scheduledTime: "2026-10-27T07:50:30Z" }), arrivalRow()],
		});
		const d = run([rec({ removeAfter: "2026-10-27T08:00:00Z" })], [], [t]);
		expect(d.updates).toHaveLength(0);
	});

	it("deletes a record past removeAfter", () => {
		const d = run(
			[rec({ removeAfter: "2026-10-27T06:19:00Z" })],
			[msg()],
			null,
		);
		expect(d.deletes).toEqual(["sub/abc/2026-10-27-9638"]);
		expect(d.pushes).toHaveLength(0);
		expect(d.updates).toHaveLength(0);
	});

	it("deletes a record whose departureDate is before yesterday", () => {
		const d = run(
			[
				rec({
					departureDate: "2026-10-25",
					removeAfter: "2026-10-28T00:00:00Z",
				}),
			],
			null,
			null,
		);
		expect(d.deletes).toHaveLength(1);
	});

	it("keeps a record from yesterday", () => {
		const d = run(
			[
				rec({
					departureDate: "2026-10-26",
					removeAfter: "2026-10-28T00:00:00Z",
				}),
			],
			null,
			null,
		);
		expect(d.deletes).toHaveLength(0);
	});
});

describe("decideAlerts ring trains", () => {
	// I and P trains pass Pasila twice: HKI → PSL → … → PSL → HKI.
	const ringRecord = (over: Partial<AlertRecord> = {}) =>
		rec({
			from: "PSL",
			to: "HKI",
			fromName: "Pasila",
			toName: "Helsinki",
			title: "I 08:25 Pasila → Helsinki",
			removeAfter: "2026-10-27T06:35:00Z",
			...over,
		});
	const ringTrain = (
		firstPasila: Partial<TrainRow> = {},
		secondPasila: Partial<TrainRow> = {},
	) =>
		train({
			rows: [
				row({ station: "HKI", scheduledTime: "2026-10-27T05:20:00Z" }),
				arrivalRow({ station: "PSL", scheduledTime: "2026-10-27T05:25:00Z" }),
				row({
					station: "PSL",
					scheduledTime: "2026-10-27T05:26:00Z",
					...firstPasila,
				}),
				arrivalRow({ station: "LEN", scheduledTime: "2026-10-27T05:50:00Z" }),
				row({ station: "LEN", scheduledTime: "2026-10-27T05:51:00Z" }),
				arrivalRow({ station: "PSL", scheduledTime: "2026-10-27T06:24:00Z" }),
				row({
					station: "PSL",
					scheduledTime: "2026-10-27T06:25:00Z",
					...secondPasila,
				}),
				arrivalRow({ station: "HKI", scheduledTime: "2026-10-27T06:31:00Z" }),
			],
		});

	it("follows the second Pasila departure and keeps the record", () => {
		const t = ringTrain({}, { liveEstimateTime: "2026-10-27T06:28:00Z" });
		const d = run([ringRecord()], [], [t]);
		expect(d.deletes).toEqual([]);
		expect(d.updates[0].record.removeAfter).toBe("2026-10-27T06:38:00.000Z");
	});

	it("ignores a cancellation on the first Pasila pass", () => {
		const d = run([ringRecord()], [], [ringTrain({ cancelled: true })]);
		expect(d.deletes).toEqual([]);
		expect(d.pushes).toHaveLength(0);
	});

	it("pushes a cancellation on the second Pasila pass", () => {
		const d = run([ringRecord()], [], [ringTrain({}, { cancelled: true })]);
		expect(d.pushes).toHaveLength(1);
		expect(d.pushes[0].body).toBe(doesNotStopText("fi", "Pasila"));
	});

	it("follows the live estimate before expiring the record", () => {
		const t = ringTrain({}, { liveEstimateTime: "2026-10-27T06:28:00Z" });
		const d = run(
			[ringRecord({ removeAfter: "2026-10-27T06:19:00Z" })],
			[],
			[t],
		);
		expect(d.deletes).toEqual([]);
		expect(d.updates[0].record.removeAfter).toBe("2026-10-27T06:38:00.000Z");
	});
});

describe("decideAlerts push fields", () => {
	it("url encodes lowercase station codes", () => {
		const d = run([rec({ from: "KÄP" })], [msg()], null);
		expect(d.pushes[0].url).toContain("/k%C3%A4p/");
	});

	it("ttlSeconds is at least 60", () => {
		const d = run(
			[rec({ removeAfter: "2026-10-27T06:20:10Z" })],
			[msg()],
			null,
		);
		expect(d.pushes[0].ttlSeconds).toBe(60);
	});

	it("ttlSeconds is the seconds until removeAfter", () => {
		const d = run([rec()], [msg()], null);
		expect(d.pushes[0].ttlSeconds).toBe(100 * 60);
	});

	it("does not mutate input records", () => {
		const r = rec();
		const copy = structuredClone(r);
		run([r], [msg()], [train({ cancelled: true })]);
		expect(r).toEqual(copy);
	});
});

describe("withoutMark", () => {
	it("removes a message mark", () => {
		const r = rec({ sent: { MVM1: "h", MVM2: "h2" } }).record;
		const out = withoutMark(r, { kind: "message", id: "MVM1", hash: "h" });
		expect(out.sent).toEqual({ MVM2: "h2" });
		expect(r.sent.MVM1).toBe("h");
	});
	it("resets cancelSent for a cancel mark", () => {
		const r = rec({ cancelSent: true }).record;
		expect(withoutMark(r, { kind: "cancel" }).cancelSent).toBe(false);
		expect(r.cancelSent).toBe(true);
	});
});
