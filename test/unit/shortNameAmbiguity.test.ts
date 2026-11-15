import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { DefinitionProvider } from '../../server/src/providers/definitionProvider.js';
import { HoverProvider } from '../../server/src/providers/hoverProvider.js';
import { ReferencesProvider } from '../../server/src/providers/referencesProvider.js';
import { RenameProvider } from '../../server/src/providers/renameProvider.js';
import { LinkedEditingRangeProvider } from '../../server/src/providers/linkedEditingRangeProvider.js';
import { TypeHierarchyProvider } from '../../server/src/providers/typeHierarchyProvider.js';
import { CallHierarchyProvider } from '../../server/src/providers/callHierarchyProvider.js';
import { SemanticValidator } from '../../server/src/providers/semanticValidator.js';
import { NameReferences } from '../../server/src/symbols/nameReferences.js';
import { buildSymbolIndexes, findConflictingDeclarations } from '../../server/src/symbols/namespaceResolver.js';

function setup(text: string) {
    const uri = 'file:///short-name-ambiguity.sysml';
    const dm = new DocumentManager();
    const doc = TextDocument.create(uri, 'sysml', 1, text);
    dm.parse(doc);
    expect(dm.get(uri)!.errors.map(error => error.message)).toEqual([]);
    return { dm, doc, uri };
}

describe('Ambiguous short names in editor requests', () => {
    it.each([
        ['a local name/short-name clash',
            'package P { attribute def <A> Alpha; attribute def A; attribute x : A; }', 'A;'],
        ['a qualified name/short-name clash',
            'package P { attribute def <A> Alpha; attribute def A; } attribute x : P::A;', 'A;'],
        ['two local short names',
            'package P { attribute def <B> Beta; attribute def <B> Gamma; attribute x : B; }', 'B;'],
        ['two qualified short names',
            'package P { attribute def <B> Beta; attribute def <B> Gamma; } attribute x : P::B;', 'B;'],
        ['a quoted Unicode short name',
            "package P { attribute def <'Shared\\'\u{1f680}'> Beta; attribute def <'Shared\\'\u{1f680}'> Gamma; } attribute x : P::'Shared\\'\u{1f680}';",
            "'Shared\\'\u{1f680}';"],
        ['an ambiguous qualifying namespace',
            'package P { part def <N> First { attribute def Value; } part def <N> Second { attribute def Value; } } attribute x : P::N::Value;',
            'Value;'],
        ['a feature path through an ambiguous qualifier',
            'package P { part def <N> First { attribute value : Real; } part def <N> Second { attribute value : Real; } constraint { N.value > 0 } }',
            'value >'],
        ['an ambiguous feature on a typed receiver',
            'part def Engine { attribute <B> primary : Real; attribute <B> secondary : Real; } part def Car { part engine : Engine; constraint { engine.B > 0 } }',
            'B >'],
        ['a type hierarchy reference inside a definition',
            'package P { part def <B> Beta; part def <B> Gamma; part def Derived :> B; }', 'B;'],
        ['a call hierarchy reference inside a definition',
            'package P { action def <B> Beta; action def <B> Gamma; action def Derived :> B; }', 'B;'],
    ])('does not select a declaration for %s', (_label, text, target) => {
        const { dm, doc, uri } = setup(text);
        const params = { textDocument: { uri }, position: doc.positionAt(text.lastIndexOf(target)) };
        const reference = new NameReferences(dm).at(uri, params.position);
        expect(reference?.isAmbiguous).toBe(true);
        expect(reference?.symbol).toBeUndefined();
        expect(new SemanticValidator(dm).validate(uri).some(d => d.code === 'ambiguous-namespace-name')).toBe(true);
        expect(new DefinitionProvider(dm).provideDefinition(params)).toBeNull();
        expect(new HoverProvider(dm).provideHover(params)).toBeNull();
        expect(new ReferencesProvider(dm).provideReferences({
            ...params, context: { includeDeclaration: true },
        })).toEqual([]);
        const rename = new RenameProvider(dm);
        expect(rename.prepareRename(params)).toBeNull();
        expect(rename.provideRename({ ...params, newName: 'Changed' })).toBeNull();
        expect(new LinkedEditingRangeProvider(dm).provideLinkedEditingRanges(params)).toBeNull();
        expect(new TypeHierarchyProvider(dm).prepareTypeHierarchy(params)).toBeNull();
        expect(new CallHierarchyProvider(dm).prepareCallHierarchy(params)).toBeNull();
    });

    it('keeps distinct long names and single membership imports usable', () => {
        const text = `package P {
    attribute def <B> Beta;
    attribute def <B> Gamma;
}
package Q {
    private import P::Beta;
    attribute qualified : P::Beta;
    attribute imported : B;
    attribute ambiguous : P::B;
}`;
        const { dm, doc, uri } = setup(text);
        for (const target of ['P::Beta;', 'B;']) {
            const start = target === 'B;' ? text.indexOf('B;', text.indexOf('attribute imported'))
                : text.indexOf(target, text.indexOf('attribute qualified')) + 3;
            const params = { textDocument: { uri }, position: doc.positionAt(start) };
            expect(new NameReferences(dm).at(uri, params.position)?.symbol?.name).toBe('Beta');
            expect(new DefinitionProvider(dm).provideDefinition(params)?.range.start.line).toBe(1);
        }
        const params = { textDocument: { uri }, position: doc.positionAt(text.indexOf('Beta;')) };
        const refs = new ReferencesProvider(dm).provideReferences({
            ...params, context: { includeDeclaration: false },
        });
        expect(refs.map(ref => ref.range.start.line)).toEqual([5, 6, 7]);
        const edit = new RenameProvider(dm).provideRename({ ...params, newName: 'Renamed' })!;
        const renamed = TextDocument.applyEdits(doc, edit.changes![uri]);
        expect(renamed).toContain('attribute ambiguous : P::B;');
        expect(renamed).toContain('attribute imported : B;');
        expect(renamed).toContain('attribute qualified : P::Renamed;');
    });

    it('keeps an ambiguous library-like name from triggering library fallback', () => {
        const text = 'package P { attribute def <Real> First; attribute def <Real> Second; attribute x : Real; }';
        const { dm, doc, uri } = setup(text);
        const params = { textDocument: { uri }, position: doc.positionAt(text.lastIndexOf('Real;')) };
        expect(new NameReferences(dm).at(uri, params.position)?.isAmbiguous).toBe(true);
        expect(new DefinitionProvider(dm).provideDefinition(params)).toBeNull();
        expect(new HoverProvider(dm).provideHover(params)).toBeNull();
    });
});

describe('Overlapping conflict groups', () => {
    it.each([false, true])('keeps all direct peers across package fragments: %s', split => {
        const { dm, uri } = setup('package P { part def <A> Alpha; part def <B> A; }');
        dm.parse(TextDocument.create(split ? 'file:///other.sysml' : uri, 'sysml', 2,
            split ? 'package P { part def B; }'
                : 'package P { part def <A> Alpha; part def <B> A; part def B; }'));
        const symbols = dm.getWorkspaceSymbolTable().getAllSymbols();
        const middle = symbols.find(symbol => symbol.name === 'A')!;
        const peers = findConflictingDeclarations(buildSymbolIndexes(symbols)).get(middle)!;
        expect(peers.map(symbol => symbol.name).sort()).toEqual(['A', 'Alpha', 'B']);
        expect(new Set(peers).size).toBe(peers.length);
        const diagnostic = new SemanticValidator(dm).validate(uri).find(d =>
            d.code === 'ambiguous-namespace-name' && d.data.name === 'A')!;
        expect(diagnostic.message).toContain('and 1 other occurrence');
    });
});
