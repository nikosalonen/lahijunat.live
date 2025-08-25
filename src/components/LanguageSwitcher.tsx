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

	const handleLanguageSelect = (lang: string) => {
		switchLanguage(lang);
		setCurrentLang(lang);
		// Close dropdown by removing focus
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	};

	// Don't render until we have the language
	if (!currentLang) return null;

	const currentLanguageDisplay = currentLang === "fi" ? "🇫🇮 Suomi" : "🇬🇧 English";

	return (
		<div className="dropdown dropdown-end">
			<button
				type="button"
				tabIndex={0}
				className="btn btn-ghost btn-xs sm:btn-sm text-white border border-white/25 hover:bg-white/10 focus:bg-white/10 normal-case min-h-[2rem] sm:min-h-[2.5rem] h-auto px-2 sm:px-3 py-1 text-sm"
			>
				<span className="hidden sm:inline">{currentLanguageDisplay}</span>
				<span className="sm:hidden">{currentLang === "fi" ? "🇫🇮" : "🇬🇧"}</span>
				<svg
					className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5 sm:ml-1"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-label="Toggle language menu"
				>
					<title>Toggle language menu</title>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			<ul
				className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
			>
				<li>
					<button
						type="button"
						className={`text-base-content hover:bg-base-200 ${currentLang === "fi" ? "active" : ""}`}
						onClick={() => handleLanguageSelect("fi")}
					>
						🇫🇮 Suomi
					</button>
				</li>
				<li>
					<button
						type="button"
						className={`text-base-content hover:bg-base-200 ${currentLang === "en" ? "active" : ""}`}
						onClick={() => handleLanguageSelect("en")}
					>
						🇬🇧 English
					</button>
				</li>
			</ul>
		</div>
	);
};

export default LanguageSwitcher;
