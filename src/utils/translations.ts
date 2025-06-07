import { getCurrentLanguage } from "./language";

type Translations = {
	[key: string]: {
		[key: string]: string;
	};
};

export const translations: Translations = {
	fi: {
		title: "Lähijunat Live | Lähijunien aikataulut reaaliaikaisesti",
		description: "Reaaliaikaiset lähtöajat Suomen lähijunille",
		from: "Mistä",
		to: "Minne",
		locate: "Paikanna",
		loading: "Ladataan...",
		h1title: "Lähijunien aikataulut",
		placeholder: "Valitse asema...",
		swapDirection: "Vaihda suunta",
		hint: "Määränpäät on suodatettu näyttämään vain asemat, joihin on suoria junayhteyksiä valitulta lähtöasemalta.",
		closeHint: "Sulje vihje",
		late: "Myöhässä noin",
		departure: "Lähtöaika",
		train: "Juna",
		cancelled: "Peruttu",
		duration: "Kesto",
		hours: "tuntia",
		minutes: "minuuttia",
		track: "Raide",
		error: "Virhe ladattaessa junatiedot",
		departingTrains: "Lähtevät junat",
		highlighted: "Korostettu",
		madeBy: "Tekijä",
		dataSource: "Datalähde",
		trainIcon: "Juna-ikoni lainattu",
		changelog: "Muutosloki",
		showMore: "Näytä lisää",
		favoriteTooltip: "Klikkaa suosikiksi ja korosta juna listassa",
		starIcon: "Tähti-ikoni",
	},
	en: {
		title: "Local Trains Live | Real-time schedules for local trains",
		description: "Real-time departure times for Finnish local trains",
		from: "From",
		to: "To",
		locate: "Locate",
		loading: "Loading...",
		h1title: "Local Trains Schedules",
		placeholder: "Select a station...",
		swapDirection: "Swap direction",
		hint: "The destinations are filtered to show only stations with direct train connections from the selected departure station.",
		closeHint: "Close hint",
		late: "Late by",
		departure: "Departure time",
		train: "Train",
		cancelled: "Cancelled",
		duration: "Duration",
		hours: "hours",
		minutes: "minutes",
		track: "Track",
		error: "Error loading train data",
		departingTrains: "Departing trains",
		highlighted: "Highlighted",
		madeBy: "Made by",
		dataSource: "Data source",
		trainIcon: "Train icon from",
		changelog: "Changelog",
		showMore: "Show more",
		favoriteTooltip: "Click to favorite and highlight this train in the list",
		starIcon: "Star icon",
	},
};

export const t = (key: string): string => {
	const lang = getCurrentLanguage();
	return translations[lang]?.[key] || translations.fi[key] || key;
};
