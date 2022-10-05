// Listen for the message port from the network client
const nc_port = new Promise(resolve => {
	function on_message(e) {
		const { network_client } = e.data;
		if (network_client) {
			resolve(network_client);
			window.removeEventListener('message', on_message);
		}
	}
	window.addEventListener('message', on_message);
});

// Add an iframe to the fallback network-client page:
const iframe = document.createElement('iframe');
iframe.src = "https://client.webdht.net"; // TODO: Add configuration for the network-client fallback.
iframe.style = "display: none;";
document.body.append(iframe);

// Wait for the network-client to do it's stuff and give us a nc_port:
const port = await nc_port;

console.log("Network client sdk loaded.", port);
port.onmessage = function nc_handler(e) {
	console.log(e);
}
port.postMessage("This is a test");


export const bootstrapped = new Promise(() => {
	// TODO:
});

// DHT operations:
export async function lookup(key, {mode = 'recursive'} = {}) {

}
export async function put(key, value, { signature } = {}) {
	// The value must either hash to the key or the key must be a hash of a public key and the signature a valid signature over the value using that public key.

}
export async function* rendezvous(key, webrtc_config = {}) {

}

// TODO: Manual seeding
export async function seed(connect_message) {

}
