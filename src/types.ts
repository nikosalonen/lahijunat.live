export interface Station {
	name: string;
	shortCode: string;
}

export interface Train {
	operatorUICCode: string;
	trainCategory: string;
	trainType: string;
	cancelled: boolean;
	commuterLineID: string;
	trainNumber: string;
	timeTableRows: TimeTableRow[];
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
	station: Station;
}
