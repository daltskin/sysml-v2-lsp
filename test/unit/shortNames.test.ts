import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { generateMermaidDiagram } from '../../server/src/mcp/mermaidGenerator.js';
import { CompletionProvider } from '../../server/src/providers/completionProvider.js';
import { DefinitionProvider } from '../../server/src/providers/definitionProvider.js';
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
});
