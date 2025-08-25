/** @format */

export default function StationListSkeleton() {
	return (
		<div class="p-4 text-center">
			<div class="space-y-2">
				{Array.from({ length: 5 }, (_, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items that don't reorder
						key={`station-skeleton-item-${index}`}
						class="flex items-center justify-between p-2"
					>
						<div class="flex items-center space-x-3">
							<div class="skeleton h-4 w-32" />
							<div class="skeleton h-3 w-8" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
