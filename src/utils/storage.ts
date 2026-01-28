/** @format */

/**
 * Storage abstraction with IndexedDB primary, localStorage fallback, in-memory last resort.
 * Used for persisting favorite trains with support for auto-expiration.
 */

export interface FavoriteTrainData {
	highlighted: boolean;
	removeAfter?: string; // ISO timestamp - auto-remove 10 min after departure
	journeyKey: string; // Unique key for train journey
	track?: string; // Track information
	trackChanged?: boolean; // Whether track has changed
}

type FavoritesMap = Record<string, FavoriteTrainData>;

const DB_NAME = "lahijunat-live";
const DB_VERSION = 1;
const STORE_NAME = "favorites";
const LEGACY_STORAGE_KEY = "highlightedTrains";

// In-memory cache for synchronous reads
let favoritesCache: FavoritesMap = {};
let dbInstance: IDBDatabase | null = null;
let initPromise: Promise<void> | null = null;
let storageType: "indexeddb" | "localstorage" | "memory" = "memory";

/**
 * Internal cleanup function called during initialization.
 * Does not call initStorage() to avoid recursion.
 */
async function runCleanup(): Promise<void> {
	const now = Date.now();
	const toRemove: string[] = [];

	for (const [trainNumber, data] of Object.entries(favoritesCache)) {
		if (data.removeAfter) {
			const removeAt = new Date(data.removeAfter).getTime();
			if (removeAt < now) {
				toRemove.push(trainNumber);
			}
		}
	}

	if (toRemove.length > 0) {
		console.log(`[Storage] Cleaning up ${toRemove.length} expired favorites`);
		for (const trainNumber of toRemove) {
			// Remove from cache
			delete favoritesCache[trainNumber];

			// Remove from persistence
			if (storageType === "indexeddb") {
				await deleteFromIndexedDB(trainNumber);
			} else if (storageType === "localstorage") {
				saveToLocalStorage(favoritesCache);
			}
		}
	}
}

/**
 * Initialize the storage system.
 * Attempts IndexedDB first, falls back to localStorage, then in-memory.
 * Migrates existing localStorage data to IndexedDB.
 */
export async function initStorage(): Promise<void> {
	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		// Try IndexedDB first
		if (typeof indexedDB !== "undefined") {
			try {
				dbInstance = await openDatabase();
				storageType = "indexeddb";

				// Load existing data into cache
				const data = await loadFromIndexedDB();
				favoritesCache = data;

				// Check for localStorage migration
				await migrateFromLocalStorage();

				// Clean up expired favorites
				await runCleanup();

				console.log("[Storage] Using IndexedDB");
				return;
			} catch (error) {
				console.warn("[Storage] IndexedDB failed, falling back:", error);
			}
		}

		// Fall back to localStorage
		if (typeof localStorage !== "undefined") {
			try {
				const testKey = "__storage_test__";
				localStorage.setItem(testKey, testKey);
				localStorage.removeItem(testKey);
				storageType = "localstorage";

				// Load existing data
				favoritesCache = loadFromLocalStorage();

				// Clean up expired favorites
				await runCleanup();

				console.log("[Storage] Using localStorage");
				return;
			} catch {
				console.warn("[Storage] localStorage not available");
			}
		}

		// Fall back to in-memory
		storageType = "memory";
		favoritesCache = {};
		console.log("[Storage] Using in-memory storage (data will not persist)");
	})();

	return initPromise;
}

/**
 * Open the IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(request.error);
		};

		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			// Create the favorites object store
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "trainNumber" });
			}
		};
	});
}

/**
 * Load all favorites from IndexedDB.
 */
async function loadFromIndexedDB(): Promise<FavoritesMap> {
	if (!dbInstance) return {};

	return new Promise((resolve, reject) => {
		const transaction = dbInstance?.transaction(STORE_NAME, "readonly");
		if (!transaction) {
			resolve({});
			return;
		}
		const store = transaction.objectStore(STORE_NAME);
		const request = store.getAll();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const result: FavoritesMap = {};
			for (const item of request.result) {
				result[item.trainNumber] = item;
			}
			resolve(result);
		};
	});
}

/**
 * Save a favorite to IndexedDB.
 */
async function saveToIndexedDB(
	trainNumber: string,
	data: FavoriteTrainData,
): Promise<void> {
	if (!dbInstance) return;

	return new Promise((resolve, reject) => {
		const transaction = dbInstance?.transaction(STORE_NAME, "readwrite");
		if (!transaction) {
			resolve();
			return;
		}
		const store = transaction.objectStore(STORE_NAME);
		const request = store.put({ trainNumber, ...data });

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

/**
 * Delete a favorite from IndexedDB.
 */
async function deleteFromIndexedDB(trainNumber: string): Promise<void> {
	if (!dbInstance) return;

	return new Promise((resolve, reject) => {
		const transaction = dbInstance?.transaction(STORE_NAME, "readwrite");
		if (!transaction) {
			resolve();
			return;
		}
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(trainNumber);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

/**
 * Load favorites from localStorage.
 */
function loadFromLocalStorage(): FavoritesMap {
	try {
		const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return {};

		// Convert old format to new format if needed
		const result: FavoritesMap = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (value && typeof value === "object") {
				const oldData = value as {
					highlighted?: boolean;
					removeAfter?: string;
					track?: string;
					trackChanged?: boolean;
				};
				result[key] = {
					highlighted: oldData.highlighted ?? true,
					removeAfter: oldData.removeAfter,
					journeyKey: key,
					track: oldData.track,
					trackChanged: oldData.trackChanged,
				};
			}
		}
		return result;
	} catch {
		return {};
	}
}

/**
 * Save favorites to localStorage.
 */
function saveToLocalStorage(data: FavoritesMap): void {
	try {
		localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(data));
	} catch {
		// Ignore quota errors in private mode
	}
}

/**
 * Migrate data from localStorage to IndexedDB.
 */
async function migrateFromLocalStorage(): Promise<void> {
	if (storageType !== "indexeddb") return;

	try {
		const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (!raw) return;

		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return;

		// Check if we have any data to migrate
		const keys = Object.keys(parsed);
		if (keys.length === 0) return;

		console.log(
			`[Storage] Migrating ${keys.length} favorites from localStorage`,
		);

		// Migrate each entry
		for (const [trainNumber, value] of Object.entries(parsed)) {
			if (value && typeof value === "object") {
				const oldData = value as {
					highlighted?: boolean;
					removeAfter?: string;
					track?: string;
					trackChanged?: boolean;
				};

				const newData: FavoriteTrainData = {
					highlighted: oldData.highlighted ?? true,
					removeAfter: oldData.removeAfter,
					journeyKey: trainNumber,
					track: oldData.track,
					trackChanged: oldData.trackChanged,
				};

				// Only add if not already in IndexedDB
				if (!favoritesCache[trainNumber]) {
					await saveToIndexedDB(trainNumber, newData);
					favoritesCache[trainNumber] = newData;
				}
			}
		}

		// Clear old localStorage data after successful migration
		localStorage.removeItem(LEGACY_STORAGE_KEY);
		console.log("[Storage] Migration complete, localStorage cleared");
	} catch (error) {
		console.warn("[Storage] Migration failed:", error);
	}
}

/**
 * Get all favorites. Returns a promise for async read.
 */
export async function getFavorites(): Promise<FavoritesMap> {
	await initStorage();
	return { ...favoritesCache };
}

/**
 * Get favorites synchronously from cache.
 * Use this for performance-critical operations like sorting.
 * Note: Call initStorage() early in app lifecycle to ensure cache is populated.
 */
export function getFavoritesSync(): FavoritesMap {
	return { ...favoritesCache };
}

/**
 * Set a favorite train.
 */
export async function setFavorite(
	trainNumber: string,
	data: FavoriteTrainData,
): Promise<void> {
	await initStorage();

	// Update cache immediately
	favoritesCache[trainNumber] = data;

	// Persist based on storage type
	if (storageType === "indexeddb") {
		await saveToIndexedDB(trainNumber, data);
	} else if (storageType === "localstorage") {
		saveToLocalStorage(favoritesCache);
	}

	// Dispatch event for other components to update
	dispatchFavoritesChanged();
}

/**
 * Remove a favorite train.
 */
export async function removeFavorite(trainNumber: string): Promise<void> {
	await initStorage();

	// Update cache immediately
	delete favoritesCache[trainNumber];

	// Persist based on storage type
	if (storageType === "indexeddb") {
		await deleteFromIndexedDB(trainNumber);
	} else if (storageType === "localstorage") {
		saveToLocalStorage(favoritesCache);
	}

	// Dispatch event for other components to update
	dispatchFavoritesChanged();
}

/**
 * Update a favorite train (partial update).
 */
export async function updateFavorite(
	trainNumber: string,
	updates: Partial<FavoriteTrainData>,
): Promise<void> {
	await initStorage();

	const existing = favoritesCache[trainNumber];
	if (!existing) return;

	const updated = { ...existing, ...updates };
	await setFavorite(trainNumber, updated);
}

/**
 * Check if a train is favorited.
 */
export function isFavorited(trainNumber: string): boolean {
	return !!favoritesCache[trainNumber]?.highlighted;
}

/**
 * Clean up expired favorites.
 * Call this periodically or when loading the app.
 */
export async function cleanupExpiredFavorites(
	currentTime: Date = new Date(),
): Promise<void> {
	await initStorage();

	const now = currentTime.getTime();
	const toRemove: string[] = [];

	for (const [trainNumber, data] of Object.entries(favoritesCache)) {
		if (data.removeAfter) {
			const removeAt = new Date(data.removeAfter).getTime();
			if (removeAt < now) {
				toRemove.push(trainNumber);
			}
		}
	}

	if (toRemove.length > 0) {
		console.log(`[Storage] Cleaning up ${toRemove.length} expired favorites`);
		for (const trainNumber of toRemove) {
			await removeFavorite(trainNumber);
		}
	}
}

/**
 * Dispatch a custom event when favorites change.
 * Components can listen to this to update their state.
 */
function dispatchFavoritesChanged(): void {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("favorites-changed"));
	}
}

/**
 * Get the current storage type being used.
 */
export function getStorageType(): "indexeddb" | "localstorage" | "memory" {
	return storageType;
}
