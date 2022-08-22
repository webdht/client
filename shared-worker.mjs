console.log("Initializing the network-client shared worker");

class WorkerDead extends Error {
	constructor() { super("Worker didn't acknowledge the command quickly enough, assuming dead.") }
}
class CommandTimeout extends Error {
	constructor() { super("Worker didn't commplete the command in the designated amount of time.") }
}

let cid = 0;

const workers = new Map();

// Periodically (Every 30sec) do a roll-call to see which pages are still alive
setInterval(async () => {
	const keys = [...workers.keys()];
	for (const key of keys) {
		try {
			await command(key, {still_alive});
		} catch {}
	}
}, 30 * 1000);

function command(worker_id, command, command_timeout = 500) {
	return new Promise((resolve, reject) => {
		const command_id = cid++;
		const port = workers.get(worker_id);

		const ack_timeout = setTimeout(() => {
			reject(new WorkerDead());
			workers.delete(worker_id);
		} , 50);
		const done_timeout = setTimeout(() => reject(new CommandTimeout()), command_timeout);
		const handler = ({ data: { command_id: cid, acknowledge, done } }) => {
			if (cid !== command_id) return;
			if (acknowledge || done !== undefined) {
				clearTimeout(ack_timeout);
			}
			if (done !== undefined) {
				clearTimeout(done_timeout);
				resolve(done);
			}
			port.removeEventListener('message', handler);
		};
		port.addEventListener('message', handler);
		port.postMessage({ ...command, command_id });
	});
}


function api_handler(port, e) {
	console.log(e);

	port.postMessage("Message Received.");
}

function worker_handler(iframe_port, e) {
	const { identify } = e.data;
	if (identify) workers.set(identify, iframe_port);
	// TODO: Handle datachannels and datachannel messages?
}

onconnect = function(e) {
	console.log('New iframe', e);
	const { port1: network_client, port2 } = new MessageChannel();
	port2.onmessage = api_handler.bind(null, port2);
	e.source.onmessage = worker_handler.bind(null, e.source);
	e.source.postMessage({ network_client }, { transfer: [network_client ]});
}

// TODO: Bootstrap into the webdht network.
