/** @format */

import { getCurrentLanguage } from "./language";

export const translations = {
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
		h1title: "Lähtevät lähijunat",
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
		changed: "muuttunut",
		selectStations: "Valitse asemat",
		quick: "pika",
		route: "reitti",
		expand: "laajenna",
		collapse: "pienennä",
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
		// PWA Update Banner
		pwaUpdateTitle: "🚀 Uusi versio sovelluksesta on saatavilla!",
		pwaUpdateButton: "Päivitä nyt",
		pwaUpdateDismiss: "Myöhemmin",
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
		h1title: "Departing commuter trains",
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
		changed: "changed",
		selectStations: "Select stations",
		quick: "quick",
		route: "route",
		expand: "expand",
		collapse: "collapse",
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
		// PWA Update Banner
		pwaUpdateTitle: "🚀 New version of the app is available!",
		pwaUpdateButton: "Update now",
		pwaUpdateDismiss: "Later",
	},
};

// Derive TranslationKey from actual translation keys for compile-time safety
export type TranslationKey = keyof typeof translations.fi & string;

// Function overloads: compile-time safety for known keys, fallback for dynamic keys
export function t(key: TranslationKey): string;
export function t(key: string): string;
export function t(key: string): string {
	const lang = getCurrentLanguage();
	const hasLang = lang in translations;
	const dict = hasLang
		? translations[lang as keyof typeof translations]
		: translations.fi;
	return (
		dict[key as keyof typeof dict] ??
		translations.fi[key as keyof typeof translations.fi] ??
		key
	);
}
