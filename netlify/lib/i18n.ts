import type { AlertLang } from "./types";

export function cancelledText(lang: AlertLang): string {
	switch (lang) {
		case "sv":
			return "Tåget är inställt.";
		case "en":
			return "Train cancelled.";
		default:
			return "Juna on peruttu.";
	}
}

export function doesNotStopText(lang: AlertLang, station: string): string {
	switch (lang) {
		case "sv":
			return `Tåget stannar inte vid ${station}.`;
		case "en":
			return `Train does not stop at ${station}.`;
		default:
			return `Juna ei pysähdy asemalla ${station}.`;
	}
}
