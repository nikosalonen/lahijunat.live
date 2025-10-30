export interface Station {
	name: string;
	shortCode: string;
	location: {
		latitude: number;
		longitude: number;
	};
}

export interface Train {
	operatorUICCode: string;
	trainCategory: string;
	trainType: string;
	cancelled: boolean;
	commuterLineID: string;
	trainNumber: string;
	timeTableRows: TimeTableRow[];
	// Derived fields (computed in API layer)
	isDeparted?: boolean;
	/** ISO string when train is considered departed (actual or inferred) */
	departedAt?: string;
}

export interface TimeTableRow {
	trainStopping: boolean;
	stationShortCode: string;
	type: string;
	commercialStop: boolean;
	commercialTrack: string;
	cancelled: boolean;
	scheduledTime: string;
	liveEstimateTime?: string;
	actualTime?: string;
	differenceInMinutes?: number;
	unknownDelay?: boolean;
	station: Station;
}

export type Duration = {
	hours: number;
	minutes: number;
};
