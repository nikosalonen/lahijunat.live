/** @format */

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
		appName: "Lähijunat Live",
		appShortName: "Lähijunat",
		keywords:
			"lähijunat, suomen lähijunat, reaaliaikaiset lähtöajat, lähijunien ajat, lähijunien ajoneuvot",
		author: "Lähijunat Live",
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
		showMore: "Näytä lisää",
		starIcon: "Tähti-ikoni",
		// Error states
		errorTitle: "Jotain meni pieleen",
		errorMessage: "Tapahtui odottamaton virhe. Yritä päivittää sivu.",
		retry: "Yritä uudelleen",
		dismiss: "Sulje",
		networkErrorTitle: "Yhteysvirhe",
		networkErrorMessage: "Tarkista internetyhteytesi ja yritä uudelleen.",
		apiErrorTitle: "Palveluvirhe",
		apiErrorMessage:
			"Junatietojen lataaminen epäonnistui. Yritä hetken kuluttua uudelleen.",
		locationErrorTitle: "Sijaintivirhe",
		locationErrorMessage:
			"Sijaintia ei voitu määrittää. Tarkista sijaintiasetukset.",
		notFoundTitle: "Ei tuloksia",
		notFoundMessage: "Hakuehdoillasi ei löytynyt junia.",
		rateLimitTitle: "Liikaa pyyntöjä",
		rateLimitMessage: "Odota hetki ennen seuraavaa hakua.",
	},
	en: {
		title: "Local Trains Live | Real-time schedules for local trains",
		description: "Real-time departure times for Finnish local trains",
		appName: "Commuter Trains Live",
		appShortName: "Commuter Trains",
		keywords:
			"commuter trains, local trains, finnish trains, helsinki trains, train schedules, real-time trains",
		author: "Commuter Trains Live",
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
		showMore: "Show more",
		starIcon: "Star icon",
		// Error states
		errorTitle: "Something went wrong",
		errorMessage: "An unexpected error occurred. Try refreshing the page.",
		retry: "Try again",
		dismiss: "Dismiss",
		networkErrorTitle: "Connection error",
		networkErrorMessage: "Check your internet connection and try again.",
		apiErrorTitle: "Service error",
		apiErrorMessage: "Failed to load train data. Please try again in a moment.",
		locationErrorTitle: "Location error",
		locationErrorMessage:
			"Could not determine location. Check location settings.",
		notFoundTitle: "No results",
		notFoundMessage: "No trains found matching your search criteria.",
		rateLimitTitle: "Too many requests",
		rateLimitMessage: "Please wait a moment before searching again.",
	},
};

export const t = (key: string): string => {
	const lang = getCurrentLanguage();
	return translations[lang]?.[key] || translations.fi[key] || key;
};
