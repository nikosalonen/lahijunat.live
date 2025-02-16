export default function LoadingSpinner() {
	return (
		// biome-ignore lint/a11y/useSemanticElements: <explanation>
		<div className="flex justify-center items-center h-screen" role="status">
			<div
				className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"
				aria-hidden="true"
			/>
			<span className="sr-only">Ladataan...</span>
		</div>
	);
}
