import { t } from "@/utils/translations";

interface Props {
	hasOrigin: boolean;
	onLocate: () => void;
	isLocating: boolean;
}

export default function EmptyState({ hasOrigin, onLocate, isLocating }: Props) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			{/* Train icon */}
			<svg
				className="w-16 h-16 text-[#8c4799] opacity-40 mb-4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<rect x="4" y="3" width="16" height="14" rx="3" />
				<line x1="4" y1="10" x2="20" y2="10" />
				<circle cx="8.5" cy="14" r="1" fill="currentColor" />
				<circle cx="15.5" cy="14" r="1" fill="currentColor" />
				<line x1="6" y1="17" x2="3" y2="21" />
				<line x1="18" y1="17" x2="21" y2="21" />
				<line x1="9" y1="3" x2="9" y2="7" />
				<line x1="15" y1="3" x2="15" y2="7" />
			</svg>

			<h3 className="text-lg font-semibold text-base-content/70 mb-2">
				{hasOrigin ? t("emptyStateSelectDestination") : t("emptyStateTitle")}
			</h3>
			<p className="text-sm text-base-content/50 mb-6 max-w-xs">
				{t("emptyStateDescription")}
			</p>

			{!hasOrigin && (
				<button
					type="button"
					onClick={onLocate}
					disabled={isLocating}
					className={`btn bg-[#8c4799] hover:bg-[#7a3f86] text-white border-[#8c4799] hover:border-[#7a3f86] shadow-brand-medium hover:shadow-brand-strong transition-all duration-200 gap-2 ${isLocating ? "animate-pulse" : ""}`}
				>
					<svg
						className="w-5 h-5"
						fill="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
					</svg>
					{t("emptyStateLocate")}
				</button>
			)}
		</div>
	);
}
