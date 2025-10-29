import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useLanguageChange } from "../hooks/useLanguageChange";

function LinearProgress({
	progress,
	heightClass = "h-1.5",
	widthClass = "w-20",
	direction = "ltr",
	ariaLabel,
}: {
	progress: number;
	heightClass?: string;
	widthClass?: string;
	direction?: "ltr" | "rtl";
	ariaLabel?: string;
}) {
	useLanguageChange();
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		setPrefersReducedMotion(mediaQuery.matches);

		const handleChange = (e: MediaQueryListEvent) => {
			setPrefersReducedMotion(e.matches);
		};

		// Modern browsers
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
			return () => mediaQuery.removeEventListener("change", handleChange);
		}
		// Fallback for older browsers
		if (mediaQuery.addListener) {
			mediaQuery.addListener(handleChange);
			return () => mediaQuery.removeListener(handleChange);
		}
	}, []);

	const clamped = Number.isFinite(progress)
		? Math.max(0, Math.min(100, progress))
		: progress === Number.POSITIVE_INFINITY
			? 100
			: 0;
	const style: JSX.CSSProperties = {
		width: `${clamped}%`,
		...(prefersReducedMotion && { transition: "none" }),
	};

	const defaultAriaLabel = ariaLabel ?? "Refresh progress";

	return (
		<div
			class={`relative ${widthClass} ${heightClass} rounded-full bg-base-content/20 overflow-hidden shadow-inner`}
			role="progressbar"
			aria-label={defaultAriaLabel}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={clamped}
			aria-valuetext={`${clamped}%`}
		>
			<div
				class={`absolute inset-y-0 ${direction === "rtl" ? "right-0" : "left-0"} bg-primary ${prefersReducedMotion ? "" : "transition-[width] duration-1000 ease-linear"}`}
				style={style}
			/>
			{/* subtle top highlight */}
			<div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
		</div>
	);
}

export default LinearProgress;
