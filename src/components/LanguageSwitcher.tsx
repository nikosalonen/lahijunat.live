import type { ChangeEvent } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { getCurrentLanguage, switchLanguage } from "../utils/language";

const LanguageSwitcher = () => {
	// Initialize with null to avoid hydration mismatch
	const [currentLang, setCurrentLang] = useState<string | null>(null);

	useEffect(() => {
		// Set the initial language after component mounts
		setCurrentLang(getCurrentLanguage());

		const handleLanguageChange = () => {
			setCurrentLang(getCurrentLanguage());
		};

		window.addEventListener("languagechange", handleLanguageChange);
		return () =>
			window.removeEventListener("languagechange", handleLanguageChange);
	}, []);

	// Don't render until we have the language
	if (!currentLang) return null;

	return (
		<select
			onChange={(e: ChangeEvent<HTMLSelectElement>) => {
				switchLanguage(e.currentTarget.value);
				setCurrentLang(e.currentTarget.value);
			}}
			value={currentLang}
			className="select select-sm select-ghost bg-transparent text-white border border-white/25 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/10 shadow-none"
			style={{ backgroundColor: "transparent" }}
		>
			<option value="fi">🇫🇮 Suomi</option>
			<option value="en">🇬🇧 English</option>
		</select>
	);
};

export default LanguageSwitcher;
