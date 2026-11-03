import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { generateMermaidDiagram } from '../../server/src/mcp/mermaidGenerator.js';
import { formatSymbol } from '../../server/src/mcpCore.js';
import { CompletionProvider } from '../../server/src/providers/completionProvider.js';
import { DefinitionProvider } from '../../server/src/providers/definitionProvider.js';
import { HoverProvider } from '../../server/src/providers/hoverProvider.js';
import { ReferencesProvider } from '../../server/src/providers/referencesProvider.js';
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

    it('keeps the MCP output name as before, and adds the short name', () => {
        const { symbols } = setup('package P {\n    part def <PD3>;\n    part def <PD2> PartDef2;\n}\n');
        const defs = symbols.filter(s => s.kind === 'part def').map(s => formatSymbol(s));
        expect(defs.map(f => [f.name, f.shortName])).toEqual([['PD3', 'PD3'], ['PartDef2', 'PD2']]);
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

        it('identifies the element by its symbol ID in the diagnostic data', () => {
            const { dm, uri, symbols } = setup('package Q {\n    part def <PE>;\n}\n');
            const [unused] = diagnosticsOf(dm, uri, 'unused-definition');
            expect(unused.data).toEqual({ name: 'PE', symbolId: symbols.find(s => s.shortName === 'PE')!.symbolId });
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

        it('counts satisfy and verify written with the short name of an element that also has a name', () => {
            const text = 'package P {\n    requirement <rq> Req;\n    requirement <rq2> Req2;\n    part s;\n    satisfy rq by s;\n    verification vc { objective { verify rq2; } }\n}\n';
            const { dm, uri } = setup(text);
            const messages = new SemanticValidator(dm).validate(uri).map(d => d.message);
            expect(messages.some(m => m.startsWith("Requirement '<rq> Req' is not satisfied"))).toBe(false);
            expect(messages.some(m => m.startsWith("Requirement '<rq2> Req2' has no verification case"))).toBe(false);
        });

        it('shows the element in hover', () => {
            const text = 'package P {\n    part def <PD3>;\n    part a : PD3;\n}\n';
            const { dm, doc, uri } = setup(text);
            const hover = new HoverProvider(dm).provideHover({ textDocument: { uri }, position: doc.positionAt(text.indexOf('<PD3>') + 1) });
            expect(JSON.stringify(hover?.contents)).toContain('`<PD3>`');
        });

        it('finds an element with a short name and a name by either one', () => {
            const text = 'package P {\n    part def <PD2> PartDef2;\n}\n';
            const { dm } = setup(text);
            const table = dm.getWorkspaceSymbolTable();
            expect(table.findByName('PD2').map(s => s.name)).toEqual(['PartDef2']);
            expect(table.findByName('PartDef2').map(s => s.shortName)).toEqual(['PD2']);
        });

        it('offers each of its names as a completion', () => {
            const text = 'package P {\n    part def <PD2> PartDef2;\n    part w : ;\n}\n';
            const { dm, doc, uri } = setup(text);
            const labels = new CompletionProvider(dm).provideCompletions({
                textDocument: { uri }, position: doc.positionAt(text.indexOf(': ;') + 2),
            }).map(c => c.label);
            expect(labels).toEqual(expect.arrayContaining(['PD2', 'PartDef2']));
        });
    });

    describe('sysml/model keeps the identifier of an element with a short name and no name', () => {
        it('reports relationship sources and diagram nodes by name and short name, and keeps a control node', () => {
            const text = `package Q {
    part def B;
    part def <PD> :> B;
    action def <A1> { action <s1>; action <s2>; first s1 then s2; }
    action def N { action n1; fork <fk>; first n1 then fk; }
}
`;
            const { dm, uri } = setup(text);
            const { model } = modelElements(dm, uri);
            // The source as text, as before, and by its symbol ID.
            const pd = dm.getWorkspaceSymbolTable().getSymbolsForUri(uri).find(s => s.shortName === 'PD')!;
            const toB = model.relationships.find((r: any) => r.target === 'B');
            expect(toB).toMatchObject({ source: 'PD', sourceId: pd.symbolId });
            expect(toB).not.toHaveProperty('sourceShortName');
            const diagrams = model.activityDiagrams as any[];
            const a1 = diagrams.find(d => d.shortName === 'A1')!;
            expect(a1.name).toBe('');
            expect(a1.actions.map((a: any) => [a.name, a.shortName])).toEqual(expect.arrayContaining([['', 's1'], ['', 's2']]));
            expect(diagrams.find(d => d.name === 'N')!.actions.map((a: any) => a.shortName)).toContain('fk');
        });

        it('reports each activity node with its own name and short name, so flows by either one match it', () => {
            const text = `package Ac {
    action def <AD> Flow1 {
        action <a1> first1;
        action <a2>;
        fork <fk> frk;
        decide <dc>;
        first start then a1;
        first a1 then fk;
        first fk then a2;
        first a2 then dc;
        first dc then done;
    }
}
`;
            const { dm, uri } = setup(text);
            const { model } = modelElements(dm, uri);
            const flow1 = (model.activityDiagrams as any[]).find(d => d.name === 'Flow1')!;
            expect(flow1.shortName).toBe('AD');
            const nodes = flow1.actions.map((a: any) => [a.name, a.shortName]);
            expect(nodes).toEqual(expect.arrayContaining([['first1', 'a1'], ['', 'a2'], ['frk', 'fk'], ['', 'dc']]));
            // Each flow endpoint is the name or the short name of a node.
            const names = new Set(flow1.actions.flatMap((a: any) => [a.name, a.shortName]).filter(Boolean));
            expect(flow1.flows).toHaveLength(5);
            for (const flow of flow1.flows) expect([flow.from, flow.to].every(end => names.has(end)), `${flow.from}->${flow.to}`).toBe(true);
        });
    });

    describe('sequence diagrams, relationships and resolved types report each name and short name', () => {
        const text = `package Sq {
    item def <S> Sig;
    part def <PD> Pd;
    part def <SYS> Sys {
        part <a> alice : Pd;
        part <b>;
        message <m1> msg1 of Sig from a to b;
        message <m2> of S from b to a;
    }
    action def <O> Outer {
        action <p1> par1 { action <c1> ch1; action <c2>; }
        action <p2> { action <c3> ch3; }
        first p1 then p2;
    }
    part c { port p; }
    part d { port p; }
    connection <cn> c1 connect c.p to d.p;
    connection <cn2> connect c.p to d.p;
}
`;

        function model() {
            const { dm, uri } = setup(text);
            return new SysMLModelProvider(dm).getModel(uri, 1, ['sequenceDiagrams', 'activityDiagrams', 'relationships', 'resolvedTypes'] as never) as any;
        }

        it('never reports a message\'s short name as its payload', () => {
            const { dm, uri } = setup(`package Pl {
    part def Sys {
        part aa; part bb;
        message <mm> from aa to bb;
        message <m3> msg3 of Sig from aa to bb;
    }
    item def Sig;
}
`);
            const sys = (new SysMLModelProvider(dm).getModel(uri, 1, ['sequenceDiagrams'] as never) as any).sequenceDiagrams[0];
            expect(sys.messages.map((m: any) => [m.name, m.shortName, m.payload])).toEqual([
                ['', 'mm', ''], ['msg3', 'm3', 'Sig'],
            ]);
        });

        it('matches message endpoints to participants by either name, without adding phantom participants', () => {
            const sys = model().sequenceDiagrams.find((d: any) => d.name === 'Sys');
            expect(sys.participants.map((p: any) => [p.name, p.shortName])).toEqual([['alice', 'a'], ['', 'b']]);
            expect(sys.messages.map((m: any) => [m.name, m.shortName, m.from, m.to])).toEqual([
                ['msg1', 'm1', 'a', 'b'], ['', 'm2', 'b', 'a'],
            ]);
        });

        it('reports actions with their owner\'s name and short name, and sub-actions with their own', () => {
            const { dm, uri } = setup(text);
            const ids = new Map(dm.getWorkspaceSymbolTable().getSymbolsForUri(uri).map(s => [s.name || s.shortName, s.symbolId]));
            const m = new SysMLModelProvider(dm).getModel(uri, 1, ['activityDiagrams'] as never) as any;
            const outer = m.activityDiagrams.find((d: any) => d.name === 'Outer');
            // The owner by its symbol ID, for actions and their sub-actions alike.
            const actions = outer.actions.filter((a: any) => a.parentId !== undefined)
                .map((a: any) => [a.name, a.shortName, a.parentId, a.subActions?.map((s: any) => [s.name, s.shortName, s.parentId])]);
            expect(actions).toEqual([
                ['par1', 'p1', ids.get('Outer'), [['ch1', 'c1', ids.get('par1')], ['', 'c2', ids.get('par1')]]],
                ['', 'p2', ids.get('Outer'), [['ch3', 'c3', ids.get('p2')]]],
            ]);
            // `parent` as before: the owner's name, else its short name.
            expect(outer.actions.filter((a: any) => a.parentId !== undefined).map((a: any) => a.parent)).toEqual(['Outer', 'Outer']);
            // `children` is unchanged: each sub-action's name, else its short name.
            expect(outer.actions.find((a: any) => a.shortName === 'p1').children).toEqual(['ch1', 'c2']);
        });

        it('reports connections by symbol ID, and resolved-type features by name and short name', () => {
            const m = model();
            const { dm, uri } = setup(text);
            const byId = new Map(dm.getWorkspaceSymbolTable().getSymbolsForUri(uri).map(s => [s.symbolId, s]));
            // A relationship's names are read from its element, by `symbolId`.
            expect(m.relationships.filter((r: any) => r.type === 'connection').map((r: any) => {
                const element = byId.get(r.symbolId)!;
                return [r.name, r.shortName, element.name, element.shortName];
            })).toEqual([['c1', undefined, 'c1', 'cn'], ['', undefined, '', 'cn2']]);
            const sys = m.resolvedTypes['Sq::Sys'];
            expect([sys.simpleName, sys.shortName]).toEqual(['Sys', 'SYS']);
            expect(sys.features.map((f: any) => [f.name, f.shortName])).toEqual(expect.arrayContaining([['alice', 'a'], ['', 'b']]));
        });
    });

    describe('a redefinition through a feature chain is named after the chain\'s last feature (KerML 8.3.3.3.4)', () => {
        it('takes the name and short name of the feature the chain ends at', () => {
            const text = 'package If {\n    part def B { part <p> pp; }\n    part def W { part x2 : B; part y2 : B; }\n    part v : W { part :>> x2.p; part :>> y2.pp; }\n}\n';
            const { symbols } = setup(text);
            const v = symbols.find(s => s.name === 'v')!;
            expect(symbols.filter(s => s.parentId === v.symbolId).map(s => [s.name, s.shortName])).toEqual([['pp', 'p'], ['pp', 'p']]);
        });
    });

    describe('a redefinition through a feature chain, in every shape (KerML 8.2.3.5.1, 8.3.3.3.4)', () => {
        const text = `package Ch {
    part def C { part <q> qq; }
    part def B { part <p> pp : C; }
    part def W { part <x> x2 : B; }
    part def W2 :> W;
    part v1 : W { part :>> x2.p.q; }
    part v2 : W { part :>> x.p; }
    part v3 : W { part :>> W::x2.p; }
    part v4 : W2 { part :>> x2.p; }
    part v5 : W { part :>> x2 { part :>> p; } part :>> x2.p; }
    part v6 : W { part :>> x2.nope; }
    part v7 : W { ref :>> x2.p; }
    part v8 : W { part <own> :>> x2.p; }
    part v9 : W { part named :>> x2.p; }
    part v10 : W { perform x2.p; }
    part v11 : W { part :>> x2.p, x2; }
    part v12 { part :>> x2.p; }
    part def D3 :> W { part :>> x2.p; }
    part own1 { part x3 : B; part :>> x3.p; }
}
`;

        /** [name, shortName] of each member of the owner named `owner`. */
        function membersOf(owner: string): Array<[string, string | undefined]> {
            const { symbols } = setup(text);
            const o = symbols.find(s => s.name === owner)!;
            return symbols.filter(s => s.parentId === o.symbolId).map(s => [s.name, s.shortName]);
        }

        it.each([
            ['v1', [['qq', 'q']]],             // three segments
            ['v2', [['pp', 'p']]],             // head written by its short name
            ['v3', [['pp', 'p']]],             // qualified head
            ['v4', [['pp', 'p']]],             // head inherited through a specialization
            ['v5', [['x2', 'x'], ['pp', 'p']]], // head redefined by the owner too
            ['v7', [['pp', 'p']]],             // a reference usage
            ['v10', [['pp', 'p']]],            // perform
            ['D3', [['pp', 'p']]],             // in a definition
            ['own1', [['x3', undefined], ['pp', 'p']]], // head is a sibling feature, resolved from the owner
        ])('names the usage in %s after the feature the chain ends at', (owner, expected) => {
            expect(membersOf(owner as string)).toEqual(expected);
        });

        it('keeps a declared name or short name of its own', () => {
            expect(membersOf('v8')).toEqual([['', 'own']]);
            expect(membersOf('v9')).toEqual([['named', undefined]]);
        });

        it.each([
            ['v6', 'nope'],  // the chain ends at no feature
            ['v11', 'p'],    // its own redefinition of x2 hides the inherited x2 from the chain
            ['v12', 'p'],    // an owner without a type
        ])('falls back to the last segment as written in %s, when the chain does not resolve', (owner, name) => {
            expect(membersOf(owner as string)).toEqual([[name, undefined]]);
        });
    });

    describe('sysml/model diagnostics identify their element by symbol ID', () => {
        function modelDiagnostics(text: string) {
            const { dm, uri, symbols } = setup(text);
            const model = new SysMLModelProvider(dm).getModel(uri, 1, ['diagnostics'] as never) as any;
            return { diagnostics: model.diagnostics as any[], symbols };
        }

        it('for an empty enumeration with only a short name', () => {
            const { diagnostics, symbols } = modelDiagnostics('package Q {\n    enum def <EN>;\n}\n');
            const en = symbols.find(s => s.shortName === 'EN')!;
            expect(diagnostics.filter(d => d.code === 'empty-enum').map(d => [d.elementName, d.id])).toEqual([['EN', en.symbolId]]);
        });

        it('for each declaration of a short-name clash, by the name they clash on', () => {
            const { diagnostics, symbols } = modelDiagnostics('package Q {\n    part def <A> X1;\n    part def <A> Y1;\n}\n');
            const ambiguous = diagnostics.filter(d => d.code === 'ambiguous-namespace-name');
            expect(ambiguous.map(d => [d.elementName, d.id])).toEqual([
                ['X1', symbols.find(s => s.name === 'X1')!.symbolId],
                ['Y1', symbols.find(s => s.name === 'Y1')!.symbolId],
            ]);
            for (const d of ambiguous) expect(d.message).toMatch(/^Ambiguous name 'A': /);
        });
    });

    describe('a relationship that is an element is identified by its symbol ID, its names read from that element', () => {
        const text = `package Rl {
    item def Fuel;
    port def FP { out item f : Fuel; }
    part def Tank { port <tp> tport : FP; }
    part def Eng { port <ep> eport : ~FP; }
    part sys {
        part <tk> tank : Tank;
        part <en> eng : Eng;
        flow <fl> flow1 of Fuel from tank.tport.f to eng.eport.f;
        flow <fl2> from tk.tp.f to en.ep.f;
        succession flow <sf> sflow1 of Fuel from tank.tport.f to eng.eport.f;
        message <ms> msg1 of Fuel from tank to eng;
        connection <cn> conn1 connect tank to eng;
    }
}
`;

        it('keeps each relationship\'s label, adds no short name, and its symbol ID is the element with both names', () => {
            const { dm, uri } = setup(text);
            const byId = new Map(dm.getWorkspaceSymbolTable().getSymbolsForUri(uri).map(s => [s.symbolId, s]));
            const m = new SysMLModelProvider(dm).getModel(uri, 1, ['relationships', 'elements'] as never) as any;
            const own = m.relationships.filter((r: any) => r.symbolId !== undefined && r.type !== 'typing');
            expect(own.map((r: any) => {
                const element = byId.get(r.symbolId)!;
                return [r.type, r.name, element.name, element.shortName];
            })).toEqual([
                // A flow's label is its payload type, else its name, as for any flow.
                ['flow', 'Fuel', 'flow1', 'fl'],
                ['flow', '', '', 'fl2'],
                ['succession', undefined, 'sflow1', 'sf'],
                ['flow', 'Fuel', 'msg1', 'ms'],
                ['connection', 'conn1', 'conn1', 'cn'],
            ]);
            for (const r of m.relationships) expect(r).not.toHaveProperty('shortName');
            // The relationships of each element's own entry, likewise.
            const all: any[] = [];
            const walk = (es: any[]) => es.forEach(e => { all.push(...e.relationships); walk(e.children); });
            walk(m.elements);
            for (const r of all) expect(r).not.toHaveProperty('shortName');
        });
    });

    describe('a usage referencing a feature (perform, exhibit, include, variant) has that feature\'s features (KerML 8.3.3.3.9)', () => {
        const text = `package Sb {
    action def Drive { action <st> start1; }
    part def Vehicle { action <dr> drive : Drive; }
    part car8 : Vehicle { perform dr; perform drive.start1; }
    part car9 : Vehicle { perform dr; perform dr.st; }
    part car11 : Vehicle { perform action myDr ::> dr; perform myDr.st; }
    part car12 : Vehicle { perform drive; perform dr.start1; }
    part car30 : Vehicle { perform dr { action :>> st; } }
    part car31 : Vehicle { perform drive { action :>> start1; } }
    part car32 : Vehicle { ref action ra ::> drive { action :>> st; } }
    part car33 : Vehicle { action ra2 :> drive { action :>> st; } }
    state def Op { state <on> onState; }
    part def V2 { state <op> operate : Op; }
    part car10 : V2 { exhibit op; exhibit operate.on; }
    part car34 : V2 { exhibit op { state :>> on; } }
    use case def UC { use case <sc> subCase; }
    use case def Main { use case <uu> uc1 : UC; }
    use case m1 : Main { include uu; include uc1.sc; }
    part def Engine { part <cy> cylinders; }
    part def Vh { part <e4> engine4 : Engine; }
    part def Vv :> Vh {
        variation part eng : Engine { variant e4 { part :>> cy; } }
    }
}
`;

        function membersOf(owner: string) {
            const { symbols } = setup(text);
            const o = symbols.find(s => s.qualifiedName === `Sb::${owner}`)!;
            return symbols.filter(s => s.parentId === o.symbolId).map(s => [s.name, s.shortName]);
        }

        it('names a chain whose head is a sibling usage named after the same feature after the chain\'s end', () => {
            expect(membersOf('car8')).toEqual([['drive', 'dr'], ['start1', 'st']]);
            expect(membersOf('car9')).toEqual([['drive', 'dr'], ['start1', 'st']]);
            expect(membersOf('car12')).toEqual([['drive', 'dr'], ['start1', 'st']]);
            expect(membersOf('car10')).toEqual([['operate', 'op'], ['onState', 'on']]);
            expect(membersOf('m1')).toEqual([['uc1', 'uu'], ['subCase', 'sc']]);
        });

        it('names a redefinition in such a usage\'s body after the feature of the referenced feature it redefines', () => {
            expect(membersOf('car8::drive').length).toBe(0);
            expect(membersOf('car30::drive')).toEqual([['start1', 'st']]);
            expect(membersOf('car31::drive')).toEqual([['start1', 'st']]);
            expect(membersOf('car34::operate')).toEqual([['onState', 'on']]);
            expect(membersOf('Vv::eng::engine4')).toEqual([['cylinders', 'cy']]);
        });

        it('leaves usages with a written subsetting or reference unchanged', () => {
            expect(membersOf('car11')).toEqual([['myDr', undefined], ['start1', 'st']]);
            expect(membersOf('car32::ra')).toEqual([['start1', 'st']]);
            expect(membersOf('car33::ra2')).toEqual([['start1', 'st']]);
        });

        it('resolves the reference to a sibling sharing its qualified name, never to the usage itself (KerML 8.2.3.5.2)', () => {
            const text = 'package Lp {\n    action def D { action <s1> start1; }\n    part loopA { perform loopB; action <lb> loopB : D; perform lb.s1; }\n}\n';
            const { dm, doc, uri, symbols } = setup(text);
            const action = symbols.find(s => s.kind === 'action' && s.qualifiedName === 'Lp::loopA::loopB')!;
            const performs = symbols.filter(s => s.kind === 'perform action');
            expect(performs.map(s => [s.name, s.shortName])).toEqual([['loopB', 'lb'], ['start1', 's1']]);
            const location = new DefinitionProvider(dm).provideDefinition({
                textDocument: { uri }, position: doc.positionAt(text.indexOf('perform loopB') + 9),
            }) as any;
            expect(location.range).toEqual(action.selectionRange);
            expect(diagnosticsOf(dm, uri, 'circular-naming')).toEqual([]);
        });

        it('still settles, and reports circular naming by symbol ID, for two usages named after each other', () => {
            const { dm, uri, symbols } = setup(`package Cy {
    action def Drive { action <st> start1; }
    part def Vehicle { action <dr> drive : Drive; }
    part car : Vehicle { perform dr; perform drive; }
}
`);
            const circular = diagnosticsOf(dm, uri, 'circular-naming');
            const performs = symbols.filter(s => s.kind === 'perform action');
            expect(circular.map(d => d.data)).toEqual(performs.map(s => ({ symbolId: s.symbolId })));
        });
    });

    describe('every diagnostic about one element identifies it by symbol ID', () => {
        it('puts the symbol ID of the element at its range in data, keeping its other data', () => {
            const text = `package Dg {
    part def <B> Base { part <w> wheels[1..2]; }
    part def Sub :> Base { part :>> wheels[5]; }
    part bad[3..1];
    enum def <EN>;
    part def lowerDef;
    part UpperUsage;
    part def <C1> Cyc1 :> Cyc2;
    part def <C2> Cyc2 :> Cyc1;
    view <vw>;
    part def <D> X1;
    part def <D> Y1;
    action def Drive { action <st> start1; }
    part def Vehicle { action <dr> drive : Drive; }
    part car : Vehicle { perform dr; perform drive; }
}
`;
            const { dm, uri, symbols } = setup(text);
            const codes = ['invalid-multiplicity', 'empty-enum', 'naming-convention', 'circular-specialization', 'view-no-scope',
                'invalid-redefinition-multiplicity', 'duplicate-definition', 'circular-naming'];
            const diagnostics = new SemanticValidator(dm).validate(uri).filter(d => codes.includes(d.code as string));
            expect(new Set(diagnostics.map(d => d.code))).toEqual(new Set(codes));
            const at = (line: number, character: number) => symbols.find(s =>
                s.selectionRange.start.line === line && s.selectionRange.start.character === character)!;
            for (const d of diagnostics) {
                expect((d.data as any).symbolId, `${d.code} at ${d.range.start.line}`).toBe(at(d.range.start.line, d.range.start.character).symbolId);
            }
            expect(diagnostics.filter(d => d.code === 'naming-convention').map(d => d.data)).toEqual([
                { name: 'lowerDef', convention: 'PascalCase', symbolId: symbols.find(s => s.name === 'lowerDef')!.symbolId },
                { name: 'UpperUsage', convention: 'camelCase', symbolId: symbols.find(s => s.name === 'UpperUsage')!.symbolId },
            ]);
        });
    });

    describe('an alias is selected by its name, else its short name (SysML 8.2.2.5.1)', () => {
        const text = 'package Refs {\n    part def <PD2> PartDef2;\n    alias <AL> AliasN for PartDef2;\n    alias <aOnly> for PartDef2;\n    alias N for PartDef2;\n    part w12 : AL;\n    part w13 : AliasN;\n    part w14 : aOnly;\n}\n';

        it('goes to the alias\'s name from either of its names, and to the short name of an alias with only one', () => {
            const { dm, doc, uri, symbols } = setup(text);
            const definition = (at: string) => new DefinitionProvider(dm).provideDefinition({
                textDocument: { uri }, position: doc.positionAt(text.indexOf(at) + at.length - 1),
            }) as any;
            const aliases = symbols.filter(s => s.kind === 'alias');
            expect(aliases.map(s => doc.getText(s.selectionRange))).toEqual(['AliasN', 'aOnly', 'N']);
            expect(definition(': AL;').range).toEqual(aliases[0].selectionRange);
            expect(definition(': AliasN;').range).toEqual(aliases[0].selectionRange);
            expect(definition(': aOnly;').range).toEqual(aliases[1].selectionRange);
        });

        it('lists neither of the alias\'s declared names as a reference to it', () => {
            const { dm, doc, uri } = setup(text);
            const references = (includeDeclaration: boolean) => new ReferencesProvider(dm).provideReferences({
                textDocument: { uri }, position: doc.positionAt(text.indexOf('AliasN')), context: { includeDeclaration },
            }).map(l => doc.getText(l.range));
            expect(references(false)).toEqual(['AL', 'AliasN']);
            expect(references(true)).toEqual(['AL', 'AliasN', 'AL', 'AliasN']);
        });
    });

    it('identifies the element of an unresolved-type warning by its symbol ID, in the editor and in sysml/model', () => {
        const { dm, uri, symbols } = setup('package Dg {\n    part <os> : Undef1;\n    part <ws> withS : Undef2;\n}\n');
        const id = (shortName: string) => symbols.find(s => s.shortName === shortName)!.symbolId;
        expect(diagnosticsOf(dm, uri, 'unresolved-type').map(d => d.data)).toEqual([
            { typeName: 'Undef1', elementName: 'os', symbolId: id('os') },
            { typeName: 'Undef2', elementName: 'withS', symbolId: id('ws') },
        ]);
        const model = new SysMLModelProvider(dm).getModel(uri, 1, ['diagnostics'] as never) as any;
        expect(model.diagnostics.filter((d: any) => d.code === 'unresolved-type').map((d: any) => [d.elementName, d.id]))
            .toEqual([['os', id('os')], ['withS', id('ws')]]);
    });
});
