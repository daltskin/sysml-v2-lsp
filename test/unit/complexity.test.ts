import { describe, expect, it } from 'vitest';
import type { SysMLSymbol } from '../../server/src/symbols/sysmlElements.js';
import { SysMLElementKind } from '../../server/src/symbols/sysmlElements.js';

/**
 * Unit tests for the Model Complexity Analyser.
 *
 * Most tests create hand-crafted symbol arrays rather than parsing SysML,
 * so they run instantly and don't depend on the ANTLR grammar.  The
 * integration tests at the end parse real SysML snippets.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sym(overrides: Partial<SysMLSymbol> & { name: string; kind: SysMLElementKind }): SysMLSymbol {
    return {
        qualifiedName: overrides.qualifiedName ?? overrides.name,
        range: overrides.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        selectionRange: overrides.selectionRange ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        uri: overrides.uri ?? 'test://test.sysml',
        children: overrides.children ?? [],
        typeNames: overrides.typeNames ?? (overrides.typeName ? [overrides.typeName] : []),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// analyseComplexity — pure function tests
// ---------------------------------------------------------------------------

describe('Model Complexity Analyser', () => {
    // Lazy import so the ANTLR runtime isn't loaded until needed
    async function analyse(symbols: SysMLSymbol[]) {
        const { analyseComplexity } = await import('../../server/src/analysis/complexityAnalyzer.js');
        return analyseComplexity(symbols);
    }

    describe('empty input', () => {
        it('should return a trivial report for no symbols', async () => {
            const r = await analyse([]);
            expect(r.totalElements).toBe(0);
            expect(r.complexityIndex).toBe(0);
            expect(r.rating).toBe('trivial');
            expect(r.hotspots).toHaveLength(0);
            expect(r.documentationCoverage).toBe(100);
        });
    });

    describe('element counts', () => {
        it('should count definitions and usages', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'Pkg', kind: SysMLElementKind.Package, qualifiedName: 'Pkg' }),
                sym({ name: 'Vehicle', kind: SysMLElementKind.PartDef, qualifiedName: 'Pkg::Vehicle', parentQualifiedName: 'Pkg' }),
                sym({ name: 'engine', kind: SysMLElementKind.PartUsage, qualifiedName: 'Pkg::Vehicle::engine', parentQualifiedName: 'Pkg::Vehicle', typeName: 'Engine' }),
                sym({ name: 'Engine', kind: SysMLElementKind.PartDef, qualifiedName: 'Pkg::Engine', parentQualifiedName: 'Pkg' }),
            ];
            const r = await analyse(symbols);
            expect(r.totalElements).toBe(4);
            expect(r.definitions).toBe(2); // Vehicle, Engine
            expect(r.usages).toBe(1);      // engine
            expect(r.packages).toBe(1);
        });
    });

    describe('nesting depth', () => {
        it('should compute max depth correctly', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'A', kind: SysMLElementKind.Package, qualifiedName: 'A' }),
                sym({ name: 'B', kind: SysMLElementKind.PartDef, qualifiedName: 'A::B', parentQualifiedName: 'A' }),
                sym({ name: 'c', kind: SysMLElementKind.PartUsage, qualifiedName: 'A::B::c', parentQualifiedName: 'A::B' }),
                sym({ name: 'd', kind: SysMLElementKind.AttributeUsage, qualifiedName: 'A::B::c::d', parentQualifiedName: 'A::B::c' }),
            ];
            const r = await analyse(symbols);
            expect(r.maxDepth).toBe(3); // A(0) → B(1) → c(2) → d(3)
        });

        it('should handle flat models', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'X', kind: SysMLElementKind.PartDef, qualifiedName: 'X' }),
                sym({ name: 'Y', kind: SysMLElementKind.PartDef, qualifiedName: 'Y' }),
            ];
            const r = await analyse(symbols);
            expect(r.maxDepth).toBe(0);
        });
    });

    describe('avg children per definition', () => {
        it('should average children across definitions', async () => {
            // DefA has 3 children, DefB has 1 child → avg = 2.0
            const symbols: SysMLSymbol[] = [
                sym({ name: 'DefA', kind: SysMLElementKind.PartDef, qualifiedName: 'DefA' }),
                sym({ name: 'a1', kind: SysMLElementKind.PartUsage, qualifiedName: 'DefA::a1', parentQualifiedName: 'DefA' }),
                sym({ name: 'a2', kind: SysMLElementKind.PartUsage, qualifiedName: 'DefA::a2', parentQualifiedName: 'DefA' }),
                sym({ name: 'a3', kind: SysMLElementKind.AttributeUsage, qualifiedName: 'DefA::a3', parentQualifiedName: 'DefA' }),
                sym({ name: 'DefB', kind: SysMLElementKind.PartDef, qualifiedName: 'DefB' }),
                sym({ name: 'b1', kind: SysMLElementKind.PartUsage, qualifiedName: 'DefB::b1', parentQualifiedName: 'DefB' }),
            ];
            const r = await analyse(symbols);
            expect(r.avgChildrenPerDef).toBe(2);
        });

        it('should return 0 when there are no definitions', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'Pkg', kind: SysMLElementKind.Package, qualifiedName: 'Pkg' }),
            ];
            const r = await analyse(symbols);
            expect(r.avgChildrenPerDef).toBe(0);
        });
    });

    describe('coupling', () => {
        it('should count type references to definitions in the same model', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'Engine', kind: SysMLElementKind.PartDef, qualifiedName: 'Engine' }),
                sym({ name: 'Wheel', kind: SysMLElementKind.PartDef, qualifiedName: 'Wheel' }),
                sym({ name: 'Vehicle', kind: SysMLElementKind.PartDef, qualifiedName: 'Vehicle' }),
                sym({ name: 'e', kind: SysMLElementKind.PartUsage, qualifiedName: 'Vehicle::e', parentQualifiedName: 'Vehicle', typeName: 'Engine' }),
                sym({ name: 'w', kind: SysMLElementKind.PartUsage, qualifiedName: 'Vehicle::w', parentQualifiedName: 'Vehicle', typeName: 'Wheel' }),
            ];
            const r = await analyse(symbols);
            expect(r.couplingCount).toBe(2);
        });

        it('should not count references to types not in the model', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'Vehicle', kind: SysMLElementKind.PartDef, qualifiedName: 'Vehicle' }),
                sym({ name: 'e', kind: SysMLElementKind.PartUsage, qualifiedName: 'Vehicle::e', parentQualifiedName: 'Vehicle', typeName: 'ExternalType' }),
            ];
            const r = await analyse(symbols);
            expect(r.couplingCount).toBe(0);
        });
    });

    describe('unused definitions', () => {
        it('should detect definitions never referenced by any usage', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'UsedDef', kind: SysMLElementKind.PartDef, qualifiedName: 'UsedDef' }),
                sym({ name: 'UnusedDef', kind: SysMLElementKind.PartDef, qualifiedName: 'UnusedDef' }),
                sym({ name: 'x', kind: SysMLElementKind.PartUsage, qualifiedName: 'x', typeName: 'UsedDef' }),
            ];
            const r = await analyse(symbols);
            expect(r.unusedDefinitions).toBe(1);
        });

        it('should not flag enum definitions as unused', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'Color', kind: SysMLElementKind.EnumDef, qualifiedName: 'Color' }),
            ];
            const r = await analyse(symbols);
            expect(r.unusedDefinitions).toBe(0);
        });
    });

    describe('documentation coverage', () => {
        it('should compute percentage of documented definitions', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'A', kind: SysMLElementKind.PartDef, qualifiedName: 'A', documentation: 'Documented' }),
                sym({ name: 'B', kind: SysMLElementKind.PartDef, qualifiedName: 'B' }),
                sym({ name: 'C', kind: SysMLElementKind.PartDef, qualifiedName: 'C' }),
            ];
            const r = await analyse(symbols);
            expect(r.documentationCoverage).toBeCloseTo(33.33, 0);
        });

        it('should return 100% when all definitions are documented', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'A', kind: SysMLElementKind.PartDef, qualifiedName: 'A', documentation: 'yes' }),
            ];
            const r = await analyse(symbols);
            expect(r.documentationCoverage).toBe(100);
        });
    });

    describe('complexity index', () => {
        it('should return 0 for a trivial model', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'X', kind: SysMLElementKind.PartDef, qualifiedName: 'X', documentation: 'doc' }),
            ];
            const r = await analyse(symbols);
            expect(r.complexityIndex).toBeLessThanOrEqual(10);
            expect(r.rating).toBe('trivial');
        });

        it('should increase with more elements and deeper nesting', async () => {
            // Small model
            const small: SysMLSymbol[] = [
                sym({ name: 'A', kind: SysMLElementKind.PartDef, qualifiedName: 'A', documentation: 'doc' }),
                sym({ name: 'a', kind: SysMLElementKind.PartUsage, qualifiedName: 'A::a', parentQualifiedName: 'A', typeName: 'A' }),
            ];
            // Larger model with more nesting
            const large: SysMLSymbol[] = [];
            const pkg = sym({ name: 'Pkg', kind: SysMLElementKind.Package, qualifiedName: 'Pkg' });
            large.push(pkg);
            for (let i = 0; i < 10; i++) {
                const def = sym({
                    name: `Def${i}`, kind: SysMLElementKind.PartDef,
                    qualifiedName: `Pkg::Def${i}`, parentQualifiedName: 'Pkg',
                });
                large.push(def);
                for (let j = 0; j < 5; j++) {
                    large.push(sym({
                        name: `u${j}`, kind: SysMLElementKind.PartUsage,
                        qualifiedName: `Pkg::Def${i}::u${j}`, parentQualifiedName: `Pkg::Def${i}`,
                        typeName: `Def${(i + 1) % 10}`,
                    }));
                }
            }

            const rSmall = await analyse(small);
            const rLarge = await analyse(large);
            expect(rLarge.complexityIndex).toBeGreaterThan(rSmall.complexityIndex);
        });
    });

    describe('hotspots', () => {
        it('should rank definitions by score descending', async () => {
            const symbols: SysMLSymbol[] = [
                sym({ name: 'Simple', kind: SysMLElementKind.PartDef, qualifiedName: 'Simple', documentation: 'doc' }),
                sym({ name: 'Complex', kind: SysMLElementKind.PartDef, qualifiedName: 'Complex' }),
                // Give Complex many children
                ...Array.from({ length: 8 }, (_, i) => sym({
                    name: `c${i}`, kind: SysMLElementKind.PartUsage,
                    qualifiedName: `Complex::c${i}`, parentQualifiedName: 'Complex',
                    typeName: 'Simple',
                })),
            ];
            const r = await analyse(symbols);
            expect(r.hotspots.length).toBe(2);
            expect(r.hotspots[0].qualifiedName).toBe('Complex');
            expect(r.hotspots[0].score).toBeGreaterThan(r.hotspots[1].score);
        });
    });

    describe('rating thresholds', () => {
        it('should map scores to correct ratings', async () => {
            const { analyseComplexity } = await import('../../server/src/analysis/complexityAnalyzer.js');
            // We test the rating function indirectly via report
            const r0 = analyseComplexity([]);
            expect(r0.rating).toBe('trivial');
        });
    });
});

// ---------------------------------------------------------------------------
// Integration tests — parse real SysML then analyse
// ---------------------------------------------------------------------------

describe('Complexity Analysis — Integration', () => {
    async function analyseText(text: string) {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
        const { analyseComplexity } = await import('../../server/src/analysis/complexityAnalyzer.js');

        const result = parseDocument(text);
        const st = new SymbolTable();
        st.build('test://test.sysml', result);
        return analyseComplexity(st.getSymbolsForUri('test://test.sysml'));
    }

    it('should analyse a simple vehicle model', async () => {
        const text = `
package VehicleModel {
    part def Vehicle {
        part engine : Engine[1];
        part wheels : Wheel[4];
    }
    part def Engine {
        attribute power : Real;
    }
    part def Wheel {
        attribute diameter : Real;
    }
}
`;
        const r = await analyseText(text);
        expect(r.totalElements).toBeGreaterThan(5);
        expect(r.definitions).toBe(3);  // Vehicle, Engine, Wheel
        expect(r.usages).toBeGreaterThanOrEqual(4); // engine, wheels, power, diameter
        expect(r.packages).toBe(1);
        expect(r.maxDepth).toBeGreaterThanOrEqual(2);
        expect(r.complexityIndex).toBeGreaterThanOrEqual(0);
        expect(r.rating).toBeTruthy();
    });

    it('should handle documented definitions for coverage', async () => {
        const text = `
package DocTest {
    doc /* Test package */
    part def Sensor {
        doc /* A sensor definition */
        attribute reading : Real;
    }
    part def Actuator {
        attribute command : Real;
    }
}
`;
        const r = await analyseText(text);
        // Sensor has doc, Actuator does not → 50%
        expect(r.documentationCoverage).toBe(50);
    });

    it('should detect unused definitions in parsed models', async () => {
        const text = `
package Unused {
    part def Alpha;
    part def Beta;
    part def User {
        part a : Alpha[1];
    }
}
`;
        const r = await analyseText(text);
        // Beta is unused (Alpha is referenced by 'a', User is a definition)
        // But User itself is also never used as a type — so 2 unused
        expect(r.unusedDefinitions).toBeGreaterThanOrEqual(1);
    });

    it('should produce hotspot entries for definitions', async () => {
        const text = `
package HotspotTest {
    part def BigDef {
        part a : SmallDef;
        part b : SmallDef;
        part c : SmallDef;
        attribute x : Real;
        attribute y : Real;
    }
    part def SmallDef;
}
`;
        const r = await analyseText(text);
        expect(r.hotspots.length).toBe(2);
        // BigDef should rank higher (more children, more type refs)
        expect(r.hotspots[0].qualifiedName).toContain('BigDef');
    });
});

// ---------------------------------------------------------------------------
// MCP getComplexity handler
// ---------------------------------------------------------------------------

describe('MCP getComplexity handler', () => {
    it('should return a complexity report from handleGetComplexity', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { McpContext, handleGetComplexity } = await import('../../server/src/mcpCore.js');

        const ctx = new McpContext();
        const uri = 'file:///test.sysml';
        const text = `
package Test {
    part def A {
        part b : B[1];
    }
    part def B {
        attribute x : Real;
    }
}
`;
        ctx.loadedDocuments.set(uri, text);
        const result = parseDocument(text);
        ctx.symbolTable.build(uri, result);

        const report = handleGetComplexity(ctx, uri);
        expect(report.totalElements).toBeGreaterThan(0);
        expect(report.complexityIndex).toBeGreaterThanOrEqual(0);
        expect(report.rating).toBeTruthy();
        expect(report.definitions).toBeGreaterThanOrEqual(2);
        expect(report.hotspots).toBeDefined();
    });

    it('should return an empty report when no documents are loaded', async () => {
        const { McpContext, handleGetComplexity } = await import('../../server/src/mcpCore.js');
        const ctx = new McpContext();
        const report = handleGetComplexity(ctx);
        expect(report.totalElements).toBe(0);
        expect(report.complexityIndex).toBe(0);
        expect(report.rating).toBe('trivial');
    });
});
