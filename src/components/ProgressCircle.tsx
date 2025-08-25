import type { JSX } from "preact";
import { useLanguageChange } from "../hooks/useLanguageChange";
import { t } from "../utils/translations";

function ProgressCircle({ progress }: { progress: number }) {
	useLanguageChange();
	const clamped = Math.max(0, Math.min(100, progress));
	const style: JSX.CSSProperties & Record<`--${string}`, string | number> = {
		"--value": clamped,
		"--size": "1.5rem",
		"--thickness": "2.5px",
	};
	return (
		<div
			class="radial-progress text-primary w-6 h-6"
			role="progressbar"
			aria-label={t("loading")}
			style={style}
		>
			<span class="sr-only">{t("loading")}</span>
		</div>
	);
}

export default ProgressCircle;
