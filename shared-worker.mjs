console.log("Initializing the network-client shared worker");

// TODO: Persist the seed_list and update it as we discover new server peers.
const seed_list = [
	// TODO: Fill with Server PeerEntries
];

// So... I'm not going to check if the certificate has expired: The cert will be valid for 30 days so if the user hasn't closed their browser for 30 days without updating etc. then they deserve to get a broken website.
let config = false;

function api_handler(e) {
	console.log("API message", e);
}

function activate_worker(port) {
	// 1. Send the worker our rtc config
	port.postMessage({ config });

	// 2. Send the worker an api message port (for it to pass on to it's parent page)
	const { port1: network_client, port2 } = new MessageChannel();
	port2.onmessage = api_handler;
	port.postMessage({ network_client }, { transfer: [network_client] });
}

const data_channels = new Set(); // { worker_port, peer_id, channel_id }
const worker_ports = new Set(); // TODO: enable a ping mechanism to check which workers are still alive.
async function worker_handler(e) {
	console.log("Worker Message", e);
	const { certificate, new_channel } = e.data;

	if (certificate) {
		const { cert, fingerprint, bytes } = certificate;
		// TODO: Store our own fingerprint (peer_id) and certificate bytes somewhere.

		// Send our rtcpeerconnection configuration to all our workers:
		const certificates = [cert];
		
		// Retrieve some TURN servers:
		let iceServers = [];
		try {
			const res = await fetch("/request-turn", { method: "POST" });
			const { ice_servers } = await res.json();
			iceServers = ice_servers;
		} catch {}

		config = {
			certificates, iceServers
		};

		// Activate all our workers:
		for (const p of worker_ports) {
			activate_worker(p);
		}
	}

	if (new_channel) {
		// TODO:
	}
}

onconnect = function(e) {
	console.log('New iframe', e);

	// Handle messages from the worker
	worker_ports.add(e.source);
	e.source.onmessage = worker_handler;

	if (!config) {
		if (config === false) {
			// Ask the new peer to generate a certificate:
			e.source.postMessage({ generate_certificate: true });
			config = null;
		}
	} else {
		activate_worker(e.source.port);
	}
}
