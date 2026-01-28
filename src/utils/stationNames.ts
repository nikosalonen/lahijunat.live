/** @format */

import { getCurrentLanguage } from "./language";

/**
 * Swedish names for Finnish railway stations.
 * Only stations with different Swedish names are listed here.
 * Stations not in this map use their Finnish name.
 */
const SWEDISH_STATION_NAMES: Record<string, string> = {
	// Helsinki metropolitan area
	HKI: "Helsingfors",
	PSL: "Böle",
	ILA: "Ilmala",
	KÄP: "Kottby",
	OLK: "Åggelby",
	ML: "Malm",
	PMK: "Bocksbacka",
	TNA: "Mosabacka",
	PLA: "Parkstad",
	TKL: "Dickursby",
	HKH: "Sandkulla",
	KVY: "Björkby",

	// Espoo line
	HPL: "Hoplax",
	POH: "Norra Haga",
	KAN: "Gamlas",
	MLO: "Malmgård",
	MÄK: "Mäkkylä",
	PJM: "Sockenbacka",
	LPV: "Alberga",
	KIL: "Kilo",
	KEA: "Kera",
	KNI: "Grankulla",
	KVH: "Björkgård",
	TRL: "Domsby",
	EPO: "Esbo",
	KLH: "Köklax",
	MAS: "Masaby",
	JRS: "Jorvas",
	TOL: "Tolls",
	KKN: "Kyrkslätt",
	STI: "Sjundeå",
	IKO: "Ingå",

	// Vantaa Ring Rail
	MYR: "Myrbacka",
	MRL: "Mårtensdal",
	LOH: "Louhela",
	VKS: "Vandaforsen",
	LEN: "Flygplatsen",

	// Karjaa line
	KR: "Karis",
	TMS: "Ekenäs",
	LPO: "Lappvik",
	STA: "Sandö",
	HKP: "Hangö norra",
	HNK: "Hangö",

	// Main line north
	KE: "Kervo",
	JP: "Träskända",
	HY: "Hyvinge",
	RI: "Riihimäki",
	HL: "Tavastehus",
	TPE: "Tammerfors",

	// Lahti line
	LH: "Lahtis",
	KY: "Kymmene",
	KTA: "Kotka",
	KTS: "Kotka hamn",
};

/**
 * Get the localized name for a station based on current language.
 * Returns Swedish name if language is Swedish and a Swedish name exists,
 * otherwise returns the Finnish name.
 */
export function getLocalizedStationName(
	finnishName: string,
	shortCode: string,
): string {
	const lang = getCurrentLanguage();

	if (lang === "sv") {
		const swedishName = SWEDISH_STATION_NAMES[shortCode];
		if (swedishName) {
			// Preserve " asema" suffix as " station" in Swedish
			if (finnishName.endsWith(" asema")) {
				return `${swedishName} station`;
			}
			return swedishName;
		}
	}

	return finnishName;
}

/**
 * Get Swedish station name by short code, or null if not available.
 */
export function getSwedishStationName(shortCode: string): string | null {
	return SWEDISH_STATION_NAMES[shortCode] ?? null;
}
