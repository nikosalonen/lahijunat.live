/** @format */

import { describe, expect, it } from "vitest";
import type { Train } from "../types";
import { getRelevantTrackInfo } from "./api";

describe("getRelevantTrackInfo", () => {
	// Helper function to create a mock train
	const createMockTrain = (
		trainNumber: string,
		trainType: string,
		timeTableRows: Array<{
			stationShortCode: string;
			type: "DEPARTURE" | "ARRIVAL";
			scheduledTime: string;
			commercialTrack: string;
		}>,
	): Train => ({
		trainNumber,
		trainType,
		operatorUICCode: "1",
		trainCategory: "Commuter",
		timeTableRows: timeTableRows.map((row) => ({
			...row,
			differenceInMinutes: 0,
			actualTime: row.scheduledTime,
			liveEstimateTime: row.scheduledTime,
			cancelled: false,
			trainStopping: true,
			commercialStop: true,
			station: {
				name: row.stationShortCode,
				shortCode: row.stationShortCode,
				location: {
					latitude: 0,
					longitude: 0,
				},
			},
		})),
		cancelled: false,
		commuterLineID: "",
	});

	it("should return null for train with no departures", () => {
		const train = createMockTrain("123", "I", [
			{
				stationShortCode: "HKI",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
		]);

		const result = getRelevantTrackInfo(train, "HKI", "PSL");
		expect(result).toBeNull();
	});

	it("should handle I train round trip between HKI and PSL", () => {
		const train = createMockTrain("123", "I", [
			{
				stationShortCode: "HKI",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:10:00Z",
				commercialTrack: "2",
			},

			{
				stationShortCode: "PSL",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:15:00Z",
				commercialTrack: "3",
			},
			{
				stationShortCode: "HKI",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:25:00Z",
				commercialTrack: "4",
			},
		]);

		// Test HKI departure
		const hkiResult = getRelevantTrackInfo(train, "HKI", "PSL");
		expect(hkiResult).toEqual({
			track: "1",
			timestamp: "2024-03-20T10:00:00Z",
			journeyKey: "123-HKI-PSL",
		});

		// Test PSL departure
		const pslResult = getRelevantTrackInfo(train, "PSL", "HKI");
		expect(pslResult).toEqual({
			track: "3",
			timestamp: "2024-03-20T10:15:00Z",
			journeyKey: "123-PSL-HKI",
		});
	});

	it("should handle P train with multiple stops", () => {
		const train = createMockTrain("456", "P", [
			{
				stationShortCode: "HKI",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:10:00Z",
				commercialTrack: "2",
			},
			{
				stationShortCode: "PSL",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:15:00Z",
				commercialTrack: "3",
			},
			{
				stationShortCode: "TKL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:30:00Z",
				commercialTrack: "4",
			},
			{
				stationShortCode: "TKL",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:35:00Z",
				commercialTrack: "5",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:50:00Z",
				commercialTrack: "6",
			},
			{
				stationShortCode: "PSL",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:55:00Z",
				commercialTrack: "7",
			},
			{
				stationShortCode: "HKI",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T11:05:00Z",
				commercialTrack: "8",
			},
		]);

		// Test HKI departure
		const hkiResult = getRelevantTrackInfo(train, "HKI", "TKL");
		expect(hkiResult).toEqual({
			track: "1",
			timestamp: "2024-03-20T10:00:00Z",
			journeyKey: "456-HKI-TKL",
		});

		// Test PSL departure
		const pslResult = getRelevantTrackInfo(train, "PSL", "HKI");
		expect(pslResult).toEqual({
			track: "7",
			timestamp: "2024-03-20T10:55:00Z",
			journeyKey: "456-PSL-HKI",
		});
	});

	it("should handle non-I/P train types", () => {
		const train = createMockTrain("789", "S", [
			{
				stationShortCode: "HKI",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:10:00Z",
				commercialTrack: "2",
			},
		]);

		const result = getRelevantTrackInfo(train, "HKI", "PSL");
		expect(result).toEqual({
			track: "1",
			timestamp: "2024-03-20T10:00:00Z",
			journeyKey: "789-HKI-PSL",
		});
	});

	it("should handle train with multiple departures from same station", () => {
		const train = createMockTrain("123", "I", [
			{
				stationShortCode: "HKI",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:10:00Z",
				commercialTrack: "2",
			},
			{
				stationShortCode: "PSL",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:15:00Z",
				commercialTrack: "3",
			},
			{
				stationShortCode: "HKI",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:25:00Z",
				commercialTrack: "4",
			},
			{
				stationShortCode: "HKI",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:30:00Z",
				commercialTrack: "5",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:40:00Z",
				commercialTrack: "6",
			},
		]);

		const result = getRelevantTrackInfo(train, "HKI", "PSL");
		expect(result).toEqual({
			track: "5",
			timestamp: "2024-03-20T10:30:00Z",
			journeyKey: "123-HKI-PSL",
		});
	});

	it("should handle train with no return journey", () => {
		const train = createMockTrain("123", "I", [
			{
				stationShortCode: "HKI",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
			{
				stationShortCode: "PSL",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:10:00Z",
				commercialTrack: "2",
			},
		]);

		const result = getRelevantTrackInfo(train, "HKI", "PSL");
		expect(result).toEqual({
			track: "1",
			timestamp: "2024-03-20T10:00:00Z",
			journeyKey: "123-HKI-PSL",
		});
	});

	it("should handle train with invalid journey sequence", () => {
		const train = createMockTrain("123", "I", [
			{
				stationShortCode: "HKI",
				type: "ARRIVAL",
				scheduledTime: "2024-03-20T10:00:00Z",
				commercialTrack: "1",
			},
			{
				stationShortCode: "PSL",
				type: "DEPARTURE",
				scheduledTime: "2024-03-20T10:10:00Z",
				commercialTrack: "2",
			},
		]);

		const result = getRelevantTrackInfo(train, "HKI", "PSL");
		expect(result).toBeNull();
	});
});
