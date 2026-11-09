import { NAMESPACE_URL, getUrlPrefix, uuidV5 } from '../utils/uuid.js';

/**
 * The derivation of the symbol IDs the server reports (`RegistryIds`), reported
 * in its `initialize` result, so a client that stores symbol IDs knows when a
 * new release derives them differently. Changed with every such change.
 */
export const SYMBOL_ID_SCHEME = 'element-registry/1';

export const RegistryIds = {
    /**
     * A top-level element, a member of the one root namespace of the workspace:
     * its URL is the project's URL prefix of its document and its path there.
     */
    topLevel(uri: string, path: string): string {
        return uuidV5(NAMESPACE_URL, getUrlPrefix(uri) + encodeURIComponent(path));
    },
    /** A nested element: its path (KerML 8.3.2.1.2 `path()`) in the namespace of its top-level element's ID. */
    member(topLevelId: string, path: string): string {
        return uuidV5(topLevelId, path);
    },
    /** A relationship its owner declares: its key (kind and target as written) in a namespace of the owner's own. */
    relationship(ownerId: string, key: string): string {
        return uuidV5(uuidV5(ownerId, 'relationships'), key);
    },
} as const;
