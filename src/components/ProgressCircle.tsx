function ProgressCircle({ progress }: { progress: number }) {
	return (
		<div class="relative h-6 w-6">
			{/* biome-ignore lint/a11y/useFocusableInteractive: <explanation> */}
			<svg
				class="transform -rotate-90 w-6 h-6"
				viewBox="0 0 24 24"
				aria-label={`Loading progress: ${progress}%`}
			>
				{/* Background circle */}
				<circle
					class="text-gray-200"
					stroke-width="2.5"
					stroke="currentColor"
					fill="transparent"
					r="10"
					cx="12"
					cy="12"
				/>
				<title>Seuraava lataus: {progress}%</title>
				{/* Progress circle */}
				<circle
					class="text-[#8c4799] transition-all duration-1000 ease-in-out"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke="currentColor"
					fill="transparent"
					r="10"
					cx="12"
					cy="12"
					style={{
						strokeDasharray: `${2 * Math.PI * 10}`,
						strokeDashoffset: `${2 * Math.PI * 10 * (1 - progress / 100)}`,
					}}
				/>
			</svg>
		</div>
	);
}

export default ProgressCircle;
