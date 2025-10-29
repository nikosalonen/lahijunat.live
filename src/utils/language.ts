/**
 * Resolve active UI language from local storage, defaulting to Finnish on SSR.
 */
export const getCurrentLanguage = (): string => {
	if (typeof window === "undefined") return "fi";
	return window.localStorage.getItem("lang") || "fi";
};

/**
 * Persist a new UI language and notify listeners via the languagechange event.
 */
export const switchLanguage = (lang: string): void => {
	if (typeof window === "undefined") return;
	window.localStorage.setItem("lang", lang);
	window.dispatchEvent(new Event("languagechange"));
};
