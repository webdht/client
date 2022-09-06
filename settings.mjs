function idbwr(request, extra = {}) {
	// Wrap an IndexedDb Request
	return new Promise((resolve, reject) => {
		request.onblocked = () => reject(request.error);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		for (const key in extra) {
			request[key] = extra[key];
		}
	});
}

// Connect to / setup the IndexedDb:
const db = await idbwr(indexedDB.open('settings', 1), { onupgradeneeded({target: { result: db }}) {
	db.createObjectStore('settings')
}});
console.log(db);

// Get a value from the settings database, if it doesn't exist or the validate func returns false, then replace the setting with the result of the default func.
export async function get(key, default_func, validate_func) {
	let value = db.transaction('settings')
}
