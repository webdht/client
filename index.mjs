// Check if we're the top page:
if (window === window.top && navigator.registerProtocolHandler) {
	// Offer to make this the default network client
	navigator.registerProtocolHandler('web+webdht', `${window.location.origin}/?proto=%s`);
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

let hasSA;
if ('hasStorageAccess' in document) {
	hasSA = await document.hasStorageAccess();
	if (!hasSA) {
		try {
			hasSA = await document.requestStorageAccess();
		} catch {}
	}
}

// Check if we're in a secure context:
console.log(`Network-client worker (secure context: ${isSecureContext ? 'yes' : 'no'}; cross-origin-isolated: ${crossOriginIsolated ? 'yes' : 'no'}; has storage access: ${hasSA ? 'yes' : 'no'})`);

// Register (or update the registration of) our service worker:
// TODO: We'll want a service worker eventually, but we don't need it quite yet.
// if ('serviceWorker' in navigator) {
// 	navigator.serviceWorker.register('/service-worker.js'); 
// }

// Create the SharedWorker and send the message port to the top page:
const shared_worker = new SharedWorker("/shared-worker.mjs", { type: 'module' });

// Holder for our assigned RTCPeerConnections
// What should be the key for this map?  It could just be an index.
const port = shared_worker.port;
port.onmessage = worker;

// The worker / handler stuff:
const connections = new Map();
let config;
async function worker(e) {
	console.log(e);
	const {network_client, generate_certificate, connect} = e.data;

	// Pass a network_client API MessagePort to the root page:
	if (network_client) {
		window.top.postMessage({ network_client }, "*", [network_client]);
	}

	// Handle Generating an RTCCertificate
	if (generate_certificate) {
		// Generate the certificate
		const cert = await RTCPeerConnection.generateCertificate({ name: "ECDSA", namedCurve: "P-256" /* TODO: expiration */ });

		// Use a temporary connection to get the fingerprint:
		const temp = new RTCPeerConnection({
			certificates: [cert]
		});
		const _unused = temp.createDataChannel('unused');
		await temp.setLocalDescription();

		const fingerprint = /a=fingerprint:(.+)/.exec(temp.localDescription.sdp)[1];
		console.assert(fingerprint.startsWith('sha-256 '), "Sadge");

		// If available, use a second temporary connection to extract the certificate's raw bytes: (Should work in everything except Firefox)
		let bytes = false;
		if (temp.sctp !== undefined) {
			try {
				const temp2 = new RTCPeerConnection();
				temp.onicecandidate = ({ candidate }) => temp2.addIceCandidate(candidate);
				temp2.onicecandidate = ({ candidate }) => temp.addIceCandidate(candidate);
				await temp2.setRemoteDescription(temp.localDescription);
				await temp2.setLocalDescription();
				const prom = new Promise((res, rej) => {
					const dtls = temp2.sctp.transport;
					dtls.onerror = rej;
					dtls.onstatechange = () => {
						const dtls_state = dtls.state;
						if (dtls_state == 'closed' || dtls_state == 'failed') rej();
						if (dtls_state == 'connected') {
							res(dtls.getRemoteCertificates())
						}
					};
				});
				await temp.setRemoteDescription(temp2.localDescription);
				bytes = await prom;
			} catch(e) { console.warn("Failed to get the certificate bytes", e); }
		}

		// Submit the certificate to our shared worker:
		port.postMessage({ certificate: {
			cert, fingerprint, bytes
		}});
	}
}
