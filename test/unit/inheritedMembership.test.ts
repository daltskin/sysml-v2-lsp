/**
 * Name resolution through inherited memberships (KerML 7.3.2.1, 7.3.2.2,
 * 8.2.3.5.3, 8.3.3.1.10 `Type::inheritedMemberships`): a definition's or
 * usage's members include the non-private members of the types it
 * specializes, less the features redefined there, and a redefined feature is
 * resolved from the generals of the redefining feature's owner (8.2.3.5.1) --
 * not to an unrelated element of the same name elsewhere.
 */
import { describe, expect, it } from 'vitest';

/** The declaration line go-to-definition finds for the first `name` after `marker` in `text`. */
async function definitionLine(text: string, marker: string, name: string): Promise<string | undefined> {
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { DefinitionProvider } = await import('../../server/src/providers/definitionProvider.js');
    const uri = 'test://inherited.sysml';
    const doc = TextDocument.create(uri, 'sysml', 1, text);
    const dm = new DocumentManager();
    dm.parse(doc);
    const offset = text.indexOf(name, text.indexOf(marker)) + 1;
    const location = new DefinitionProvider(dm).provideDefinition({ textDocument: { uri }, position: doc.positionAt(offset) });
    return location ? text.split('\n')[location.range.start.line].trim() : undefined;
}

/** The resolved members of the namespace named `qualifiedName`, by name, as their qualified names. */
async function resolvedMembers(text: string, qualifiedName: string): Promise<Map<string, (string | undefined)[]>> {
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { buildSymbolIndexes, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
    const dm = new DocumentManager();
    dm.parse(TextDocument.create('test://inherited.sysml', 'sysml', 1, text));
    const symbolTable = dm.getWorkspaceSymbolTable();
    const indexes = buildSymbolIndexes(symbolTable.getAllSymbols());
    const members = new NamespaceResolver().getResolvedMembers(symbolTable.getSymbol(qualifiedName)!, indexes);
    return new Map([...members].map(([name, entries]) => [name, entries.map(entry => entry.symbol.qualifiedName)]));
}

/** What `name`, redefined by a feature of the type named `owningType`, resolves to (KerML 8.2.3.5.1). */
async function redefinedFeature(text: string, owningType: string, name: string): Promise<string | undefined> {
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { buildSymbolIndexes, NamespaceResolver } = await import('../../server/src/symbols/namespaceResolver.js');
    const dm = new DocumentManager();
    dm.parse(TextDocument.create('test://inherited.sysml', 'sysml', 1, text));
    const symbolTable = dm.getWorkspaceSymbolTable();
    const indexes = buildSymbolIndexes(symbolTable.getAllSymbols());
    return new NamespaceResolver().resolveRedefinedFeature(symbolTable.getSymbol(owningType)!, name, indexes).symbol?.qualifiedName;
}

describe('name resolution through inherited memberships (KerML 7.3.2.1, 8.2.3.5.3)', () => {
    // A root-level `part2` the unqualified name must not resolve to.
    const subsetting = (redefinition: string) => `package Decoy {
    part part2;
}
package Redefinition {
    part def Part2;
    part def Part2R :> Part2;
    part part1 {
        part part2 : Part2 [0..*];
    }
    part part1S :> part1 {
        part part2R : Part2R ${redefinition} part2;
    }
}`;

    it('resolves a redefined feature to the one inherited through subsetting, `:>>` and `redefines` alike', async () => {
        expect(await definitionLine(subsetting(':>>'), 'part2R', 'part2;')).toBe('part part2 : Part2 [0..*];');
        expect(await definitionLine(subsetting('redefines'), 'part2R', 'part2;')).toBe('part part2 : Part2 [0..*];');
    });

    it('resolves the redefined feature of the SysML v2 spec\'s example (Table 4, "Redefinition")', async () => {
        // The spec's textual notation, with its definitions, beside a same-named `part2` declared elsewhere.
        const text = `package Other {
    part part2;
}
package Example {
    part def Part1;
    part def Part1S :> Part1;
    part def Part2;
    part def Part2R :> Part2;
    part part1 : Part1 [0..*] {
        part part2 : Part2 [0..*];
    }
    part part1S : Part1S [1] :> part1 {
        part part2R : Part2R :>> part2;
    }
}`;
        expect(await definitionLine(text, 'part2R', 'part2;')).toBe('part part2 : Part2 [0..*];');
        expect(await redefinedFeature(text, 'Example::part1S', 'part2')).toBe('Example::part1::part2');
        // part2R redefines part2, so part1S doesn't inherit it (`removeRedefinedFeatures`).
        const members = await resolvedMembers(text, 'Example::part1S');
        expect(members.get('part2R')).toEqual(['Example::part1S::part2R']);
        expect(members.has('part2')).toBe(false);
    });

    it('resolves a feature inherited through a usage\'s typing by a definition', async () => {
        const text = `package P {
    part wheels;
    part def Vehicle {
        part wheels [4];
    }
    part car : Vehicle {
        part spare :> wheels;
    }
}`;
        expect(await definitionLine(text, 'spare', 'wheels;')).toBe('part wheels [4];');
    });

    it('resolves a feature inherited through two levels of specialization', async () => {
        const text = `package P {
    part p [2];
    part def A {
        part p;
    }
    part def B :> A;
    part b : B {
        part q :>> p;
    }
}`;
        expect(await definitionLine(text, 'part q', 'p;')).toBe('part p;');
    });

    it('resolves a feature an anonymous usage inherits from its type', async () => {
        const text = `package P {
    part wheels;
    part def Vehicle {
        part wheels [4];
    }
    part : Vehicle {
        part spare :> wheels;
    }
}`;
        expect(await definitionLine(text, 'spare', 'wheels;')).toBe('part wheels [4];');
    });

    it('resolves an inherited feature by its short name, as by its name (KerML 8.2.3.5.3)', async () => {
        const text = `package P {
    part <w> wheel;
    part def Vehicle {
        part <w> wheels [4];
    }
    part car : Vehicle {
        part spare :> w;
    }
}`;
        expect(await definitionLine(text, 'spare', 'w;')).toBe('part <w> wheels [4];');
        expect((await resolvedMembers(text, 'P::car')).get('w')).toEqual(['P::Vehicle::wheels']);
    });

    it('does not inherit a feature an owned feature redefines, even under the same name', async () => {
        const text = `package P {
    part def A {
        part p;
        part r;
    }
    part def B :> A {
        part p :>> A::p;
    }
}`;
        const members = await resolvedMembers(text, 'P::B');
        expect(members.get('p')).toEqual(['P::B::p']);
        expect(members.get('r')).toEqual(['P::A::r']);
    });

    it('resolves a plain reference to a feature redefined under another name outward, not to the inherited one', async () => {
        const text = `package P {
    part old;
    part def A {
        part old [1];
    }
    part def B :> A {
        part renamed :>> old;
        part copy :> old;
    }
}`;
        expect(await definitionLine(text, 'renamed', 'old;')).toBe('part old [1];');
        expect(await definitionLine(text, 'copy', 'old;')).toBe('part old;');
    });

    it('resolves a reference in a redefining feature\'s body by normal name resolution, not as its redefinition target', async () => {
        const text = `package P {
    part old;
    part def A {
        part old [1];
    }
    part def B :> A {
        part renamed :>> old {
            part copy :> old;
        }
    }
}`;
        expect(await definitionLine(text, 'renamed', 'old {')).toBe('part old [1];');
        expect(await definitionLine(text, 'copy', 'old;')).toBe('part old;');
    });

    it('resolves a quoted redefinition target with the spaces in its name', async () => {
        const text = `package P {
    part 'old feature';
    part def A {
        part 'old feature' [1];
    }
    part def B :> A {
        part renamed :>> 'old feature';
    }
}`;
        expect(await definitionLine(text, 'renamed', '\'old feature\';')).toBe('part \'old feature\' [1];');
    });

    it('keeps variant naming and redefinition targets consistent across documents after a target rename', async () => {
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { DefinitionProvider } = await import('../../server/src/providers/definitionProvider.js');
        const { DocumentSymbolProvider } = await import('../../server/src/providers/documentSymbolProvider.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');
        const libUri = 'file:///ws/lib.sysml';
        const uri = 'file:///ws/variation.sysml';
        const libText = `package Lib {
    part '  wheel  ';
    part def Base {
        part '  wheel  ' [1];
    }
    part def Derived :> Base {
        part <s> spare :>> '  wheel  ';
    }
    part p : Derived;
}`;
        const text = `package Demo {
    private import Lib::*;
    variation part choice {
        variant p.s;
    }
}`;
        const dm = new DocumentManager();
        const libDoc = TextDocument.create(libUri, 'sysml', 1, libText);
        const doc = TextDocument.create(uri, 'sysml', 1, text);
        dm.parse(libDoc);
        dm.parse(doc);
        expect(dm.get(libUri)!.errors).toEqual([]);
        expect(dm.get(uri)!.errors).toEqual([]);
        const definition = new DefinitionProvider(dm);
        const redefined = definition.provideDefinition({
            textDocument: { uri: libUri },
            position: libDoc.positionAt(libText.indexOf("'  wheel  '", libText.indexOf('spare')) + 3),
        });
        expect(redefined).toMatchObject({ uri: libUri, range: { start: { line: 3 } } });
        const variantPosition = doc.positionAt(text.indexOf('p.s') + 2);
        expect(definition.provideDefinition({ textDocument: { uri }, position: variantPosition }))
            .toMatchObject({ uri: libUri, range: { start: { line: 6 } } });

        const outline = new DocumentSymbolProvider(dm);
        const model = new SysMLModelProvider(dm);
        const names = () => [
            outline.provideDocumentSymbols({ textDocument: { uri } })[0].children![0].children![0].name,
            model.getModel(uri, 1, ['elements']).elements![0].children[0].children[0].name,
        ];
        // The outline shows the short name the variant takes from `<s> spare` too (KerML 8.3.3.3.4).
        expect(names()).toEqual(['<s> spare', 'spare']);
        dm.parse(TextDocument.create(libUri, 'sysml', 2, libText.replace('spare', 'replacement')));
        expect(names()).toEqual(['<s> replacement', 'replacement']);
        expect(definition.provideDefinition({ textDocument: { uri }, position: variantPosition }))
            .toMatchObject({ uri: libUri, range: { start: { line: 6 } } });
    });

    it('resolves a quoted name with leading and trailing spaces, not the trimmed name', async () => {
        const text = `package P {
    part '  old feature   ';
    part 'old feature';
    part def A {
        part '  old feature   ' [1];
    }
    part def B :> A {
        part renamed :>> '  old feature   ';
        part copy :> '  old feature   ';
    }
}`;
        expect(await definitionLine(text, 'renamed', 'old feature   \';')).toBe('part \'  old feature   \' [1];');
        expect(await definitionLine(text, 'copy', 'old feature   \';')).toBe('part \'  old feature   \';');
    });

    it('resolves a qualified redefinition or subsetting target to the named member, not the inherited one', async () => {
        const text = `package P {
    part old;
    part ' my name ';
    part def A {
        part old [1];
        part ' my name ' [1];
    }
    part def B :> A {
        part renamed :>> P::old;
        part copy :> P::old;
        part renamedQuoted :>> P::' my name ';
        part copyQuoted :> P::' my name ';
        part renamedInherited :>> A::' my name ';
    }
}`;
        expect(await definitionLine(text, 'renamed ', 'old;')).toBe('part old;');
        expect(await definitionLine(text, 'copy ', 'old;')).toBe('part old;');
        expect(await definitionLine(text, 'renamedQuoted', 'my name \';')).toBe('part \' my name \';');
        expect(await definitionLine(text, 'copyQuoted', 'my name \';')).toBe('part \' my name \';');
        expect(await definitionLine(text, 'renamedInherited', 'my name \';')).toBe('part \' my name \' [1];');
        expect(await definitionLine(text, 'renamedQuoted', 'P::')).toBe('package P {');
    });

    it('does not inherit a feature that another inherited feature redefines', async () => {
        const text = `package P {
    part def A {
        part p;
    }
    part def B :> A {
        part q :>> p;
    }
    part def C :> A, B;
}`;
        const members = await resolvedMembers(text, 'P::C');
        expect(members.has('p')).toBe(false);
        expect(members.get('q')).toEqual(['P::B::q']);
    });

    it('lets an inherited member hide an imported one of the same name (KerML 7.3.2.1)', async () => {
        const text = `package Lib {
    part p;
}
package P {
    part def A {
        part p;
    }
    part def B :> A {
        private import Lib::*;
    }
}`;
        expect((await resolvedMembers(text, 'P::B')).get('p')).toEqual(['P::A::p', 'Lib::p']);
    });

    it('does not inherit a private member', async () => {
        const text = `package P {
    part def A {
        private part secret;
        protected part shared;
    }
    part def B :> A;
}`;
        const members = await resolvedMembers(text, 'P::B');
        expect(members.has('secret')).toBe(false);
        expect(members.get('shared')).toEqual(['P::A::shared']);
    });

    it('stops at a type that specializes itself', async () => {
        const text = `package P {
    part def A :> A {
        part p;
    }
}`;
        expect((await resolvedMembers(text, 'P::A')).get('p')).toEqual(['P::A::p']);
    });
});
