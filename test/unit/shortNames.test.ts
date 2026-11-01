import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { generateMermaidDiagram } from '../../server/src/mcp/mermaidGenerator.js';
import { CompletionProvider } from '../../server/src/providers/completionProvider.js';
import { DefinitionProvider } from '../../server/src/providers/definitionProvider.js';
import { CallHierarchyProvider } from '../../server/src/providers/callHierarchyProvider.js';
import { CodeLensProvider } from '../../server/src/providers/codeLensProvider.js';
import { HoverProvider } from '../../server/src/providers/hoverProvider.js';
import { TypeHierarchyProvider } from '../../server/src/providers/typeHierarchyProvider.js';
import { SysMLModelProvider } from '../../server/src/model/sysmlModelProvider.js';
import { DocumentSymbolProvider } from '../../server/src/providers/documentSymbolProvider.js';
import { SemanticValidator } from '../../server/src/providers/semanticValidator.js';

/**
 * An element declared with a short name and no name (`part def <PD3>;`) has
 * an empty name and is identified by its short name (KerML 8.3.2.1.2,
 * `escapedName()`): it is named, referenced, checked and listed by it.
 */
describe('elements with a short name and no name', () => {
    function setup(text: string, uri = 'file:///short.sysml') {
        const dm = new DocumentManager();
        const doc = TextDocument.create(uri, 'sysml', 1, text);
        dm.parse(doc);
        const symbols = dm.getWorkspaceSymbolTable().getSymbolsForUri(uri);
        return { dm, doc, uri, symbols };
    }

    it('resolves a reference written with the short name to the element', () => {
        const text = 'package P {\n    part def <PD3>;\n    part w : PD3;\n}\n';
        const { dm, doc, uri, symbols } = setup(text);
        const pd3 = symbols.find(s => s.shortName === 'PD3')!;
        expect([pd3.name, pd3.qualifiedName]).toEqual(['', 'P::PD3']);
        const location = new DefinitionProvider(dm).provideDefinition({
            textDocument: { uri }, position: doc.positionAt(text.indexOf(': PD3') + 3),
        });
        expect(location).toEqual({ uri, range: pd3.selectionRange });
        expect(doc.getText(pd3.selectionRange)).toBe('PD3');
        expect(new SemanticValidator(dm).validate(uri).filter(d => d.code === 'unresolved-type')).toEqual([]);
    });

    it('gives distinct elements with different short names distinct symbol IDs, and no duplicate warning', () => {
        const { dm, uri, symbols } = setup('package P {\n    part def <A>;\n    part def <B>;\n}\n');
        const defs = symbols.filter(s => s.kind === 'part def');
        expect(new Set(defs.map(s => s.symbolId)).size).toBe(2);
        expect(new SemanticValidator(dm).validate(uri)
            .filter(d => d.code === 'duplicate-definition' || d.code === 'ambiguous-namespace-name')).toEqual([]);
    });

    it('reports two definitions with the same short name by that short name', () => {
        const { dm, uri } = setup('package P {\n    part def <A>;\n    part def <A>;\n}\n');
        const messages = new SemanticValidator(dm).validate(uri)
            .filter(d => d.code === 'duplicate-definition' || d.code === 'ambiguous-namespace-name')
            .map(d => d.message);
        expect(messages.length).toBeGreaterThan(0);
        for (const message of messages) expect(message).toContain("'A'");
    });

    it('offers the short name as a completion and shows it in the outline as declared', () => {
        const text = 'package P {\n    part def <PD3>;\n    part w : ;\n}\n';
        const { dm, doc, uri } = setup(text);
        const completions = new CompletionProvider(dm).provideCompletions({
            textDocument: { uri }, position: doc.positionAt(text.indexOf(': ;') + 2),
        });
        expect(completions.find(c => c.label === 'PD3')).toBeDefined();
        expect(completions.find(c => c.label === '')).toBeUndefined();
        const [pkg] = new DocumentSymbolProvider(dm).provideDocumentSymbols({ textDocument: { uri } });
        expect(pkg.children!.map(c => c.name)).toContain('<PD3>');
    });

    it('shows an element with a short name and a name in the outline as declared (Table 4)', () => {
        const { dm, uri } = setup('package <P1> P {\n    part def <PD2> PartDef2;\n    part def Plain;\n}\n');
        const [pkg] = new DocumentSymbolProvider(dm).provideDocumentSymbols({ textDocument: { uri } });
        expect([pkg.name, pkg.children!.map(c => c.name)]).toEqual(['<P1> P', ['<PD2> PartDef2', 'Plain']]);
    });

    it('labels a class with a short name by its display name, keeping its node ID', () => {
        const { dm, symbols } = setup('package P {\n    part def <PD2> PartDef2;\n    part def <PD3>;\n    part def Plain;\n}\n');
        const all = dm.getWorkspaceSymbolTable().getAllSymbols();
        const { diagram } = generateMermaidDiagram(symbols.filter(s => s.kind === 'part def'), all, 'class');
        const classLines = diagram.split('\n').map(l => l.trim()).filter(l => l.startsWith('class '));
        expect(classLines.map(l => l.replace(/ \{$/, ''))).toEqual([
            'class PartDef2["#lt;PD2#gt; PartDef2"]', 'class PD3["#lt;PD3#gt;"]', 'class Plain',
        ]);
    });

    /** The model's elements, depth first. */
    function modelElements(dm: DocumentManager, uri: string) {
        const model: any = new SysMLModelProvider(dm).getModel(uri, 1, ['elements', 'relationships', 'activityDiagrams'] as never);
        const all: any[] = [];
        const walk = (es: any[]) => es.forEach(e => { all.push(e); walk(e.children); });
        walk(model.elements);
        return { model, all };
    }

    /** The semantic diagnostics of `uri` with `code`. */
    function diagnosticsOf(dm: DocumentManager, uri: string, code: string) {
        return new SemanticValidator(dm).validate(uri).filter(d => d.code === code);
    }

    describe('a package takes its name only from its own declaration', () => {
        it('names a package with a short name and no name by its short name, not after a member', () => {
            const text = 'package <A> { part def X; }\npackage <B> { part def X; }\npart p : A::X;\n';
            const { dm, doc, uri, symbols } = setup(text);
            const packages = symbols.filter(s => s.kind === 'package');
            expect(packages.map(s => [s.name, s.shortName, s.qualifiedName])).toEqual([['', 'A', 'A'], ['', 'B', 'B']]);
            expect(symbols.filter(s => s.kind === 'part def').map(s => s.qualifiedName)).toEqual(['A::X', 'B::X']);
            expect(new SemanticValidator(dm).validate(uri)
                .filter(d => ['duplicate-definition', 'ambiguous-namespace-name', 'unresolved-type'].includes(String(d.code)))).toEqual([]);
            const location = new DefinitionProvider(dm).provideDefinition({
                textDocument: { uri }, position: doc.positionAt(text.indexOf('A::X') + 3),
            });
            expect(location).toEqual({ uri, range: symbols.find(s => s.qualifiedName === 'A::X')!.selectionRange });
        });

        it('builds nested and library package qualified names from short names', () => {
            const { symbols } = setup('package <A> { package <B> { part def X; } }\nlibrary package <L> { part def Y; }\n');
            expect(symbols.filter(s => s.kind === 'part def').map(s => s.qualifiedName)).toEqual(['A::B::X', 'L::Y']);
            expect(symbols.filter(s => s.kind === 'package').map(s => [s.name, s.shortName])).toEqual([['', 'A'], ['', 'B'], ['', 'L']]);
        });
    });

    describe('a short name is taken only from the element\'s own declaration', () => {
        it('never gives an owner the short name of a member, reported or not', () => {
            const text = `package Q {
    calc <cau> calcU;
    part def O {
        part a; part b;
        comment <cm> /* x */
        binding <bd> bind a = b;
        succession <sc> first a then b;
    }
    use case u { objective <ob> obj; }
    requirement def RQ { assume constraint <ac2> acn; }
    part r1 : cau;
}
`;
            const { symbols } = setup(text);
            for (const name of ['Q', 'O', 'u', 'RQ']) {
                expect(symbols.find(s => s.name === name)?.shortName, name).toBeUndefined();
            }
            // `cau` is not a name of `Q`, so nothing is named after it.
            expect(symbols.some(s => s.kind === 'package' && s.shortName === 'cau')).toBe(false);
        });

        it('keeps an inline payload or loop variable short name off its action, which stays anonymous', () => {
            const text = `package Q {
    part def A;
    part def W { action { accept <acc> s : A; } }
    part def W2 { action outer { for <fr> i in (1,2) { } } }
}
`;
            const { symbols } = setup(text);
            const actions = symbols.filter(s => s.kind === 'action');
            const anonymous = actions.find(s => s.parentId === symbols.find(o => o.name === 'W')!.symbolId)!;
            expect([anonymous.name, anonymous.shortName, anonymous.qualifiedName]).toEqual(['', undefined, undefined]);
            expect(actions.find(s => s.name === 'outer')?.shortName).toBeUndefined();
        });
    });

    describe('an alias declares its own short name and name (SysML 8.2.2.5.1)', () => {
        it('splits the short name between < and > from the name, never its target', () => {
            const text = 'package Q {\n    part def X;\n    alias <AL> AliasName for X;\n    alias <AL3> for X;\n    alias N for X;\n    part a : AL;\n    part b : AliasName;\n}\n';
            const { dm, uri, symbols } = setup(text);
            expect(symbols.filter(s => s.kind === 'alias').map(s => [s.name, s.shortName])).toEqual([
                ['AliasName', 'AL'], ['', 'AL3'], ['N', undefined],
            ]);
            expect(diagnosticsOf(dm, uri, 'unresolved-type')).toEqual([]);
        });
    });

    describe('a usage without a name of its own is named after the feature it redefines (KerML 8.3.3.3.4)', () => {
        it('takes the redefined feature\'s name and short name, and goes to it', () => {
            const text = 'package Q {\n    part def B { part <p> pp; part <o>; part n; }\n    part x : B { part :>> p; part :>> o; part :>> n; part <s> :>> pp; }\n}\n';
            const { dm, doc, uri, symbols } = setup(text);
            const x = symbols.find(s => s.name === 'x')!;
            const redefining = symbols.filter(s => s.parentId === x.symbolId);
            expect(redefining.map(s => [s.name, s.shortName])).toEqual([['pp', 'p'], ['', 'o'], ['n', undefined], ['', 's']]);
            const pp = symbols.find(s => s.name === 'pp' && s.parentId !== x.symbolId)!;
            const location = new DefinitionProvider(dm).provideDefinition({
                textDocument: { uri }, position: doc.positionAt(text.indexOf(':>> p;') + 4),
            });
            expect(location).toEqual({ uri, range: pp.selectionRange });
        });
    });

    describe('messages name the element by its short name and name as declared', () => {
        it('shows the short name in the text, never an empty name', () => {
            const text = `package Q {
    part def <PE>;
    part def <'P D'> 'Part Def';
    requirement <rq>;
    view <vw>;
}
`;
            const { dm, uri } = setup(text);
            const messages = new SemanticValidator(dm).validate(uri).map(d => d.message);
            expect(messages).toContain("Definition '<PE>' is not referenced by any usage in the workspace");
            expect(messages).toContain("Definition '<P D> Part Def' is not referenced by any usage in the workspace");
            expect(messages).toContain("Requirement '<rq>' is not satisfied by any element");
            expect(messages.find(m => m.startsWith("Requirement '<rq>' has no verification case"))).toContain('verify rq by <VerificationCase>;');
            expect(messages).toContain("View '<vw>' has no expose or filter directives — it will show all elements");
            expect(messages.some(m => m.includes("''"))).toBe(false);
        });

        it('reports the name and short name separately in the diagnostic data', () => {
            const { dm, uri } = setup('package Q {\n    part def <PE>;\n}\n');
            const [unused] = diagnosticsOf(dm, uri, 'unused-definition');
            expect(unused.data).toEqual({ name: '', shortName: 'PE' });
        });
    });

    describe('short-name clashes (KerML 8.3.2.4.3)', () => {
        it('names the short name two declarations clash on', () => {
            const { dm, uri } = setup('package Q {\n    part def <A> X1;\n    part def <A> Y1;\n}\n');
            const ambiguous = diagnosticsOf(dm, uri, 'ambiguous-namespace-name').map(d => d.message);
            expect(ambiguous).toHaveLength(2);
            for (const message of ambiguous) expect(message).toMatch(/^Ambiguous name 'A': /);
            expect(diagnosticsOf(dm, uri, 'duplicate-definition').map(d => d.message)).toEqual([
                "Duplicate definition: 'A' is defined 2 times in the same scope",
                "Duplicate definition: 'A' is defined 2 times in the same scope",
            ]);
        });

        it('keeps members of an anonymous owner with different short names apart, and flags equal ones', () => {
            const distinct = setup('package Q {\n    action { action <x>; action <y>; }\n    part { part <x1>; part <y1>; }\n}\n');
            expect(diagnosticsOf(distinct.dm, distinct.uri, 'ambiguous-namespace-name')).toEqual([]);
            const equal = setup('package Q {\n    action { action <x>; action <x>; }\n}\n');
            expect(diagnosticsOf(equal.dm, equal.uri, 'ambiguous-namespace-name')).toHaveLength(2);
        });
    });

    describe('references written with a short name', () => {
        it('resolves a constraint feature chain through a feature with a short name', () => {
            const text = 'package Q {\n    part def A { attribute <m> : ScalarValues::Real; attribute <k> kk : ScalarValues::Real; }\n    part def W { part a2 : A; constraint c { a2.m > 0 and a2.k > 0 } }\n}\n';
            const { dm, uri } = setup(text);
            expect(new SemanticValidator(dm).validate(uri).filter(d => d.message.startsWith('Unresolved constraint reference'))).toEqual([]);
        });

        it('counts satisfy and verify written with the short name', () => {
            const text = 'package Q {\n    requirement <rq>;\n    requirement <rq2>;\n    part s;\n    satisfy rq by s;\n    verification vc { objective { verify rq2; } }\n}\n';
            const { dm, uri } = setup(text);
            const messages = new SemanticValidator(dm).validate(uri).map(d => d.message);
            expect(messages.some(m => m.startsWith("Requirement '<rq>' is not satisfied"))).toBe(false);
            expect(messages.some(m => m.startsWith("Requirement '<rq2>' has no verification case"))).toBe(false);
        });

        it('counts references written with the short name of an element that also has a name', () => {
            const text = 'package P {\n    requirement <rq> Req;\n    requirement <rq2> Req2;\n    part s;\n    satisfy rq by s;\n    verification vc { objective { verify rq2; } }\n    part def <PD2> PartDef2;\n    part a : PD2;\n    part b : PD2;\n}\n';
            const { dm, uri } = setup(text);
            const messages = new SemanticValidator(dm).validate(uri).map(d => d.message);
            expect(messages.some(m => m.startsWith("Requirement '<rq> Req' is not satisfied"))).toBe(false);
            expect(messages.some(m => m.startsWith("Requirement '<rq2> Req2' has no verification case"))).toBe(false);
            const lens = new CodeLensProvider(dm).provideCodeLenses({ textDocument: { uri } })
                .find(l => l.range.start.line === 6)!;
            // Its declaration and the two usages written `PD2`, as the count includes the declaration itself.
            expect(lens.command?.title).toBe('3 references');
        });

        it('shows the element in hover and counts its references in the code lens', () => {
            const text = 'package P {\n    part def <PD3>;\n    part def Sub :> PD3;\n    part a : PD3;\n    part b : P::PD3;\n}\n';
            const { dm, doc, uri } = setup(text);
            const hover = new HoverProvider(dm).provideHover({ textDocument: { uri }, position: doc.positionAt(text.indexOf('<PD3>') + 1) });
            expect(JSON.stringify(hover?.contents)).toContain('`<PD3>`');
            const lens = new CodeLensProvider(dm).provideCodeLenses({ textDocument: { uri } })
                .find(l => l.range.start.line === 1)!;
            expect(lens.command?.title).toMatch(/^[1-9]\d* references?$/);
        });

        it('keeps type and call hierarchy items to their element', () => {
            const text = 'package P {\n    part def <B>;\n    part def <S> :> B;\n    action def <Act>;\n    action def Caller { perform action a : Act; }\n}\n';
            const { dm, doc, uri } = setup(text);
            const types = new TypeHierarchyProvider(dm);
            const [sub] = types.prepareTypeHierarchy({ textDocument: { uri }, position: doc.positionAt(text.indexOf('<S>') + 1) })!;
            expect(sub.name).toBe('<S>');
            expect(types.provideSupertypes({ item: sub }).map(i => i.name)).toEqual(['<B>']);
            const calls = new CallHierarchyProvider(dm);
            const [act] = calls.prepareCallHierarchy({ textDocument: { uri }, position: doc.positionAt(text.indexOf('<Act>') + 1) })!;
            // Found through the item's own element, though its name is shown as `<Act>`.
            expect(calls.provideIncomingCalls({ item: act })).not.toHaveLength(0);
        });
    });

    describe('sysml/model keeps the identifier of an element with a short name and no name', () => {
        it('uses it as relationship source, diagram name and action names, and keeps a control node', () => {
            const text = `package Q {
    part def B;
    part def <PD> :> B;
    action def <A1> { action <s1>; action <s2>; first s1 then s2; }
    action def N { action n1; fork <fk>; first n1 then fk; }
}
`;
            const { dm, uri } = setup(text);
            const { model } = modelElements(dm, uri);
            expect(model.relationships.find((r: any) => r.target === 'B')?.source).toBe('PD');
            const diagrams = model.activityDiagrams as any[];
            const a1 = diagrams.find(d => d.name === 'A1')!;
            expect(a1.actions.map((a: any) => a.name)).toEqual(expect.arrayContaining(['s1', 's2']));
            expect(diagrams.find(d => d.name === 'N')!.actions.map((a: any) => a.name)).toContain('fk');
        });
    });
});
