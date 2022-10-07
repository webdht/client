console.log("Initializing the network-client shared worker");

// TODO: Persist the seed_list and update it as we discover new server peers.
const seed_list = [
	{	fingerprint: "sha-256 C4:33:E7:EA:2B:DD:7A:28:F2:8B:E0:C9:E8:42:95:72:04:CB:67:89:AA:E5:CC:41:68:20:0F:D1:7E:46:D4:BA",
		candidates: [
			"0 1 udp 2113937151 localhost 4666 typ host", // TODO: Once we have servers running, replace localhost with seed1.webdht.net
			"1 1 tcp 2113937151 localhost 4666 typ host tcptype passive",
		].join('\n'),
		local_pwd: "vK426P4rn7unBHGdnyVz3iXg"
	}
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

	// 3. Kickoff bootstrapping?
	while (seed_list.length) {
		const connect = seed_list.shift();
		port.postMessage({ connect });
	}
}

const data_channels = new Set(); // { worker_port, peer_fingerprint, channel_id }
const worker_ports = new Set(); // TODO: enable a ping mechanism to check which workers are still alive.
async function worker_handler(e) {
	console.log("Worker Message", e.data);
	const { certificate, datachannel_raw, datachannel } = e.data;

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

	// Handle new datachannels:
	if (datachannel_raw) {
		data_channels.add(datachannel_raw);
		console.log('datachannel', datachannel_raw);
	}
	if (datachannel && datachannel.type == 'created') {
		const dc = new ProxiedChannel(e.target, datachannel);
		data_channels.add(dc);
		console.log('datachannel', dc);
	}
}

class ProxiedChannel extends EventTarget {
	constructor(worker_port, { peer_fingerprint, channel_id }) {
		super();
		this.worker_port = worker_port;
		this.peer_fingerprint = peer_fingerprint;
		this.channel_id = channel_id;
		this.abort_controller = new AbortController();

		// Add an event listener on the worker port to proxy messages to this object:
		worker_port.addEventListener('message', e => {
			const { datachannel } = e.data;
			if (datachannel && datachannel.peer_fingerprint == this.peer_fingerprint && datachannel.channel_id == this.channel_id) {
				// This message is for us:
				if (datachannel.type) {
					// This must be an event
					const event = new CustomEvent(datachannel.type);
					delete datachannel.type;
					delete datachannel.isTrusted;
					delete datachannel.peer_fingerprint,
					delete datachannel.channel_id;
					for (const key in datachannel) {
						event[key] = datachannel[key];
					}
					console.log("Proxied Event: ", event);
					this.dispatchEvent(event);
				} else {
					// What kind of message is this?
				}
			}
		}, { signal: this.abort_controller.signal });
	}
	send(data) {
		const transfer = (typeof data !== 'string') ? [data] : []
		this.post_message({ send: data }, transfer);
	}
	close() {
		this.post_message({ close: true });
		this.abort_controller.abort();
	}
	post_message(data, transfer = []) {
		// Handle when the worker has died.
		if (!worker_ports.has(this.worker_port)) {
			// Trigger a close:
			this.dispatchEvent(new CustomEvent('close'));
			this.abort_controller.abort();
			return;
		}

		// Post the data with our datachannel identification.
		this.worker_port.postMessage({ datachannel: {
			peer_fingerprint: this.peer_fingerprint,
			channel_id: this.channel_id,
			...data
		}}, { transfer })
	}
	set bufferedAmountLowThreshold(bufferedAmountLowThreshold) {
		this.post_message({ bufferedAmountLowThreshold });
	}
	set binaryType(binaryType) {
		this.post_message({ binaryType });
	}
	get bufferedAmount() {
		throw new Error("Sorry, bufferedAmount doesn't work on ProxiedChannel");
	}
	get readyState() {
		throw new Error("Sorry, readyState doesn't work on ProxiedChannel");
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
