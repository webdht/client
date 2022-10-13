import * as hyper_node from "/dist/browser_peer.js";

console.log("Initializing the network-client shared worker");

// So... I'm not going to check if the certificate has expired: The cert will be valid for 30 days so if the user hasn't closed their browser for 30 days without updating etc. then they deserve to get a broken website.
// TODO: Just kidding... Fix the config to update the certificate or maybe refresh the iframes + shared worker?
let config = false;
let our_fingerprint = "";

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
		},
		local_fingerprint() {
			return our_fingerprint;
		}
	});
}

// Handle messages from the iframe
async function worker_handler(e) {
	console.log("Worker Message", e.data);
	const { certificate, datachannel_raw, datachannel } = e.data;

	if (certificate) {
		const { cert, fingerprint, bytes } = certificate;
		our_fingerprint = fingerprint;

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

	// Handle datachannels:
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
