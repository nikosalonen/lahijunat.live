/** @format */

export default function StationListSkeleton() {
	return (
		<div class="p-1" aria-busy="true">
			<div class="space-y-1">
				{Array.from({ length: 5 }, (_, index) => (
					<div
						key={`station-skeleton-item-${index}`}
						class="flex items-center justify-start px-4 min-h-[48px] rounded-lg"
					>
						{/* Station name (code) skeleton - matches StationOption button content */}
						<div class="skeleton h-5 w-40 sm:w-36" aria-hidden="true" />
					</div>
				))}
			</div>
		</div>
	);
}
