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
		unknownDelay: "Myöhässä",
		departure: "Lähtöaika",
		train: "Juna",
		cancelled: "Peruttu",
		duration: "Kesto",
		hours: "tuntia",
		minutes: "minuuttia",
		minutesShort: "min",
		track: "Raide",
		arrivalTrack: "Saapumisraide",
		changed: "muuttunut",
		clickToSeeArrivalTrack: "Klikkaa nähdäksesi saapumisraide",
		clickToSeeDepartureTrack: "Klikkaa nähdäksesi lähtöraide",
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
		hideSlowTrains: "Piilota hitaat junat",
		slowTrainsHidden: "hitaat piilotettu",
		favorite: "Lisää suosikiksi",
		unfavorite: "Poista suosikeista",
		swipeToFavorite: "Pyyhkäise suosikiksi",
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
		serviceDownTitle: "Digitraffic-palvelussa häiriö",
		serviceDownMessage:
			"Junaliikenteen tietopalvelussa on häiriö. Tiedot eivät välttämättä ole ajan tasalla.",
		issueStarted: "Alkanut",
		viewStatusPage: "Näytä tilannesivu",
		// PWA Update Banner
		pwaUpdateTitle: "🚀 Uusi versio sovelluksesta on saatavilla!",
		pwaUpdateButton: "Päivitä nyt",
		pwaUpdateDismiss: "Myöhemmin",
		// Feature announcement
		newFeaturesTitle: "Uutta sovelluksessa",
		newFeaturesImprovedCardDesign: "Viilattu korttien ulkoasua",
		newFeaturesSmoothAnimations: "Pehmeämmät animaatiot",
		newFeaturesDismiss: "Selvä!",
		// Accessibility
		skipToContent: "Siirry sisältöön",
		// Empty state
		emptyStateTitle: "Valitse lähtöasema",
		emptyStateDescription: "Valitse lähtö- ja määräasema nähdäksesi junavuorot",
		emptyStateLocate: "Käytä sijaintiani",
		emptyStateSelectDestination: "Valitse määräasema",
		// Station search results
		stationsFound: "asemaa löytyi",
		noStationsFound: "Asemia ei löytynyt",
		// Mobile refresh
		justNow: "Juuri nyt",
		secondsAgo: "s sitten",
		tapToRefresh: "Päivitä napauttamalla",
		// Toast
		trackChangedNotification: "Raide muuttunut",
		connectionIssue: "Yhteysongelma, näytetään viimeisin tieto",
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
		unknownDelay: "Late",
		departure: "Departure time",
		train: "Train",
		cancelled: "Cancelled",
		duration: "Duration",
		hours: "hours",
		minutes: "minutes",
		minutesShort: "min",
		track: "Track",
		arrivalTrack: "Arrival track",
		changed: "changed",
		clickToSeeArrivalTrack: "Click to see arrival track",
		clickToSeeDepartureTrack: "Click to see departure track",
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
		hideSlowTrains: "Hide slow trains",
		slowTrainsHidden: "slow trains hidden",
		favorite: "Add to favorites",
		unfavorite: "Remove from favorites",
		swipeToFavorite: "Swipe to favorite",
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
		serviceDownTitle: "Digitraffic service disruption",
		serviceDownMessage:
			"The train data service is experiencing issues. Data may not be up to date.",
		issueStarted: "Started",
		viewStatusPage: "View status page",
		// PWA Update Banner
		pwaUpdateTitle: "🚀 New version of the app is available!",
		pwaUpdateButton: "Update now",
		pwaUpdateDismiss: "Later",
		// Feature announcement
		newFeaturesTitle: "What's new",
		newFeaturesImprovedCardDesign: "Refreshed card design",
		newFeaturesSmoothAnimations: "Smoother animations",
		newFeaturesDismiss: "Got it!",
		// Accessibility
		skipToContent: "Skip to content",
		// Empty state
		emptyStateTitle: "Select a departure station",
		emptyStateDescription:
			"Choose departure and destination stations to see train departures",
		emptyStateLocate: "Use my location",
		emptyStateSelectDestination: "Select a destination",
		// Station search results
		stationsFound: "stations found",
		noStationsFound: "No stations found",
		// Mobile refresh
		justNow: "Just now",
		secondsAgo: "s ago",
		tapToRefresh: "Tap to refresh",
		// Toast
		trackChangedNotification: "Track changed",
		connectionIssue: "Connection issue, showing last known data",
	},
	sv: {
		title: "Lokaltåg Live | Tidtabeller för lokaltåg i realtid",
		description: "Avgångstider i realtid för finska lokaltåg",
		appName: "Lokaltåg Live",
		appShortName: "Lokaltåg",
		keywords:
			"lokaltåg, pendeltåg, finska tåg, helsingfors tåg, tidtabeller, realtid",
		author: "Lokaltåg Live",
		from: "Från",
		to: "Till",
		locate: "Hitta",
		loading: "Laddar...",
		h1title: "Avgående lokaltåg",
		placeholder: "Välj station...",
		swapDirection: "Byt riktning",
		hint: "Destinationerna är filtrerade för att endast visa stationer med direkta tågförbindelser från den valda avgångsstationen.",
		closeHint: "Stäng tips",
		late: "Försenad med",
		unknownDelay: "Försenad",
		departure: "Avgångstid",
		train: "Tåg",
		cancelled: "Inställt",
		duration: "Restid",
		hours: "timmar",
		minutes: "minuter",
		minutesShort: "min",
		track: "Spår",
		arrivalTrack: "Ankomstspår",
		changed: "ändrat",
		clickToSeeArrivalTrack: "Klicka för att se ankomstspår",
		clickToSeeDepartureTrack: "Klicka för att se avgångsspår",
		selectStations: "Välj stationer",
		quick: "snabb",
		route: "rutt",
		expand: "expandera",
		collapse: "minimera",
		error: "Fel vid laddning av tågdata",
		departingTrains: "Avgående tåg",
		highlighted: "Markerad",
		madeBy: "Skapad av",
		dataSource: "Datakälla",
		trainIcon: "Tågikon från",
		showMore: "Visa fler",
		starIcon: "Stjärnikon",
		hideSlowTrains: "Dölj långsamma tåg",
		slowTrainsHidden: "långsamma tåg dolda",
		favorite: "Lägg till som favorit",
		unfavorite: "Ta bort från favoriter",
		swipeToFavorite: "Svep för att favoritmarkera",
		// Error states
		errorTitle: "Något gick fel",
		errorMessage: "Ett oväntat fel inträffade. Försök att uppdatera sidan.",
		retry: "Försök igen",
		dismiss: "Stäng",
		networkErrorTitle: "Anslutningsfel",
		networkErrorMessage: "Kontrollera din internetanslutning och försök igen.",
		apiErrorTitle: "Tjänstefel",
		apiErrorMessage: "Kunde inte ladda tågdata. Försök igen om en stund.",
		locationErrorTitle: "Platsfel",
		locationErrorMessage:
			"Kunde inte bestämma plats. Kontrollera platsinställningar.",
		notFoundTitle: "Inga resultat",
		notFoundMessage: "Inga tåg hittades som matchar dina sökkriterier.",
		rateLimitTitle: "För många förfrågningar",
		rateLimitMessage: "Vänta en stund innan du söker igen.",
		serviceDownTitle: "Digitraffic-tjänsten har störningar",
		serviceDownMessage:
			"Tågdatatjänsten har problem. Data kanske inte är aktuell.",
		issueStarted: "Startade",
		viewStatusPage: "Visa statussida",
		// PWA Update Banner
		pwaUpdateTitle: "🚀 En ny version av appen är tillgänglig!",
		pwaUpdateButton: "Uppdatera nu",
		pwaUpdateDismiss: "Senare",
		// Feature announcement
		newFeaturesTitle: "Nyheter",
		newFeaturesImprovedCardDesign: "Förnyad kortdesign",
		newFeaturesSmoothAnimations: "Mjukare animationer",
		newFeaturesDismiss: "Uppfattat!",
		// Accessibility
		skipToContent: "Hoppa till innehåll",
		// Empty state
		emptyStateTitle: "Välj avgångsstation",
		emptyStateDescription:
			"Välj avgångs- och destinationsstation för att se tågavgångar",
		emptyStateLocate: "Använd min plats",
		emptyStateSelectDestination: "Välj destination",
		// Station search results
		stationsFound: "stationer hittades",
		noStationsFound: "Inga stationer hittades",
		// Mobile refresh
		justNow: "Just nu",
		secondsAgo: "s sedan",
		tapToRefresh: "Tryck för att uppdatera",
		// Toast
		trackChangedNotification: "Spår ändrat",
		connectionIssue: "Anslutningsproblem, visar senast kända data",
	},
};

// Derive TranslationKey from actual translation keys for compile-time safety
export type TranslationKey = keyof typeof translations.fi & string;

/**
 * Translate a key using the active language dictionary, falling back to Finnish and finally the key.
 */
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
