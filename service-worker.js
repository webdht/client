oninstall = e => e.waitUntil((async () => {
	// Download all the things and stuff...?
})());

onactivate = e => {
	console.log(registration.scope);
}
const get_id = `${registration.scope}client-id`;
const get_active = `${registration.scope}client-active`;
onfetch = e => e.respondWith((async () => {
	console.log(e);
	if (e.request.url == get_id) {
	} else if (e.request.url == get_active) {

	} else {
		return await fetch(e.request);
	}
})());
