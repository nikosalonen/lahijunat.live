/** @format */

export default function StationListSkeleton() {
	return (
		<div class="p-4 text-center">
			<div class="space-y-2">
				{Array.from({ length: 5 }, (_, index) => (
					<div
						key={`station-skeleton-${Date.now()}-${index}`}
						class="flex items-center justify-between p-2 animate-pulse"
					>
						<div class="flex items-center space-x-3">
							<div class="bg-gray-200 dark:bg-gray-700 rounded h-4 w-32" />
							<div class="bg-gray-200 dark:bg-gray-700 rounded h-3 w-8" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
