// Check if we're the top page:
if (window === window.top && navigator.registerProtocolHandler) {
	// Offer to make this the default network client
	navigator.registerProtocolHandler('web+dht', `${window.location.origin}/?proto=%s`);
	document.body.insertAdjacentHTML('beforeend',
		`<a href="javascript:navigator.registerProtocolHandler('web+webdht', '${window.location.origin}/?proto=%s');">Set as default network client</a>`
	);
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

// Check if we're in a secure context:
console.log(`Network-client worker (secure context: ${isSecureContext ? 'yes' : 'no'}; cross-origin-isolated: ${crossOriginIsolated ? 'yes' : 'no'})`);

// Register (or update the registration of) our service worker:
// TODO: We'll want a service worker eventually, but we don't need it quite yet.
// if ('serviceWorker' in navigator) {
// 	navigator.serviceWorker.register('/service-worker.js'); 
// }

// Create the SharedWorker and send the message port to the top page:
const worker = new SharedWorker("/shared-worker.mjs", { type: 'module' });

// Generate a random id for this iframe worker:
const client_id = btoa((new Uint8Array(16)).reduce((a, v) => a + String.fromCharCode(v), ''));

// Identify ourself to the SharedWorker so that it can start assigning us Connections:
worker.port.postMessage({ identify: client_id });

const port = worker.port;
// Start handling commands from the SharedWorker:
port.onmessage = e => {

	const { network_client, command_id, still_alive } = e.data;
	if (network_client) {
		window.top.postMessage({ network_client }, "*", [network_client]);
	}

	if (command_id) {
		port.postMessage({ command_id, acknowledge: true });
	}

	if (still_alive) {
		port.postMessage({ command_id, done: true });
	}
};
