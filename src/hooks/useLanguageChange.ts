import { useEffect, useState } from "preact/hooks";

/**
 * Track the number of times the window language changes so observers can re-render.
 */
export function useLanguageChange() {
	const [languageChange, setLanguageChange] = useState(0);

	useEffect(() => {
		const handleLanguageChange = () => {
			setLanguageChange((prev) => prev + 1);
		};

		window.addEventListener("languagechange", handleLanguageChange);
		return () =>
			window.removeEventListener("languagechange", handleLanguageChange);
	}, []);

	return languageChange;
}
