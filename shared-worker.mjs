console.log("Initializing the network-client shared worker");

function api_handler(port, e) {
	console.log(e);

	port.postMessage("Message Received.");
}

function worker_handler(iframe_port, e) {
	
}

onconnect = function(e) {
	console.log('New iframe', e);
	const { port1: network_client, port2 } = new MessageChannel();
	port2.onmessage = api_handler.bind(null, port2);
	e.source.onmessage = worker_handler.bind(null, e.source);
	e.source.postMessage({ network_client }, { transfer: [network_client ]});
}

// TODO: Bootstrap into the webdht network.
