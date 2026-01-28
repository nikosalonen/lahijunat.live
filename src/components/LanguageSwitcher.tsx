import { useEffect, useState } from "preact/hooks";
import { getCurrentLanguage, switchLanguage } from "../utils/language";

type Lang = "fi" | "en" | "sv";

const LanguageSwitcher = () => {
	// Initialize with null to avoid hydration mismatch
	const [currentLang, setCurrentLang] = useState<Lang | null>(null);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		// Set the initial language after component mounts
		setCurrentLang(getCurrentLanguage() as Lang);

		const handleLanguageChange = () => {
			setCurrentLang(getCurrentLanguage() as Lang);
		};

		window.addEventListener("languagechange", handleLanguageChange);
		return () =>
			window.removeEventListener("languagechange", handleLanguageChange);
	}, []);

	const handleLanguageSelect = (lang: Lang) => {
		switchLanguage(lang);
		setCurrentLang(lang);
		setIsOpen(false);
		// Close dropdown by removing focus
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	};

	const handleToggle = () => {
		setIsOpen(!isOpen);
	};

	const handleFocus = () => {
		setIsOpen(true);
	};

	const handleBlur = (event: globalThis.FocusEvent) => {
		// Check if the new focus target is within the dropdown
		const target = event.currentTarget;
		if (!(target instanceof Element)) return;
		const dropdown = target.closest(".dropdown");
		if (!dropdown) return;

		if (event.relatedTarget) {
			// Standard case: relatedTarget is available
			if (!dropdown.contains(event.relatedTarget as Node)) {
				setIsOpen(false);
			}
		} else {
			// Safari fallback: relatedTarget is null, check on next tick
			setTimeout(() => {
				const activeElement = document.activeElement;
				if (!activeElement || !dropdown.contains(activeElement)) {
					setIsOpen(false);
				}
			}, 0);
		}
	};

	// Don't render until we have the language
	if (!currentLang) return null;

	const labels: Record<Lang, string> = {
		fi: "🇫🇮 Suomi",
		en: "🇬🇧 English",
		sv: "🇸🇪 Svenska",
	};
	const currentLanguageDisplay = labels[currentLang];

	return (
		<div className={`dropdown dropdown-end ${isOpen ? "dropdown-open" : ""}`}>
			<button
				type="button"
				tabIndex={0}
				className="btn btn-ghost btn-xs sm:btn-sm border border-base-300 hover:bg-base-200 focus:bg-base-200 normal-case min-h-[2rem] sm:min-h-[2.5rem] h-auto px-2 sm:px-3 py-1 text-sm group"
				aria-label="Select language"
				aria-haspopup="menu"
				aria-controls="language-menu"
				aria-expanded={isOpen}
				onClick={handleToggle}
				onFocus={handleFocus}
				onBlur={handleBlur}
			>
				<span className="hidden sm:inline text-white group-hover:text-black group-focus:text-black dark:group-hover:text-white dark:group-focus:text-white">
					{currentLanguageDisplay}
				</span>
				<span className="sm:hidden text-white group-hover:text-black group-focus:text-black dark:group-hover:text-white dark:group-focus:text-white">
					{labels[currentLang].split(" ")[0]}
				</span>
				<svg
					className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5 sm:ml-1 text-white group-hover:text-black group-focus:text-black dark:group-hover:text-white dark:group-focus:text-white"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-label="Toggle language menu"
				>
					<title>Toggle language menu</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
			{/* @ts-ignore - role="menu" is correct for accessibility despite linter warning */}
			<ul
				id="language-menu"
				className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
			>
				<li>
					<button
						type="button"
						role="menuitemradio"
						aria-checked={currentLang === "fi"}
						className={`text-base-content hover:bg-base-200 ${currentLang === "fi" ? "active" : ""}`}
						onClick={() => handleLanguageSelect("fi")}
					>
						🇫🇮 Suomi
					</button>
				</li>
				<li>
					<button
						type="button"
						role="menuitemradio"
						aria-checked={currentLang === "en"}
						className={`text-base-content hover:bg-base-200 ${currentLang === "en" ? "active" : ""}`}
						onClick={() => handleLanguageSelect("en")}
					>
						🇬🇧 English
					</button>
				</li>
				<li>
					<button
						type="button"
						role="menuitemradio"
						aria-checked={currentLang === "sv"}
						className={`text-base-content hover:bg-base-200 ${currentLang === "sv" ? "active" : ""}`}
						onClick={() => handleLanguageSelect("sv")}
					>
						🇸🇪 Svenska
					</button>
				</li>
			</ul>
		</div>
	);
};

export default LanguageSwitcher;
