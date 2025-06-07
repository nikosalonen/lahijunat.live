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
			className="bg-transparent text-white hover:text-blue-100 transition-colors cursor-pointer border border-white/20 rounded px-2 py-1 focus:outline-none focus:border-blue-100"
		>
			<option value="fi" className="bg-[#8c4799] text-white">
				🇫🇮 Suomi
			</option>
			<option value="en" className="bg-[#8c4799] text-white">
				🇬🇧 English
			</option>
		</select>
	);
};

export default LanguageSwitcher;
