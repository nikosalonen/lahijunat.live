import { useLanguageChange } from "../hooks/useLanguageChange";
import { t } from "../utils/translations";

function ProgressCircle({
	progress,
	size = "w-6 h-6",
}: {
	progress: number;
	size?: string;
}) {
	useLanguageChange();
	const clamped = Math.max(0, Math.min(100, progress));
	const style: JSX.CSSProperties & Record<`--${string}`, string | number> = {
		"--value": clamped,
		"--thickness": "2px",
		"--size": "2rem",
	};
	return (
		<div
			class={`radial-progress text-primary ${size}`}
			role="progressbar"
			aria-label={t("loading")}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={clamped}
			style={style}
		>
			<span class="sr-only">{t("loading")}</span>
		</div>
	);
}

export default ProgressCircle;
