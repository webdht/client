import * as hyper_node from "/dist/browser_peer.js";

console.log("Initializing the network-client shared worker");

// TODO: Persist the seed_list and update it as we discover new server peers.
// const seed_list = [
// 	{	fingerprint: "sha-256 C4:33:E7:EA:2B:DD:7A:28:F2:8B:E0:C9:E8:42:95:72:04:CB:67:89:AA:E5:CC:41:68:20:0F:D1:7E:46:D4:BA",
// 		candidates: [
// 			"0 1 udp 2113937151 localhost 4666 typ host", // TODO: Once we have servers running, replace localhost with seed1.webdht.net
// 			"1 1 tcp 2113937151 localhost 4666 typ host tcptype passive",
// 		].join('\n'),
// 		local_pwd: "vK426P4rn7unBHGdnyVz3iXg"
// 	}
// 	// TODO: Fill with Server PeerEntries
// ];

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
	// while (seed_list.length) {
	// 	const connect = seed_list.shift();
	// 	port.postMessage({ connect });
	// }
}

const data_channels = new Set(); // { worker_port, peer_fingerprint, channel_id }
const worker_ports = new Set(); // TODO: enable a ping mechanism to check which workers are still alive.
const connections = new Map(); // Fingerprint -> worker port TODO: Add a second map for ufrags so that we can eventually support routing partial connections.

// Setup our hypernode implementation:
async function start_hyper_node() {
	// Load the hyper node
	let input = await fetch("/dist/browser_peer_bg.wasm");
	input = await input.arrayBuffer();
	await hyper_node.default(input);

	// Give the hyper-node a handle to this context
	hyper_node.set_js_ctx({
		request_connect(connect) {
			let worker = connections.get(connect.local_fingerprint);
			if (!worker || !worker_ports.has(worker)) {
				// Pick a random iframe and assign it to host this connection:
				const all_workers = [...worker_ports];
				worker = all_workers[Math.trunc(all_workers.length * Math.random())];
				connections.set(connect.local_fingerprint, worker);
			}
			if (worker) {
				// connect is a wasm-bindgen thing with a bunch of getters, but we need a non-getter object that we can post:
				const concrete = {
					local_fingerprint: connect.local_fingerprint,
					candidates: connect.candidates,
					local_pwd: connect.local_pwd,
					local_ufrag: connect.local_ufrag,
					remote_fingerprint: connect.remote_fingerprint,
					remote_ufrag: connect.remote_ufrag,
					remote_pwd: connect.remote_pwd
				};
				worker.postMessage({ connect: concrete });
			}
		},
		send_dc_msg(peer_fingerprint, channel_id, msg, transfer = []) {
			// Find the worker for this dc:
			let worker = connections.get(peer_fingerprint);
			if (worker_ports.has(worker)) {
				worker.postMessage({
					datachannel: {
						peer_fingerprint,
						channel_id,
						...msg
					}
				}, { transfer })
			}
		},
		send_text(peer_fingerprint, channel_id, msg) {
			this.send_dc_msg(peer_fingerprint, channel_id, { send: msg });
		},
		send_binary(peer_fingerprint, channel_id, msg) {
			this.send_dc_msg(peer_fingerprint, channel_id, { send: msg }, [msg]);
		},
		unuse_channel(peer_fingerprint, channel_id) {
			this.send_dc_msg(peer_fingerprint, channel_id, { unused: true })
		},
		request_dc(peer_fingerprint, channel_id, config) {
			const concrete = { label: config.label, ordered: config.ordered, maxPacketLifeTime: config.max_packet_life_time, maxRetransmits: config.max_retransmits, protocol: config.protocol}
			this.send_dc_msg(peer_fingerprint, channel_id, { create: concrete })
		}
	});
}

// Handle messages from the iframe
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

		// Start the hypernode
		start_hyper_node();
	}

	// Handle new datachannels:
	if (datachannel) {
		const { peer_fingerprint, channel_id, type, data } = datachannel;
		if (type == 'open' && channel_id == 0) {
			hyper_node.new_peer_connection(peer_fingerprint);
		} else {
			hyper_node.channel_openned(peer_fingerprint, channel_id);
		}
		if (type == 'message') {
			if (typeof data == 'string') {
				hyper_node.handle_text(peer_fingerprint, channel_id, data);
			} else {
				hyper_node.handle_binary(peer_fingerprint, channel_id, data);
			}
		}
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
		activate_worker(e.source);
	}
}
