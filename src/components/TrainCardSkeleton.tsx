export default function TrainCardSkeleton() {
	return (
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700 animate-pulse">
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center space-x-3">
					{/* Train number skeleton */}
					<div class="bg-gray-200 dark:bg-gray-700 rounded px-2 py-1 h-6 w-12" />
					{/* Status skeleton */}
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-4 w-16" />
				</div>
				{/* Star icon skeleton */}
				<div class="bg-gray-200 dark:bg-gray-700 rounded h-5 w-5" />
			</div>

			<div class="grid grid-cols-2 gap-4 text-sm">
				{/* Departure time */}
				<div>
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-3 w-16 mb-1" />
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-5 w-12" />
				</div>

				{/* Duration */}
				<div>
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-3 w-12 mb-1" />
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-5 w-16" />
				</div>

				{/* Track */}
				<div>
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-3 w-10 mb-1" />
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-5 w-8" />
				</div>

				{/* Delay info */}
				<div>
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-3 w-14 mb-1" />
					<div class="bg-gray-200 dark:bg-gray-700 rounded h-5 w-20" />
				</div>
			</div>
		</div>
	);
}
