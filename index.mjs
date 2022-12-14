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
			await document.requestStorageAccess();
			// If requestStorageAccess doesn't reject, then storage was granted:
			hasSA = true;
		} catch {}
	}
}

// Check if we're in a secure context:
console.log(`Network-client worker (secure context: ${isSecureContext ? 'yes' : 'no'}; cross-origin-isolated: ${crossOriginIsolated ? 'yes' : 'no'}; has storage access: ${hasSA ? 'yes' : 'no'})`);

// Create the SharedWorker and send the message port to the top page:
const shared_worker = new SharedWorker("/shared-worker.mjs", { type: 'module' });

// Holder for our assigned RTCPeerConnections
// What should be the key for this map?  It could just be an index.
const port = shared_worker.port;
port.onmessage = worker;

// The worker / handler stuff:
let rtc_config;
async function worker(e) {
	console.log(e.data);
	const {network_client, config, generate_certificate, connect} = e.data;

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
			const temp2 = new RTCPeerConnection();
			try {
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
			finally {
				temp2.close();
			}
		}
		temp.close();

		// Submit the certificate to our shared worker:
		port.postMessage({ certificate: {
			cert, fingerprint, bytes
		}});
	}

	if (config) {
		rtc_config = config;
	}

	if (connect) {
		route_connect_message(connect);
	}
}

// Connection signalling:
const connections = new Set(); // RTCPeerConnection
function activate_datachannel(dc, peer_fingerprint, connection) {
	// For everybody else, we just have to do message passing:
	function event_handler(e) {
		// Handle transfering arrayBuffers or blobs
		let transfer = [];
		if (e.data instanceof Uint8Array || e.data instanceof Blob) {
			transfer.push(e.data);
		}
		if (dc.id !== 0 && (e.type == 'message' || e.type == 'open')) {
			connection.users.add(dc.id);
		}
		const datachannel = {
			peer_fingerprint, channel_id: dc.id,
			type: e.type,
			data: e.data,
			...e // For events this just transfers the isTrusted, but for custom events, it can include other data:
		};
		if (e.error) datachannel.error = e.error;
		port.postMessage({ datachannel }, { transfer });
	}
	event_handler({
		type: 'created',
		config: {
			bufferedAmountLowThreshold: dc.bufferedAmountLowThreshold,
			label: dc.label,
			maxPacketLifeTime: dc.maxPacketLifeTime,
			maxRetransmits: dc.maxRetransmits,
			negotiated: dc.negotiated,
			ordered: dc.ordered,
			protocol: dc.protocol,
			readyState: dc.readyState
		}
	});
	dc.onopen = dc.onclose = dc.onclosing = dc.onerror = dc.onmessage = dc.bufferedamountlow = event_handler;
	port.addEventListener('message', e => {
		const { datachannel } = e.data;
		if (datachannel) {
			const { peer_fingerprint: pf, channel_id, send, close, bufferedAmountLowThreshold, binaryType, unused } = datachannel;
			if (peer_fingerprint == pf && channel_id == dc.id) {
				if (unused) {
					connection.users.delete(dc.id);
					if (connection.users.size == 0) {
						connection.grim_reaper();
					}
				}
				if (send) {
					dc.send(send);
				}
				if (close) {
					dc.close();
				}
				if (bufferedAmountLowThreshold) {
					dc.bufferedAmountLowThreshold = bufferedAmountLowThreshold;
				}
				if (binaryType) {
					dc.binaryType = binaryType;
				}
			}
		}
	})
}
class PeerConnection extends RTCPeerConnection {
	constructor(connect_message = {}, { enable_munging = false } = {}) {
		super(rtc_config);

		this.remote_connect_message = connect_message;
		this.local_connect_message = {};
		this.users = new Set();

		// Enable_munging means that this connection will offer a munged connect message to the remote peer.
		// We'll still try to respond to a munged connect message if possible, even if enable_munging is false.
		this.options = { enable_munging };

		this.signalling(); // Start running the signalling machine.
		// TODO: Add a finally to the signalling machine that cleans up the PeerConnection?
	}
	handle_connect_message(connect_message) {
		// Apply the connect message to the remote_connect_message
		if (this.remote_connect_message.local_fingerprint && this.remote_connect_message.local_fingerprint != connect_message.local_fingerprint) {
			console.warn("Mis-routed connect message:", connect_message);
			return;
		}
		Object.assign(this.remote_connect_message, connect_message);

		// Step the Signalling machine if it's waiting on a connect message:
		const res_func = this.need_connect;
		this.need_connect = false;
		if (typeof res_func == 'function') {
			res_func();
		}
	}
	gathering_complete() {
		return new Promise(res => {
			const on_state = () => {
				if (this.iceGatheringState == 'complete') {
					res();
					this.removeEventListener('icegatheringstatechange', on_state);
				}
			};
			this.addEventListener('icegatheringstatechange', on_state);
			on_state();
		});
	}
	grim_reaper() {
		if (!this.reaper_handle && this.signalingState !== 'closed') {
			// The grim reaper waits 10sec and if at that time the connection doesn't have any users, it reaps the RTCPeerConnection
			this.reaper_handle = setTimeout(() => {
				if (this.users.size == 0) {
					connections.delete(this);
					this.close();
					console.log("The Grim Reaper reaped", this.remote_connect_message.local_fingerprint);
				} else {
					console.log("The Grim Reaper spared", this.remote_connect_message.local_fingerprint);
				}
				this.reaper_handle = false;
			}, 10 * 1000);
		}
	}
	async signalling() {
		// To make sure connections can't get lost in signalling hell, we notify the reaper.
		this.grim_reaper();

		// Create the common / id0 datachannel:
		const dc = this.createDataChannel('common', {
			ordered: true,
			protocol: "json", // Since the channel isn't negotiated, this isn't really useful.
			negotiated: true,
			id: 0
		});

		// Do we need to mung our local offer?
		let munging_succeeded = false;
		if (this.remote_connect_message.remote_ufrag && this.remote_connect_message.remote_pwd) {
			// Try to mung our local ice credentials:
			try {
				const offer = await this.createOffer();
				offer.sdp.replace(/a=ice-ufrag:(.+)/, `a=ice-ufrag:${this.remote_connect_message.remote_ufrag}`);
				offer.sdp.replace(/a=ice-pwd:(.+)/, `a=ice-pwd:${this.remote_connect_message.remote_pwd}`);
				await this.setLocalDescription(offer);
				munging_succeeded = true;
			} catch(e) { console.warn(e); }
		}

		// If munging failed (or wasn't requested)
		if (this.signalingState !== 'have-local-offer') {
			await this.setLocalDescription();
		}

		// Update our local_connect_message with the new information that we have:
		const local_fingerprint = [...this.localDescription.sdp.matchAll(/a=fingerprint:(.+)/g)].join('\n');
		const local_ufrag = this.localDescription.sdp.match(/a=ice-ufrag:(.+)/);
		const local_pwd = this.localDescription.sdp.match(/a=ice-pwd:(.+)/);
		Object.assign(this.local_connect_message, { local_fingerprint, local_ufrag, local_pwd });

		// Wait for our local candidates to finish gathering:
		await this.gathering_complete();
		const candidates = [...this.localDescription.sdp.matchAll(/a=candidate:(.+)/g)].join('\n');
		this.local_connect_message.candidates = candidates;

		// Cool, local description is finalized.  Do we need to send a connect message?
		const peer_is_public = this.remote_connect_message.local_fingerprint &&
			this.remote_connect_message.candidates &&
			this.remote_connect_message.local_pwd &&
			!this.remote_connect_message.local_ufrag; // Public peers have a password but no ufrag.
		
		const need_send_connect = !peer_is_public && (!this.remote_connect_message.fingerprint || !munging_succeeded);
		if (need_send_connect) {
			port.postMessage({ connect: this.local_connect_message });
		}

		// In order to set the remote description we need to know the remote peer's fingerprint, and to either have munging enabled or to have both the remote peer's ufrag and pwd.
		const can_remote = () => peer_is_public || this.remote_connect_message.local_fingerprint && (
			this.options.enable_munging || (
				this.remote_connect_message.local_ufrag &&
				this.remote_connect_message.local_pwd
			)
		);
		while (!can_remote()) {
			await new Promise(res => this.need_connect = res);
		}

		// At this point we know the fingerprint for the remote peer so we can setup our listeners on the dc
		const remote_fingerprint = this.remote_connect_message.local_fingerprint;
		activate_datachannel(dc, remote_fingerprint, this);
		this.ondatachannel = ({ channel }) => activate_datachannel(channel, remote_fingerprint, this);
		// We can also add a listener to the worker port that will create datachannels on this peer_connection:
		port.addEventListener('message', e => {
			const { datachannel } = e.data;
			if (datachannel) {
				const { peer_fingerprint, channel_id: id, create } = datachannel;
				if (peer_fingerprint == remote_fingerprint) {
					if (create) {
						const config = {
							ordered: create.ordered,
							protocol: create.protocol,
							negotiated: true,
							id,
						};
						if (create.maxPacketLifeTime) {
							config.maxPacketLifeTime = create.maxPacketLifeTime;
						} else if (create.maxRetransmits) {
							config.maxRetransmits = create.maxRetransmits;
						}
						const dc = this.createDataChannel(create.label, config);
						activate_datachannel(dc, remote_fingerprint, this);
					}
				}
			}
		});

		// Make sure we have an ice-ufrag and ice-pwd in the remote connect message:
		function gen_random_ice_str(byte_len) {
			// It's literally just base64 minus the padding!
			// Byte_len is the number of bytes of entropy to use, not the number of resulting characters:
			const bytes = crypto.getRandomValues(new Uint8Array(byte_len));
			const byte_str = bytes.reduce((accum, v) => accum+String.fromCharCode(v), '');
			return btoa(byte_str).replaceAll('=', '');
		}
		if (!this.remote_connect_message.local_ufrag) {
			this.remote_connect_message.local_ufrag = gen_random_ice_str(3);
		}
		if (!this.remote_connect_message.local_pwd) {
			this.remote_connect_message.local_pwd = gen_random_ice_str(16);
		}

		// Apply the remoteDescription
		let remote_sdp = `v=0
o=- 8548884028036365129 2 IN IP4 127.0.0.1
s=-
t=0 0
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=sctp-port:5000
`;
		for (const fingerprint of this.remote_connect_message.local_fingerprint.split('\n')) {
			remote_sdp += `a=fingerprint:${fingerprint}\n`;
		}
		for (const candidate of this.remote_connect_message.candidates.split('\n')) {
			remote_sdp += `a=candidate:${candidate}\n`;
		}
		remote_sdp += `a=ice-ufrag:${this.remote_connect_message.local_ufrag}\n`;
		remote_sdp += `a=ice-pwd:${this.remote_connect_message.local_pwd}\n`;
		if (peer_is_public) {
			remote_sdp += `a=ice-lite\n`;
			remote_sdp += `a=setup:passive\n`;
		}

		await this.setRemoteDescription({ type: 'answer', sdp: remote_sdp });

		// Once the 0 datachannel is openned, send a message to 
	}
}
function route_connect_message(connect_message) {
	// First try to find a connection with the corrisponding fingerprint:
	for (const pc of connections) {
		if (pc.remote_connect_message.fingerprint == connect_message.fingerprint) {
			pc.handle_connect_message(connect_message);
			return;
		}
	}

	// If there's no fingerprint matches, then match by our local ice-ufrag (This connect-message may be a response to oun of our unselected connections)
	for (const pc of connections) {
		if (typeof pc.local_connect_message.local_ufrag == 'string' && pc.local_connect_message.local_ufrag == connect_message.remote_ufrag) {
			pc.handle_connect_message(connect_message);
			return;
		}
	}

	// If neither of those two work, then create a new connection using the connect message:
	connections.add(
		new PeerConnection(connect_message)
	);
}
