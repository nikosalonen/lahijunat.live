/** @format */
/**
 * Hand-rolled passenger-information fixtures for manual visual checks and
 * unit tests. The shapes mirror the live `/v1/passenger-information/active`
 * payload but only the video channel is populated (the feature is video-only).
 */

import type { PassengerInformationMessage } from "../../utils/passengerInfo";

const ALL_DAYS = [
	"MONDAY",
	"TUESDAY",
	"WEDNESDAY",
	"THURSDAY",
	"FRIDAY",
	"SATURDAY",
	"SUNDAY",
] as const;

export const generalContinuousMessage: PassengerInformationMessage = {
	id: "general-continuous-1",
	startValidity: "2026-05-03T00:00:00Z",
	endValidity: "2026-09-06T23:59:59Z",
	trainNumber: null,
	trainDepartureDate: null,
	stations: ["MLO"],
	video: {
		text: {
			fi: "Malminkartanon asema on suljettu 3.5.–6.9. kunnostustöiden vuoksi.",
			sv: "Malmgårds station är stängd 3.5.–6.9. på grund av reparationsarbeten.",
			en: "Malminkartano station is closed 3 May – 6 Sept for renovation works.",
		},
		deliveryRules: {
			deliveryType: "CONTINUOS_VISUALIZATION",
			startDateTime: "2026-05-03T00:00:00Z",
			endDateTime: "2026-09-06T23:59:59Z",
			weekDays: [...ALL_DAYS],
		},
	},
};

export const generalWindowedMessage: PassengerInformationMessage = {
	id: "general-window-1",
	startValidity: "2026-05-01T00:00:00Z",
	endValidity: "2026-12-31T23:59:59Z",
	trainNumber: null,
	trainDepartureDate: null,
	stations: ["HKI"],
	video: {
		text: {
			fi: "Kehäradan ratatöiden vuoksi junat saattavat olla myöhässä.",
			sv: null,
			en: "Trackwork on the Ring Rail may cause delays.",
		},
		deliveryRules: {
			deliveryType: "WHEN",
			startDateTime: "2026-05-01T00:00:00Z",
			endDateTime: "2026-12-31T23:59:59Z",
			startTime: "7:10",
			endTime: "22:00",
			weekDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
		},
	},
};

export const perTrainMessage: PassengerInformationMessage = {
	id: "train-1234-1",
	startValidity: "2026-05-28T05:00:00Z",
	endValidity: "2026-05-28T20:00:00Z",
	trainNumber: 1234,
	trainDepartureDate: "2026-05-28",
	stations: ["HKI", "PSL"],
	video: {
		text: {
			fi: "Junassa 1234 on ravintolavaunu poikkeuksellisesti suljettu.",
			sv: null,
			en: "Train 1234's restaurant car is closed today.",
		},
		deliveryRules: {
			deliveryType: "WHEN",
			startDateTime: "2026-05-28T05:00:00Z",
			endDateTime: "2026-05-28T20:00:00Z",
			startTime: "8:00",
			endTime: "22:00",
			weekDays: [...ALL_DAYS],
		},
	},
};

export const allFixtures: PassengerInformationMessage[] = [
	generalContinuousMessage,
	generalWindowedMessage,
	perTrainMessage,
];
