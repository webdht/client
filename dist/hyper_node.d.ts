/* tslint:disable */
/* eslint-disable */
/**
* @param {any} ctx
*/
export function set_js_ctx(ctx: any): void;
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

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly set_js_ctx: (a: number) => void;
  readonly handle_connect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => number;
  readonly channel_openned: (a: number, b: number, c: number) => void;
  readonly handle_text: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly handle_binary: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
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
