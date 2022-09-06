console.log("Initializing the network-client shared worker");



const workers = new Map();

// Fetch or create our DHT identity keypair (ECDSA P256)


function api_handler(port, e) {
	console.log(e);

	port.postMessage("Message Received.");
}

function worker_handler(iframe_port, e) {
	const { identify } = e.data;
	if (identify) workers.set(identify, iframe_port);
	// TODO: Handle datachannels and datachannel messages?
}

onconnect = function(e) {
	console.log('New iframe', e);
	const { port1: network_client, port2 } = new MessageChannel();
	port2.onmessage = api_handler.bind(null, port2);
	e.source.onmessage = worker_handler.bind(null, e.source);
	e.source.postMessage({ network_client }, { transfer: [network_client ]});
}

// TODO: Bootstrap into the webdht network.
