// This is where we implement the WebDHT API.
function api_handler(port, e) {
	console.log(e);

	port.postMessage("Message Received.");
}

onmessage = e => {
	// TODO: Actually read the message.
	if (e.data == 'Hi.') {
		const {port1, port2} = new MessageChannel();
		port2.onmessage = api_handler.bind(null, port2);
		e.source.postMessage({ port: port1 }, [port1]);
		port2.postMessage("This test from sw.");
	} else {
		console.log(e);
	}
};

clients.claim();
