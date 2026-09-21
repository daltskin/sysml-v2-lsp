/**
 * Type-name reference resolution: whether a `: Type` reference resolves,
 * combining namespace/import visibility (`NamespaceResolver`, §7.5) with
 * standard-library/ISQ type recognition. Shared between `SemanticValidator`
 * (editor diagnostics) and `SysMLModelProvider` (the `sysml/model` request's
 * own diagnostics) so both agree on what "resolved" means.
 */

import { resolveLibraryType } from '../library/libraryIndex.js';
import { NamespaceResolver, SymbolIndexes } from './namespaceResolver.js';
import { SysMLSymbol } from './sysmlElements.js';

/**
 * Standard library types that are always available (from Kernel libraries).
 * These should not trigger "unresolved type" warnings.
 */
export const STANDARD_LIBRARY_TYPES = new Set([
    // Kernel Data Types
    'Boolean', 'String', 'Integer', 'Real', 'Natural', 'Positive',
    'Complex', 'Number', 'Rational',
    'ScalarValues', 'DataFunctions',
    // Kernel Semantic Library
    'Anything', 'Nothing', 'Object', 'Occurrence',
    'Base', 'Objects', 'Occurrences', 'Items', 'Parts', 'Ports',
    'Actions', 'States', 'Connections', 'Interfaces', 'Allocations',
    'Requirements', 'Constraints', 'Calculations', 'Cases', 'Flows',
    'Transfers', 'Performances', 'TransitionPerformances',
    // Common library packages
    'ISQ', 'SI', 'USCustomaryUnits',
    'Quantities', 'MeasurementReferences', 'ScalarValues',
    // StandardViewDefinitions (SysML v2 standard library)
    'GeneralView', 'InterconnectionView', 'ActionFlowView',
    'StateTransitionView', 'SequenceView', 'GeometryView',
    'GridView', 'BrowserView', 'StandardViewDefinitions',
    // Views library (rendering types)
    'View', 'ViewpointCheck', 'Rendering',
    'TextualRendering', 'GraphicalRendering', 'TabularRendering',
    'Views',
    // ISQ Base quantities (ISO 80000)
    'LengthValue', 'MassValue', 'DurationValue', 'TimeValue',
    'ElectricCurrentValue', 'ThermodynamicTemperatureValue', 'TemperatureValue',
    'AmountOfSubstanceValue', 'LuminousIntensityValue',
    // ISQ Derived quantities (commonly used)
    'AreaValue', 'VolumeValue', 'SpeedValue', 'VelocityValue', 'AccelerationValue',
    'ForceValue', 'EnergyValue', 'PowerValue', 'PressureValue',
    'TorqueValue', 'MomentOfForceValue', 'AngularVelocityValue', 'FrequencyValue',
    'DensityValue', 'MassFlowRateValue', 'VolumeFlowRateValue',
    // ISQ units
    'LengthUnit', 'MassUnit', 'DurationUnit', 'TimeUnit',
]);

/**
 * Check for ISQ quantity value types (e.g., LengthValue, TorqueValue).
 * These start with an uppercase letter, contain only letters, and end in "Value".
 */
export function isISQValueType(name: string): boolean {
    if (!name.endsWith('Value') || name.length < 6) return false;
    const ch0 = name.charCodeAt(0);
    if (ch0 < 65 || ch0 > 90) return false; // must start uppercase
    for (let i = 1; i < name.length; i++) {
        const c = name.charCodeAt(i);
        if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) return false;
    }
    return true;
}

/**
 * Whether `typeName` (as written on `symbol`, e.g. `"Type"` in `part x : Type`)
 * resolves: namespace/import-visible (§7.5, via `resolver`), a known
 * standard-library type, an ISQ quantity-value type, or a lowercase feature
 * reference (`:>` subsetting rather than a type reference -- e.g. `attribute
 * x :> distancePerVolume`). Also strips concatenated keywords that leak
 * through when a parser's getText() merges e.g. "Type redefines foo" into
 * "TyperedefinesFoo", so callers building a diagnostic message use the
 * cleaned-up `strippedTypeName`, not the raw one.
 */
export function resolveTypeName(
    typeName: string,
    symbol: SysMLSymbol,
    resolver: NamespaceResolver,
    indexes: SymbolIndexes,
    libraryNames: Set<string>,
): { resolved: boolean; strippedTypeName: string } {
    const kwMatch = typeName.match(/^([A-Z][A-Za-z_0-9]*?)(redefines|subsets|references|connect|bind|default|via|accept|send|flow|allocate|assign|decide|merge|join|fork)([A-Z])/);
    const strippedTypeName = kwMatch ? kwMatch[1] : typeName;
    const rootSegment = strippedTypeName.split('::')[0];

    const resolved =
        resolver.isLocallyVisible(symbol, strippedTypeName, indexes) ||
        STANDARD_LIBRARY_TYPES.has(strippedTypeName) ||
        STANDARD_LIBRARY_TYPES.has(rootSegment) ||
        libraryNames.has(rootSegment) ||
        isISQValueType(strippedTypeName) ||
        resolveLibraryType(strippedTypeName) !== undefined ||
        resolveLibraryType(rootSegment) !== undefined ||
        // Names starting with lowercase are feature references (subsettings
        // via :>), not type references — don't flag them as unresolved types.
        (strippedTypeName.charCodeAt(0) >= 97 && strippedTypeName.charCodeAt(0) <= 122);

    return { resolved, strippedTypeName };
}
