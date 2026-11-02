import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { generateMermaidDiagram } from '../../server/src/mcp/mermaidGenerator.js';
import { formatSymbol } from '../../server/src/mcpCore.js';
import { CompletionProvider } from '../../server/src/providers/completionProvider.js';
import { DefinitionProvider } from '../../server/src/providers/definitionProvider.js';
import { HoverProvider } from '../../server/src/providers/hoverProvider.js';
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

        it('reports connections and resolved-type features by name and short name', () => {
            const m = model();
            expect(m.relationships.filter((r: any) => r.type === 'connection').map((r: any) => [r.name, r.shortName]))
                .toEqual([['c1', 'cn'], ['', 'cn2']]);
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
