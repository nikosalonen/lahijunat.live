import type { JSX } from "preact";
import { useLanguageChange } from "../hooks/useLanguageChange";
import { t } from "../utils/translations";

function LinearProgress({
	progress,
	heightClass = "h-1.5",
	widthClass = "w-20",
	direction = "ltr",
}: {
	progress: number;
	heightClass?: string;
	widthClass?: string;
	direction?: "ltr" | "rtl";
}) {
	useLanguageChange();
	const clamped = Number.isFinite(progress)
		? Math.max(0, Math.min(100, progress))
		: progress === Number.POSITIVE_INFINITY
			? 100
			: 0;
	const style: JSX.CSSProperties = {
		width: `${clamped}%`,
	};

	return (
		<div
			class={`relative ${widthClass} ${heightClass} rounded-full bg-base-content/20 overflow-hidden shadow-inner`}
			role="progressbar"
			aria-label={t("loading")}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={clamped}
			aria-valuetext={`${clamped}%`}
		>
			<div
				class={`absolute inset-y-0 ${direction === "rtl" ? "right-0" : "left-0"} bg-primary transition-[width] duration-1000 ease-linear`}
				style={style}
			/>
			{/* subtle top highlight */}
			<div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
		</div>
	);
}

export default LinearProgress;
