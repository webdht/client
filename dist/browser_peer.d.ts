/* tslint:disable */
/* eslint-disable */
/**
*/
export function start(): void;
/**
* @param {any} ctx
*/
export function set_js_ctx(ctx: any): void;
/**
* @param {string} fingerprint
*/
export function new_peer_connection(fingerprint: string): void;
/**
* @param {string} local_fingerprint
* @param {string} candidates
* @param {string} local_pwd
* @param {string} local_ufrag
* @param {string} remote_fingerprint
* @param {string} remote_ufrag
* @param {string} remote_pwd
* @returns {boolean}
*/
export function handle_connect(local_fingerprint: string, candidates: string, local_pwd: string, local_ufrag: string, remote_fingerprint: string, remote_ufrag: string, remote_pwd: string): boolean;
/**
* @param {string} peer_fingerprint
* @param {number} channel_id
*/
export function channel_openned(peer_fingerprint: string, channel_id: number): void;
/**
* @param {string} peer_fingerprint
* @param {number} channel_id
* @param {string} msg
*/
export function handle_text(peer_fingerprint: string, channel_id: number, msg: string): void;
/**
* @param {string} peer_fingerprint
* @param {number} channel_id
* @param {Uint8Array} msg
*/
export function handle_binary(peer_fingerprint: string, channel_id: number, msg: Uint8Array): void;
/**
*/
export class ConnectMessage {
  free(): void;
/**
*/
  candidates: string;
/**
*/
  local_fingerprint: string;
/**
*/
  local_pwd: string;
/**
*/
  local_ufrag: string;
/**
*/
  remote_fingerprint: string;
/**
*/
  remote_pwd: string;
/**
*/
  remote_ufrag: string;
}
/**
*/
export class DConfig {
  free(): void;
/**
*/
  label: string;
/**
*/
  max_packet_life_time?: number;
/**
*/
  max_retransmits?: number;
/**
*/
  ordered: boolean;
/**
*/
  protocol: string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly start: () => void;
  readonly set_js_ctx: (a: number) => void;
  readonly new_peer_connection: (a: number, b: number) => void;
  readonly handle_connect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => number;
  readonly channel_openned: (a: number, b: number, c: number) => void;
  readonly handle_text: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly handle_binary: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly __wbg_connectmessage_free: (a: number) => void;
  readonly __wbg_get_connectmessage_local_fingerprint: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_local_fingerprint: (a: number, b: number, c: number) => void;
  readonly __wbg_get_connectmessage_candidates: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_candidates: (a: number, b: number, c: number) => void;
  readonly __wbg_get_connectmessage_local_pwd: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_local_pwd: (a: number, b: number, c: number) => void;
  readonly __wbg_get_connectmessage_local_ufrag: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_local_ufrag: (a: number, b: number, c: number) => void;
  readonly __wbg_get_connectmessage_remote_fingerprint: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_remote_fingerprint: (a: number, b: number, c: number) => void;
  readonly __wbg_get_connectmessage_remote_ufrag: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_remote_ufrag: (a: number, b: number, c: number) => void;
  readonly __wbg_get_connectmessage_remote_pwd: (a: number, b: number) => void;
  readonly __wbg_set_connectmessage_remote_pwd: (a: number, b: number, c: number) => void;
  readonly __wbg_dconfig_free: (a: number) => void;
  readonly __wbg_get_dconfig_label: (a: number, b: number) => void;
  readonly __wbg_set_dconfig_label: (a: number, b: number, c: number) => void;
  readonly __wbg_get_dconfig_ordered: (a: number) => number;
  readonly __wbg_set_dconfig_ordered: (a: number, b: number) => void;
  readonly __wbg_get_dconfig_max_packet_life_time: (a: number) => number;
  readonly __wbg_set_dconfig_max_packet_life_time: (a: number, b: number) => void;
  readonly __wbg_get_dconfig_max_retransmits: (a: number) => number;
  readonly __wbg_set_dconfig_max_retransmits: (a: number, b: number) => void;
  readonly __wbg_get_dconfig_protocol: (a: number, b: number) => void;
  readonly __wbg_set_dconfig_protocol: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
