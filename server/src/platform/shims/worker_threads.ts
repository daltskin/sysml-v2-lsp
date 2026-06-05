/**
 * Browser shim for `node:worker_threads`.
 *
 * The browser build runs ANTLR parsing inline on the worker that hosts
 * the language server (nested workers are intentionally avoided).  The
 * server's `spawnParseWorker()` is wrapped in a try/catch and falls
 * back to main-thread parsing when worker construction fails, so this
 * stub simply makes that fallback engage.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export class Worker {
    constructor(_path: string, _opts?: unknown) {
        throw new Error('worker_threads is not available in the browser; using inline parsing');
    }
    on(_event: string, _cb: (...args: unknown[]) => void): this { return this; }
    postMessage(_value: unknown): void { /* no-op */ }
    terminate(): Promise<number> { return Promise.resolve(0); }
}

export const parentPort: null = null;
export const isMainThread = true;

export function receiveMessageOnPort(_port: unknown): undefined {
    return undefined;
}

export default { Worker, parentPort, isMainThread, receiveMessageOnPort };
