/** @format */

export default function StationListSkeleton() {
	return (
		<output class="p-4 text-center" aria-busy="true">
			<div class="space-y-2">
				{Array.from({ length: 5 }, (_, index) => (
					<div
						key={`station-skeleton-item-${index}`}
						class="flex items-center justify-between p-2"
					>
						<div class="flex items-center space-x-3">
							<div class="skeleton h-4 w-32" aria-hidden="true" />
							<div class="skeleton h-3 w-8" aria-hidden="true" />
						</div>
					</div>
				))}
			</div>
		</output>
	);
}
