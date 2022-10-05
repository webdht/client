console.log("Initializing the network-client shared worker");

// TODO: Persist the seed_list and update it as we discover new server peers.
const seed_list = [
	// TODO: Fill with Server PeerEntries
];

// So... I'm not going to check if the certificate has expired: The cert will be valid for 30 days so if the user hasn't closed their browser for 30 days without updating etc. then they deserve to get a broken website.
let certificate = false;

function api_handler(e) {
	console.log(e);

	port.postMessage("Message Received.");
}

let worker_id = 1;
const workers = new Map();
function worker_handler(e) {

}

onconnect = function(e) {
	console.log('New iframe', e);

	// Handle messages from the worker
	e.source.onmessage = worker_handler;

	if (certificate === false) {
		// Ask the new peer to generate a certificate:
		e.source.postMessage({ generate_certitifcate: true });
	} else {
		const { port1: network_client, port2 } = new MessageChannel();
		port2.onmessage = api_handler.bind(null, port2);
		e.source.onmessage = worker_handler.bind(null, e.source);
		e.source.postMessage({ network_client }, { transfer: [network_client ]});
	}
}
