import { v5 } from 'uuid';

/**
 * Namespace for the UUIDs of model elements identified by their qualified
 * name: the version 5 UUID of `https://github.com/daltskin/sysml-v2-lsp/element`
 * in the URL namespace of RFC 9562.
 */
export const ELEMENT_ID_NAMESPACE = '14d0b988-1476-5df1-a519-5691d6ee118e';

/**
 * Namespace for the UUIDs of model elements identified through their owner
 * (anonymous elements and their members), kept apart from
 * `ELEMENT_ID_NAMESPACE` so no qualified name, however it is quoted, can give
 * the same UUID: the version 5 UUID of
 * `https://github.com/daltskin/sysml-v2-lsp/owned-element` in the URL namespace.
 */
export const OWNED_ELEMENT_ID_NAMESPACE = 'ec7ecd4e-be90-53d2-9ae3-8a373660f1ff';

/**
 * The name-based (version 5) UUID of `name` in `namespace`: the same
 * namespace and name always give the same UUID.
 */
export function uuidV5(namespace: string, name: string): string {
    return v5(name, namespace);
}
