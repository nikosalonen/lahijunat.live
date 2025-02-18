import { findStationsWithoutDestinations } from "../src/utils/api";

async function main() {
	console.log("Starting station check...");
	try {
		await findStationsWithoutDestinations();
		console.log("Check complete!");
	} catch (error) {
		console.error("Error during check:", error);
	}
}

main();
