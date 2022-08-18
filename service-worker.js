// This is where we implement the WebDHT API.k
function api_handler(port, e) {
	console.log(e);
}

onmessage = e => {
	// TODO: Actually read the message.
	if (e.data == 'Hi.') {
		const {port1, port2} = new MessageChannel();
		port2.onmessage = api_handler.bind(port2);
		e.source.postMessage({ port: port1 }, [port1]);
	} else {
		console.log(e);
	}
};