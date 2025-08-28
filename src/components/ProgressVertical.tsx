import type { JSX } from "preact";
import { useLanguageChange } from "../hooks/useLanguageChange";
import { t } from "../utils/translations";

function ProgressVertical({
  progress,
  heightClass = "h-8",
  widthClass = "w-1",
}: {
  progress: number;
  heightClass?: string;
  widthClass?: string;
}) {
  useLanguageChange();
  const clamped = Math.max(0, Math.min(100, progress));
  const style: JSX.CSSProperties = {
    height: `${clamped}%`,
  };

  return (
    <div
      class={`relative ${widthClass} ${heightClass} rounded-full bg-base-content/20 overflow-hidden`}
      role="progressbar"
      aria-label={t("loading")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div class="absolute bottom-0 left-0 right-0 bg-primary" style={style} />
      <span class="sr-only">{t("loading")}</span>
    </div>
  );
}

export default ProgressVertical;


