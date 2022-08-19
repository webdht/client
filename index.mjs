// Check if we're the top page:
if (window === window.top && navigator.registerProtocolHandler) {
	// Offer to make this the default network client
	navigator.registerProtocolHandler('web+dht', `${window.location.origin}/?proto=%s`);
	document.body.insertAdjacentHTML('beforeend',
		`<a href="javascript:navigator.registerProtocolHandler('web+webdht', '${window.location.origin}/?proto=%s');">Set as default network client</a>`
	);
}

// Register our listener for messages from the Service worker
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.onmessage = e => {
		const {port} = e.data;
		if (port) {
			window.top.postMessage({ network_client: port }, "*", [port]);
		}
	};
}

// If we're not the user's network client, then try to switch to their network client
const params = new URL(window.location).searchParams;
if (!params.has('proto') && 'registerProtocolHandler' in navigator) {
	try {
		window.location = `web+webdht:${params.get('args') ?? ''}`;

		// Wait for a timeout to see if our page get's replaced:
		await new Promise(res => setTimeout(res, 1000));
	} catch {}

	// Looks like the page wasn't replaced, so carry on as a fallback network client.
}

// Register (or update the registration of) our service worker:
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js'); 
}

// Create the SharedWorker and send the message port to the top page:
const worker = new SharedWorker("/shared-worker");
worker.port.onmessage = e => {
	
};
