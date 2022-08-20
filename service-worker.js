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
		return new Response(JSON.stringify({ client_id: e.clientId }));
	} else if (e.request.url == get_active) {
		const active_ids = await client.matchAll({ includeUncontrolled: true, type: 'window' })
		.map(c => c.clientId);
		console.log(active_ids);
		return new Response(JSON.stringify({ active_ids }));
	} else {
		return await fetch(e.request);
	}
})());
