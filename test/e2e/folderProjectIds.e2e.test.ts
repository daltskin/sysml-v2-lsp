/**
 * End-to-end test of a projectId per workspace folder: the server asks the
 * client for each folder's `sysml.project` (`workspace/configuration`, scoped
 * to the folder) before scanning it, at start and when a folder is added, and
 * gives a top-level element a symbol ID unique to its folder's projectId (KerML 9.1).
 *
 * Requires `dist/server/server.js` -- `npm run test:e2e` builds it first.
 */
import { fork } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_URL_PREFIX, NAMESPACE_URL, uuidV5 } from '../../server/src/utils/uuid.js';

const serverPath = fileURLToPath(new URL('../../dist/server/server.js', import.meta.url));
const PROJECT_A = '3f9c2b1e-7a4d-4e8b-9c2f-1d5e6a7b8c9d';
const PROJECT_B = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const WORKSPACE_PROJECT = 'c0ffee00-1234-4abc-8def-001122334455';
const PROJECT_C = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';

/** Resolves once `condition` holds, checking every 50 ms for up to 10 s. */
async function until(condition: () => boolean) {
    const deadline = Date.now() + 10_000;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Condition never held');
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

/** The symbol ID of a top-level element `name` under a projectId, or without one. */
const topLevelId = (name: string, projectId?: string) =>
    uuidV5(NAMESPACE_URL, `${projectId ? `urn:uuid:${projectId}/` : DEFAULT_URL_PREFIX}${name}`);

/** The client's connection, from the `vscode-jsonrpc` copy `startServer` loads. */
type Connection = import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js').MessageConnection;

/** How `startServer` starts the server and answers it. */
interface ServerOptions {
    /** The server's `initializationOptions` (`isWorkspaceFile` is set). */
    initializationOptions?: object;
    /** Delay before answering each `workspace/configuration` request. */
    answerDelayMs?: number;
    /** Run after `initialized` is sent, before waiting for the workspace scan. */
    beforeScan?: (connection: Connection) => Promise<void>;
    /** Run while a `workspace/configuration` request is pending, with the scopes it asks `sysml.project` for. */
    beforeAnswer?: (connection: Connection, projectScopes: string[]) => Promise<void>;
    /** Run once the answer to a `workspace/configuration` request is sent, with the scopes it answered `sysml.project` for. */
    afterAnswer?: (connection: Connection, projectScopes: string[]) => void;
}

/**
 * Starts the real server on the workspace folders `folders`, answering `sysml.project` from `projectOf`,
 * read when a request arrives, as a client reads its settings then.
 */
async function startServer(
    folders: string[],
    projectOf: (folderUri: string) => string | undefined,
    { initializationOptions = {}, answerDelayMs = 0, beforeScan, beforeAnswer, afterAnswer }: ServerOptions = {},
) {
    const rpc = await import('../../server/node_modules/vscode-jsonrpc/lib/node/main.js');
    const child = fork(serverPath, ['--node-ipc'], { silent: true });
    const connection = rpc.createMessageConnection(new rpc.IPCMessageReader(child), new rpc.IPCMessageWriter(child));
    connection.onRequest('client/registerCapability', () => null);
    connection.onRequest('workspace/configuration', async (params: { items: { scopeUri?: string; section?: string }[] }) => {
        const projectScopes = params.items.flatMap(item => (item.section === 'sysml.project' && item.scopeUri ? [item.scopeUri] : []));
        const answer = params.items.map(item => (item.section === 'sysml.project' && item.scopeUri ? { projectId: projectOf(item.scopeUri) } : {}));
        await beforeAnswer?.(connection, projectScopes);
        await new Promise(resolve => setTimeout(resolve, answerDelayMs));
        // A timer runs after the answer returned here is sent
        if (afterAnswer) setTimeout(() => afterAnswer(connection, projectScopes));
        return answer;
    });
    const logs: string[] = [];
    connection.onNotification('window/logMessage', (params: { message: string }) => { logs.push(params.message); });

    /** Resolves once a log message starting with `prefix` arrives after the first `seen` ones. */
    async function logged(prefix: string, seen = 0) {
        const deadline = Date.now() + 10_000;
        while (!logs.slice(seen).some(message => message.startsWith(prefix))) {
            if (Date.now() > deadline) throw new Error(`No "${prefix}" log: ${JSON.stringify(logs)}`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    connection.listen();
    await connection.sendRequest('initialize', {
        processId: process.pid,
        rootUri: null,
        workspaceFolders: folders.map(f => ({ uri: pathToFileURL(f).toString(), name: f })),
        capabilities: { workspace: { configuration: true, workspaceFolders: true } },
        initializationOptions: { isWorkspaceFile: true, ...initializationOptions },
    });
    await connection.sendNotification('initialized', {});
    await beforeScan?.(connection);
    await logged('Workspace scan:');

    /** The symbol ID of the first top-level element `sysml/model` reports for the file `path`. */
    async function firstSymbolId(path: string) {
        const model = await connection.sendRequest<{ elements?: { symbolId: string }[] }>(
            'sysml/model', { textDocument: { uri: pathToFileURL(path).toString() }, scope: ['elements'] });
        return model.elements?.[0]?.symbolId;
    }

    /**
     * The URL prefix and its source the server last logged for the folder `path`
     * (`Folder <uri>: top-level elements' URLs start with <prefix> (<source>)`).
     */
    function loggedPrefix(path: string) {
        const line = `Folder ${pathToFileURL(path).toString()}: top-level elements' URLs start with `;
        const message = logs.filter(m => m.startsWith(line)).at(-1);
        const match = message?.slice(line.length).match(/^(\S+) \((.+)\)$/);
        return match ? { prefix: match[1], source: match[2] } : undefined;
    }

    /** The document version `sysml/model` reports for the file `path`; -1 when the server doesn't index it. */
    async function modelVersion(path: string) {
        const model = await connection.sendRequest<{ version: number }>(
            'sysml/model', { textDocument: { uri: pathToFileURL(path).toString() }, scope: ['elements'] });
        return model.version;
    }

    /** Removes the folder `path` from the workspace and waits for the server to forget its documents. */
    async function removeFolder(path: string, documentPath: string) {
        await connection.sendNotification('workspace/didChangeWorkspaceFolders', {
            event: { added: [], removed: [{ uri: pathToFileURL(path).toString(), name: path }] },
        });
        const deadline = Date.now() + 10_000;
        while (await modelVersion(documentPath) !== -1) {
            if (Date.now() > deadline) throw new Error(`${documentPath} is still indexed`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    /** Waits until the file `path`'s first top-level element has the symbol ID `expected`, re-asking `sysml/model`. */
    async function untilSymbolId(path: string, expected: string) {
        const deadline = Date.now() + 10_000;
        while (await firstSymbolId(path) !== expected) {
            if (Date.now() > deadline) throw new Error(`${path} never got symbol ID ${expected}`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    /** Adds the folder `path` to the workspace and waits for its scan. */
    async function addFolder(path: string) {
        const seen = logs.length;
        await connection.sendNotification('workspace/didChangeWorkspaceFolders', {
            event: { added: [{ uri: pathToFileURL(path).toString(), name: path }], removed: [] },
        });
        await logged('Workspace scan:', seen);
    }

    return { connection, logs, firstSymbolId, loggedPrefix, modelVersion, addFolder, removeFolder, untilSymbolId, dispose: () => { connection.dispose(); child.kill(); } };
}

describe('a projectId per workspace folder (sysml.project)', () => {
    let root: string;
    let server: Awaited<ReturnType<typeof startServer>> | undefined;

    afterEach(async () => {
        server?.dispose();
        server = undefined;
        await rm(root, { recursive: true, force: true });
    });

    async function workspace(): Promise<{ folderA: string; folderB: string; projectOf: (folderUri: string) => string | undefined; projects: Record<string, string> }> {
        root = await mkdtemp(join(tmpdir(), 'sysml-folder-projects-'));
        const folderA = join(root, 'a');
        const folderB = join(root, 'b');
        await mkdir(folderA);
        await mkdir(folderB);
        await writeFile(join(folderA, 'x.sysml'), 'package Shared;\n');
        await writeFile(join(folderB, 'y.sysml'), 'package Shared;\n');
        const projects: Record<string, string> = { [pathToFileURL(folderA).toString()]: PROJECT_A, [pathToFileURL(folderB).toString()]: PROJECT_B };
        return { folderA, folderB, projectOf: (folderUri: string) => projects[folderUri], projects };
    }

    it("gives each folder's top-level elements its own projectId's symbol IDs", async () => {
        const { folderA, folderB, projectOf } = await workspace();
        server = await startServer([folderA, folderB], projectOf);

        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared', PROJECT_B));
    }, 30_000);

    it("logs each folder's URL prefix, from which its documents' symbol IDs are derived", async () => {
        const { folderA, folderB, projectOf } = await workspace();
        server = await startServer([folderA, folderB], projectOf);

        expect(server.loggedPrefix(folderA)).toEqual({ prefix: `urn:uuid:${PROJECT_A}/`, source: 'its projectId' });
        expect(server.loggedPrefix(folderB)).toEqual({ prefix: `urn:uuid:${PROJECT_B}/`, source: 'its projectId' });
        for (const [folder, file] of [[folderA, 'x.sysml'], [folderB, 'y.sysml']]) {
            expect(await server.firstSymbolId(join(folder, file))).toBe(uuidV5(NAMESPACE_URL, `${server.loggedPrefix(folder)!.prefix}Shared`));
        }
    }, 30_000);

    it('logs the default prefix for a folder without a projectId, and an enclosing folder\'s for a nested one', async () => {
        const { folderA, folderB } = await workspace();
        const nested = join(folderA, 'nested');
        await mkdir(nested);
        await writeFile(join(nested, 'z.sysml'), 'package Inner;\n');
        const projects: Record<string, string> = { [pathToFileURL(folderA).toString()]: PROJECT_A };
        server = await startServer([folderA, nested, folderB], folderUri => projects[folderUri]);

        expect(server.loggedPrefix(nested)).toEqual({ prefix: `urn:uuid:${PROJECT_A}/`, source: "an enclosing folder's projectId" });
        expect(server.loggedPrefix(folderB)).toEqual({ prefix: DEFAULT_URL_PREFIX, source: 'the default prefix, no projectId' });
        expect(await server.firstSymbolId(join(nested, 'z.sysml'))).toBe(topLevelId('Inner', PROJECT_A));
        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared'));
    }, 30_000);

    it("asks for an added folder's projectId and scans it", async () => {
        const { folderA, folderB, projectOf } = await workspace();
        server = await startServer([folderA], projectOf);
        await server.addFolder(folderB);

        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared', PROJECT_B));
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);

    it('forgets the scanned documents of a removed folder, keeping the other folders\' ones', async () => {
        const { folderA, folderB, projectOf } = await workspace();
        server = await startServer([folderA, folderB], projectOf);
        expect(await server.modelVersion(join(folderB, 'y.sysml'))).not.toBe(-1);

        await server.removeFolder(folderB, join(folderB, 'y.sysml'));

        expect(await server.modelVersion(join(folderB, 'y.sysml'))).toBe(-1);
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);

    it("asks for the projectIds again on a configuration change, giving a folder's documents its new projectId's symbol IDs", async () => {
        const { folderA, folderB, projectOf, projects } = await workspace();
        server = await startServer([folderA, folderB], projectOf);
        projects[pathToFileURL(folderB).toString()] = PROJECT_A;

        await server.connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });

        await server.untilSymbolId(join(folderB, 'y.sysml'), topLevelId('Shared', PROJECT_A));
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);

    it('falls back to initializationOptions.projectId for a folder without a projectId', async () => {
        const { folderA, folderB, projects } = await workspace();
        server = await startServer([folderA, folderB], (folderUri) => projects[folderUri], { initializationOptions: { projectId: WORKSPACE_PROJECT } });
        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared', PROJECT_B));
        delete projects[pathToFileURL(folderB).toString()];
        await server.connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });

        await server.untilSymbolId(join(folderB, 'y.sysml'), topLevelId('Shared', WORKSPACE_PROJECT));
        expect(server.loggedPrefix(folderB)).toEqual({ prefix: `urn:uuid:${WORKSPACE_PROJECT}/`, source: 'initializationOptions.projectId' });
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);

    it('re-derives the symbol IDs of a document opened before its folder was added', async () => {
        const { folderA, folderB, projectOf } = await workspace();
        server = await startServer([folderA], projectOf);
        const uri = pathToFileURL(join(folderB, 'y.sysml')).toString();
        await server.connection.sendNotification('textDocument/didOpen', {
            textDocument: { uri, languageId: 'sysml', version: 1, text: 'package Shared;\n' },
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared'));

        await server.addFolder(folderB);

        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared', PROJECT_B));
    }, 30_000);

    it("answers sysml/model asked during initialization, before the projectIds arrive, with the projectId's symbol IDs", async () => {
        const { folderA, projectOf } = await workspace();
        const uri = pathToFileURL(join(folderA, 'x.sysml')).toString();
        let early: string | undefined;

        // Every workspace/configuration answer is slow, so the request arrives while the server
        // is still in its `initialized` phase, before it knows the folder's projectId.
        server = await startServer([folderA], projectOf, { answerDelayMs: 500, beforeScan: async connection => {
            await connection.sendNotification('textDocument/didOpen', {
                textDocument: { uri, languageId: 'sysml', version: 1, text: 'package Shared;\n' },
            });
            const model = await connection.sendRequest<{ elements?: { symbolId: string }[] }>('sysml/model', { textDocument: { uri }, scope: ['elements'] });
            early = model.elements?.[0]?.symbolId;
        } });

        expect(early).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);
});


/**
 * Folders or settings that change at a chosen moment: while the server waits for
 * the client's answer to its `sysml.project` request, or while it scans a folder.
 */
describe('folder and configuration changes during a projectId request or a scan', () => {
    let root: string;
    let server: Awaited<ReturnType<typeof startServer>> | undefined;

    afterEach(async () => {
        server?.dispose();
        server = undefined;
        await rm(root, { recursive: true, force: true });
    });

    /** Folders `a`, `b` and `c`, each with one document, and the projectIds of `a` and `b`. */
    async function workspace() {
        root = await mkdtemp(join(tmpdir(), 'sysml-folder-projects-'));
        const [folderA, folderB, folderC] = ['a', 'b', 'c'].map(name => join(root, name));
        for (const folder of [folderA, folderB, folderC]) await mkdir(folder);
        await writeFile(join(folderA, 'x.sysml'), 'package Shared;\n');
        await writeFile(join(folderB, 'y.sysml'), 'package Shared;\n');
        await writeFile(join(folderC, 'z.sysml'), 'package Other;\n');
        const projects: Record<string, string> = { [pathToFileURL(folderA).toString()]: PROJECT_A, [pathToFileURL(folderB).toString()]: PROJECT_B };
        return { folderA, folderB, folderC, projectOf: (folderUri: string) => projects[folderUri], projects };
    }

    /** The `workspace/didChangeWorkspaceFolders` notification adding `added` and removing `removed`. */
    const changeFolders = (connection: Connection, added: string[], removed: string[]) =>
        connection.sendNotification('workspace/didChangeWorkspaceFolders', {
            event: {
                added: added.map(f => ({ uri: pathToFileURL(f).toString(), name: f })),
                removed: removed.map(f => ({ uri: pathToFileURL(f).toString(), name: f })),
            },
        });

    it("doesn't give a folder another folder's projectId when its answer arrives after the folders changed", async () => {
        const { folderA, folderB, projectOf, projects } = await workspace();
        const folderUriA = pathToFileURL(folderA).toString();
        let armed = false;
        let holding = false;
        let laterAnswered: (() => void) | undefined;
        let staleAnswered!: () => void;
        const stale = new Promise<void>(resolve => { staleAnswered = resolve; });

        // Folder A is removed while the projectIds of [A, B] are asked for again, and that answer
        // is sent after the one to the request the removal makes: matched to the folders by
        // position, it would give B the (new) projectId of A.
        server = await startServer([folderA, folderB], projectOf, {
            beforeAnswer: async (connection, scopes) => {
                if (!armed || !scopes.includes(folderUriA)) return;
                armed = false;
                holding = true;
                const later = new Promise<void>(resolve => { laterAnswered = resolve; });
                await changeFolders(connection, [], [folderA]);
                await later;
            },
            afterAnswer: (_connection, scopes) => {
                if (scopes.length > 0 && !scopes.includes(folderUriA)) laterAnswered?.();
                if (holding && scopes.includes(folderUriA)) { holding = false; staleAnswered(); }
            },
        });
        projects[folderUriA] = WORKSPACE_PROJECT;
        armed = true;
        await server.connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
        // The server handles the stale answer before the requests below, sent after it
        await stale;

        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared', PROJECT_B));
        expect(server.loggedPrefix(folderB)).toEqual({ prefix: `urn:uuid:${PROJECT_B}/`, source: 'its projectId' });
    }, 30_000);

    it('follows a folder added while the server is still starting', async () => {
        const { folderA, folderB, projectOf } = await workspace();
        let changed = false;

        // Folder B is added while the server's first projectId request is pending.
        server = await startServer([folderA], projectOf, {
            beforeAnswer: async (connection, scopes) => {
                if (changed || scopes.length === 0) return;
                changed = true;
                await changeFolders(connection, [folderB], []);
            },
        });

        expect(changed).toBe(true);
        await server.untilSymbolId(join(folderB, 'y.sysml'), topLevelId('Shared', PROJECT_B));
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);

    it("doesn't scan a folder removed while its projectId is asked for", async () => {
        const { folderA, folderB, folderC, projectOf } = await workspace();
        const folderUriB = pathToFileURL(folderB).toString();
        let changed = false;

        // Folder B is removed again while the projectIds after its addition are asked for.
        server = await startServer([folderA], projectOf, {
            beforeAnswer: async (connection, scopes) => {
                if (changed || !scopes.includes(folderUriB)) return;
                changed = true;
                await changeFolders(connection, [], [folderB]);
            },
        });
        await changeFolders(server.connection, [folderB], []);
        // Adding folder C and waiting for its scan lets the addition of B settle first
        await server.addFolder(folderC);

        expect(changed).toBe(true);
        expect(await server.modelVersion(join(folderB, 'y.sysml'))).toBe(-1);
        expect(await server.modelVersion(join(folderC, 'z.sysml'))).not.toBe(-1);
    }, 30_000);

    it("doesn't apply a projectId answer that arrives after the answer to a later configuration change", async () => {
        const { folderB, folderA, projectOf, projects } = await workspace();
        const folderUriB = pathToFileURL(folderB).toString();
        let armed = false;
        let releasing = false;
        let laterAnswered: (() => void) | undefined;
        let staleAnswered!: () => void;
        const stale = new Promise<void>(resolve => { staleAnswered = resolve; });

        // A first configuration change gives B another projectId; while the server asks for it,
        // a second change gives B yet another one, and the first answer is sent after the second.
        server = await startServer([folderA, folderB], projectOf, {
            beforeAnswer: async (connection, scopes) => {
                if (!armed || !scopes.includes(folderUriB)) return;
                armed = false;
                const later = new Promise<void>(resolve => { laterAnswered = resolve; });
                projects[folderUriB] = PROJECT_C;
                await connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
                await later;
                releasing = true;
            },
            afterAnswer: (_connection, scopes) => {
                if (!scopes.includes(folderUriB)) return;
                if (releasing) { releasing = false; staleAnswered(); } else laterAnswered?.();
            },
        });
        projects[folderUriB] = WORKSPACE_PROJECT;
        armed = true;
        await server.connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
        // The server handles the stale answer before the requests below, sent after it
        await stale;

        await server.untilSymbolId(join(folderB, 'y.sysml'), topLevelId('Shared', PROJECT_C));
        expect(server.loggedPrefix(folderB)).toEqual({ prefix: `urn:uuid:${PROJECT_C}/`, source: 'its projectId' });
    }, 30_000);

    it("doesn't index the documents of a folder removed while it is being scanned", async () => {
        const { folderA, folderB, projectOf } = await workspace();
        // Enough documents that the scan is still discovering and reading them when the removal arrives
        for (let i = 0; i < 200; i++) await writeFile(join(folderB, `p${i}.sysml`), `package P${i};\n`);
        const folderUriB = pathToFileURL(folderB).toString();
        let armed = false;

        // The removal is sent right after the answer that lets the server start scanning B.
        server = await startServer([folderA], projectOf, {
            afterAnswer: (connection, scopes) => {
                if (!armed || !scopes.includes(folderUriB)) return;
                armed = false;
                void changeFolders(connection, [], [folderB]);
            },
        });
        armed = true;
        await server.addFolder(folderB);

        expect(armed).toBe(false);
        expect(await server.modelVersion(join(folderB, 'y.sysml'))).toBe(-1);
        expect(await server.modelVersion(join(folderB, 'p199.sysml'))).toBe(-1);
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);

    it('scans a folder added while the initial scan runs, and reports indexing complete only once both scans are done', async () => {
        const { folderA, folderB, projectOf } = await workspace();
        // Enough documents that the initial scan of A still runs when B is added
        for (let i = 0; i < 300; i++) await writeFile(join(folderA, `p${i}.sysml`), `package P${i};\n`);
        const folderUriA = pathToFileURL(folderA).toString();
        let armed = true;
        const isAddedScan = (message: string) => message.startsWith('Workspace scan:') && message.includes('added folder');
        const isInitialScan = (message: string) => message.startsWith('Workspace scan:') && !message.includes('added folder');

        // B is added right after the answer that lets the server start its initial scan.
        server = await startServer([folderA], projectOf, {
            afterAnswer: (connection, scopes) => {
                if (!armed || !scopes.includes(folderUriA)) return;
                armed = false;
                void changeFolders(connection, [folderB], []);
            },
        });
        const { logs } = server;
        await until(() => logs.some(isAddedScan));
        const early = await server.connection.sendRequest<{ indexingComplete: boolean }>('sysml/elementLookup', { queries: [] });
        // The log of a finished scan arrives before this answer
        expect(early.indexingComplete).toBe(logs.some(isInitialScan));

        await until(() => logs.some(isInitialScan));
        const late = await server.connection.sendRequest<{ indexingComplete: boolean }>('sysml/elementLookup', { queries: [] });
        expect(late.indexingComplete).toBe(true);
        expect(await server.firstSymbolId(join(folderB, 'y.sysml'))).toBe(topLevelId('Shared', PROJECT_B));
        expect(await server.firstSymbolId(join(folderA, 'x.sysml'))).toBe(topLevelId('Shared', PROJECT_A));
    }, 30_000);
});
