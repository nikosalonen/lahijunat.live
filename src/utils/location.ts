interface Coordinates {
	latitude: number;
	longitude: number;
}

export function calculateDistance(
	coord1: Coordinates,
	coord2: Coordinates,
): number {
	const R = 6371; // Earth's radius in km
	const dLat = toRad(coord2.latitude - coord1.latitude);
	const dLon = toRad(coord2.longitude - coord1.longitude);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(coord1.latitude)) *
			Math.cos(toRad(coord2.latitude)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function toRad(degrees: number): number {
	return degrees * (Math.PI / 180);
}
