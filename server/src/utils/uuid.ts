import { v5, validate } from 'uuid';

/**
 * The UUID namespace for names that are URLs (RFC 9562, ITU-T X.667 D.9):
 * KerML 9.1 derives a top-level symbol's ID from its URL in this namespace.
 */
export const NAMESPACE_URL = v5.URL;

/**
 * The URL prefix of top-level elements when no project ID is set: symbol IDs
 * are then unique only within one workspace.
 */
export const DEFAULT_URL_PREFIX = 'https://github.com/daltskin/sysml-v2-lsp/';

/** Environment variable through which a client gives the MCP server its project ID (see `setProjectId`). */
export const PROJECT_ID_ENV_VAR = 'SYSML_PROJECT_ID';

let urlPrefix = DEFAULT_URL_PREFIX;

/**
 * Set the project whose elements get symbol IDs: its top-level elements' URLs start
 * with `urn:uuid:<projectId>/` (KerML 9.1 requires a unique URL per top-level
 * element). Set once, before any document is indexed; `undefined` restores the
 * default. Returns false, changing nothing, for a `projectId` that isn't a UUID.
 */
export function setProjectId(projectId: string | undefined): boolean {
    if (projectId === undefined) {
        urlPrefix = DEFAULT_URL_PREFIX;
        return true;
    }
    if (!validate(projectId)) return false;
    urlPrefix = `urn:uuid:${projectId.toLowerCase()}/`;
    return true;
}

/** The URL prefix of top-level elements (see `setProjectId`). */
export function getUrlPrefix(): string {
    return urlPrefix;
}

/**
 * The name-based (version 5) UUID of `name` in `namespace`: the same
 * namespace and name always give the same UUID.
 */
export function uuidV5(namespace: string, name: string): string {
    return v5(name, namespace);
}
