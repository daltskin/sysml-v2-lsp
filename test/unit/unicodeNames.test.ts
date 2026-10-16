import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { DefinitionProvider } from '../../server/src/providers/definitionProvider.js';
import { HoverProvider } from '../../server/src/providers/hoverProvider.js';
import { ReferencesProvider } from '../../server/src/providers/referencesProvider.js';
import { RenameProvider } from '../../server/src/providers/renameProvider.js';
import { CompletionProvider } from '../../server/src/providers/completionProvider.js';
import { LinkedEditingRangeProvider } from '../../server/src/providers/linkedEditingRangeProvider.js';
import { SemanticValidator } from '../../server/src/providers/semanticValidator.js';
import { SysMLModelProvider } from '../../server/src/model/sysmlModelProvider.js';
import { parseDocument, parseDocumentBatch } from '../../server/src/parser/parseDocument.js';
import { TextDocuments, type CompletionItem, type TextEdit } from 'vscode-languageserver/node';
import { SignatureHelpProvider } from '../../server/src/providers/signatureHelpProvider.js';
import { CallHierarchyProvider } from '../../server/src/providers/callHierarchyProvider.js';
import { TypeHierarchyProvider } from '../../server/src/providers/typeHierarchyProvider.js';
import { DocumentLinkProvider } from '../../server/src/providers/documentLinkProvider.js';
import { SemanticTokensProvider } from '../../server/src/providers/semanticTokensProvider.js';
import { CodeActionProvider } from '../../server/src/providers/codeActionProvider.js';
import {
    extractQualifiedNameAt, joinQualifiedName, quoteName, readNameAt,
    scanQualifiedNames, splitQualifiedName, unquoteName,
} from '../../server/src/utils/identUtils.js';

const NAMES = [
    '\u03a9', '\u00b0C', 'm\u00b2', '\u6e29\u5ea6', '\u0645\u062d\u0631\u0643',
    'e\u0301', '\u00e9', '\u{1f680}', '\u{10400}', "unit's value", 'unit\\value',
    'unit::value', 'unit, value', 'unit { value', 'unit\tvalue', 'unit\nvalue',
];

function setup(text: string, uri = 'file:///unicode.sysml') {
    const dm = new DocumentManager();
    const doc = TextDocument.create(uri, 'sysml', 1, text);
    dm.parse(doc);
    return { dm, doc, uri };
}

function documentsFor(doc: TextDocument): TextDocuments<TextDocument> {
    const documents = new TextDocuments(TextDocument);
    documents.get = uri => uri === doc.uri ? doc : undefined;
    return documents;
}

function completionEdit(item: CompletionItem): TextEdit {
    if (!item.textEdit || !('range' in item.textEdit)) throw new Error('Expected a completion TextEdit');
    return item.textEdit;
}

describe('SysML unrestricted names (7.2.2 and KerML 8.2.2.3)', () => {
    it.each(NAMES)('creates a valid missing attribute type containing %j', name => {
        const sourceName = quoteName(`Missing ${name}`);
        const text = `package P {\n    attribute 'reading \u{1f680}' : ${sourceName};\n}`;
        const { dm, doc, uri } = setup(text);
        const diagnostics = new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-type');
        expect(diagnostics).toHaveLength(1);
        const actions = new CodeActionProvider(dm).provideCodeActions({
            textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics },
        });
        const fix = actions.find(action => action.title.startsWith('Create local'));
        expect(fix?.edit?.changes?.[uri]?.[0].newText)
            .toContain(`attribute def ${sourceName};`);
        const updated = TextDocument.applyEdits(doc, fix!.edit!.changes![uri]);
        dm.parse(TextDocument.create(uri, 'sysml', 2, updated));
        expect(dm.get(uri)!.errors).toEqual([]);
        expect(new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-type')).toEqual([]);
    });

    it('quotes generated imports without splitting namespace separators inside package names', () => {
        const name = "Missing \u03a9's value";
        const text = `package P {\n    attribute reading : ${quoteName(name)};\n}`;
        const { dm, doc, uri } = setup(text);
        dm.parse(TextDocument.create('file:///units.sysml', 'sysml', 1,
            `package 'Units::\u{1f680}' { attribute def ${quoteName(name)}; }`));
        const diagnostics = new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-type');
        expect(diagnostics).toHaveLength(1);
        const actions = new CodeActionProvider(dm).provideCodeActions({
            textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics },
        });
        const fix = actions.find(action => action.title.startsWith('Import'));
        expect(fix?.edit?.changes?.[uri]?.[0].newText)
            .toContain("public import 'Units::\u{1f680}'::*;");
        const updated = TextDocument.applyEdits(doc, fix!.edit!.changes![uri]);
        dm.parse(TextDocument.create(uri, 'sysml', 2, updated));
        expect(dm.get(uri)!.errors).toEqual([]);
        expect(new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-type')).toEqual([]);
    });

    it('keeps naming and unused-definition quick fixes quoted', () => {
        const text = "package P { part def 'omega \u03a9'; }";
        const { dm, doc, uri } = setup(text);
        const diagnostics = new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'naming-convention'
                || diagnostic.code === 'unused-definition');
        const actions = new CodeActionProvider(dm).provideCodeActions({
            textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics },
        });
        expect(actions.map(action => action.edit?.changes?.[uri]?.[0].newText))
            .toEqual(["'Omega \u03a9'", "'_omega \u03a9'"]);
        for (const action of actions) {
            const updated = TextDocument.applyEdits(doc, action.edit!.changes![uri]);
            expect(parseDocument(updated).errors).toEqual([]);
        }
    });

    it('corrects quoted constraint paths without splitting dots inside member names', () => {
        const text = `package P {
    part def 'Wheel \u03a9' { attribute 'wheel.radius \u03a9' : Real; }
    requirement def 'Req\\'s \u{1f680}' {
        subject 'wheel \u{1f680}' : 'Wheel \u03a9';
        require constraint { 'wheel \u{1f680}'.'wheel.radiu \u03a9' > 0 }
    }
}`;
        const { dm, doc, uri } = setup(text);
        const diagnostics = new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-constraint-reference');
        expect(diagnostics).toHaveLength(1);
        const actions = new CodeActionProvider(dm).provideCodeActions({
            textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics },
        });
        expect(actions).toHaveLength(1);
        expect(actions[0].edit?.changes?.[uri]?.[0].newText)
            .toBe("'wheel \u{1f680}'.'wheel.radius \u03a9'");
        const updated = TextDocument.applyEdits(doc, actions[0].edit!.changes![uri]);
        dm.parse(TextDocument.create(uri, 'sysml', 2, updated));
        expect(dm.get(uri)!.errors).toEqual([]);
        expect(new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-constraint-reference')).toEqual([]);
    });

    it('quotes compatible replacement port names, including escaped apostrophes', () => {
        const text = `package P {
    port def FuelPort { out item fuel; }
    port def PowerPort { out item power; }
    part def Car {
        port 'fuel \u03a9' : FuelPort;
        port 'fuel\\'s spare \u{1f680}' : FuelPort;
        port 'power \u03a9' : PowerPort;
        connection c connect 'fuel \u03a9' to 'power \u03a9';
    }
}`;
        const { dm, doc, uri } = setup(text);
        const diagnostics = new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'incompatible-port-types');
        expect(diagnostics).toHaveLength(1);
        const actions = new CodeActionProvider(dm).provideCodeActions({
            textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics },
        });
        expect(actions).toHaveLength(1);
        expect(actions[0].edit?.changes?.[uri]?.[0].newText)
            .toBe("connect 'fuel \u03a9' to 'fuel\\'s spare \u{1f680}'");
        const updated = TextDocument.applyEdits(doc, actions[0].edit!.changes![uri]);
        dm.parse(TextDocument.create(uri, 'sysml', 2, updated));
        expect(dm.get(uri)!.errors).toEqual([]);
        expect(new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'incompatible-port-types')).toEqual([]);
    });

    it.each(NAMES)('round-trips %j without normalization and retains UTF-16 spans', name => {
        const source = quoteName(name);
        expect(unquoteName(source)).toBe(name);
        expect(readNameAt(source, 0)).toEqual({ name, start: 0, end: source.length });
        const text = `Pkg::${source}`;
        const scanned = [...scanQualifiedNames(text)];
        expect(scanned).toHaveLength(1);
        expect(splitQualifiedName(scanned[0].name)).toEqual(['Pkg', name]);
        expect(extractQualifiedNameAt(text, text.length - 1))
            .toBe(joinQualifiedName(['Pkg', name]));
        expect(scanned[0].end).toBe(text.length);
    });

    it('never exposes names inside comments or double-quoted values', () => {
        const text = `/* '\u03a9' */ // '\u03a9'\n"\u03a9" '\u03a9'`;
        expect([...scanQualifiedNames(text)].map(name => name.name)).toEqual(['\u03a9']);
    });

    it('never treats scientific-notation exponents or invalid quoted-name fragments as names', () => {
        expect([...scanQualifiedNames("1e6 2.5e-3 'invalid\\q name'")]).toEqual([]);
    });

    it.each(NAMES)('supports %j through symbols, navigation, diagnostics, references and rename', name => {
        const source = quoteName(name);
        const text = `package P { part def ${source};\npart instance : ${source};\n}`;
        const { dm, doc, uri } = setup(text);
        expect(dm.get(uri)!.errors).toEqual([]);
        const symbols = dm.getWorkspaceSymbolTable().getAllSymbols();
        const definition = symbols.find(symbol => symbol.name === name)!;
        expect(definition).toBeDefined();
        expect(doc.getText(definition.selectionRange)).toBe(source);
        const params = {
            textDocument: { uri },
            position: doc.positionAt(text.indexOf(source, text.indexOf('\n')) + 1),
        };
        const location = new DefinitionProvider(dm).provideDefinition(params);
        expect(location).toEqual({ uri, range: definition.selectionRange });
        const hover = new HoverProvider(dm).provideHover(params);
        expect(hover).not.toBeNull();
        expect(doc.getText(hover!.range!)).toBe(source);
        expect(new SemanticValidator(dm).validate(uri)
            .filter(d => d.code === 'unresolved-type' || d.code === 'unused-definition')).toEqual([]);
        const model = new SysMLModelProvider(dm).getModel(uri, 1, ['elements', 'diagnostics']);
        expect(model.diagnostics!.filter(d => d.code === 'unresolved-type')).toEqual([]);
        expect(new CompletionProvider(dm).provideCompletions(params)
            .find(item => item.label === name)?.insertText).toBe(source);
        const completion = new CompletionProvider(dm).provideCompletions(params)
            .find(item => item.label === name)!;
        expect(completion.textEdit).toBeDefined();
        expect(TextDocument.applyEdits(doc, [completionEdit(completion)]))
            .toBe(text);

        const references = new ReferencesProvider(dm);
        const all = references.provideReferences({ ...params, context: { includeDeclaration: true } });
        expect(all).toHaveLength(2);
        expect(all.map(ref => doc.getText(ref.range))).toEqual([source, source]);
        expect(references.provideReferences({ ...params, context: { includeDeclaration: false } }))
            .toHaveLength(1);
        expect(new LinkedEditingRangeProvider(dm).provideLinkedEditingRanges(params)!.ranges)
            .toEqual(all.map(ref => ref.range));
        const rename = new RenameProvider(dm);
        expect(doc.getText(rename.prepareRename(params)!)).toBe(source);
        const edit = rename.provideRename({ ...params, newName: '\u65b0\u{1f680}' })!;
        expect(edit.changes![uri]).toHaveLength(2);
        const renamed = TextDocument.applyEdits(doc, edit.changes![uri]);
        expect(parseDocument(renamed).errors).toEqual([]);
        expect(renamed).toContain(`part instance : '${'\u65b0\u{1f680}'}'`);
        expect(renamed).not.toContain("part '\u65b0\u{1f680}' :");
    });

    it('completes an unfinished unrestricted name without duplicating quote delimiters', () => {
        const text = "part def '\u6e29\u5ea6';\npart used : '\u6e29";
        const { dm, doc, uri } = setup(text);
        const item = new CompletionProvider(dm).provideCompletions({
            textDocument: { uri }, position: doc.positionAt(text.length),
        }).find(completion => completion.label === '\u6e29\u5ea6')!;
        expect(TextDocument.applyEdits(doc, [completionEdit(item)]))
            .toBe("part def '\u6e29\u5ea6';\npart used : '\u6e29\u5ea6'");
    });

    it('resolves imported qualified names across documents and leaves unrelated names untouched', () => {
        const name = "'\u03a9\u{1f680}'";
        const lib = setup(`package '\u5e93\u{1f680}' { part def ${name}; }`, 'file:///library.sysml');
        const text = `package App {
    private import '\u5e93\u{1f680}'::*;
    part used : '\u5e93\u{1f680}'::${name};
    // ${name}
    attribute message : String = "${name}";
}
package Other { part def ${name}; part other : ${name}; }`;
        const doc = TextDocument.create('file:///app.sysml', 'sysml', 1, text);
        lib.dm.parse(doc);
        const params = {
            textDocument: { uri: doc.uri },
            position: doc.positionAt(text.indexOf(name) + 1),
        };
        expect(new DefinitionProvider(lib.dm).provideDefinition(params)!.uri).toBe(lib.uri);
        const edits = new RenameProvider(lib.dm).provideRename({ ...params, newName: 'Renamed' })!.changes!;
        expect(Object.keys(edits).sort()).toEqual([doc.uri, lib.uri].sort());
        expect(edits[doc.uri]).toHaveLength(1);
        const renamed = TextDocument.applyEdits(doc, edits[doc.uri]);
        expect(renamed).toContain(`// ${name}`);
        expect(renamed).toContain(`"${name}"`);
        expect(renamed).toContain(`package Other { part def ${name}; part other : ${name}; }`);
        expect(new SemanticValidator(lib.dm).validate(doc.uri)
            .filter(d => d.code === 'unresolved-type')).toEqual([]);
        const links = new DocumentLinkProvider(lib.dm, documentsFor(doc))
            .provideDocumentLinks({ textDocument: { uri: doc.uri } });
        expect(links).toHaveLength(1);
        expect(links[0].target).toBe(lib.uri);
        expect(doc.getText(links[0].range)).toBe("'\u5e93\u{1f680}'::*");
    });

    it('supports quoted call targets and typed-usage names in call hierarchy and signature help', () => {
        const name = "'\u8ba1\u7b97\u{1f680}'";
        const text = `package P {
    calc def ${name} {
        in attribute a : Real;
        in attribute b : Real;
        return : Real;
    }
    action def Caller { calc '\u4f7f\u7528' : ${name}; }
    attribute result = ${name}(1, 2);
}`;
        const { dm, doc, uri } = setup(text);
        expect(dm.get(uri)!.errors).toEqual([]);
        const help = new SignatureHelpProvider(dm, documentsFor(doc)).provideSignatureHelp({
            textDocument: { uri }, position: doc.positionAt(text.indexOf('(1, 2)') + 4),
        });
        expect(help?.signatures[0].parameters).toHaveLength(2);
        expect(help?.activeParameter).toBe(1);
        const hierarchy = new CallHierarchyProvider(dm);
        const [caller] = hierarchy.prepareCallHierarchy({
            textDocument: { uri }, position: doc.positionAt(text.indexOf('Caller') + 1),
        })!;
        expect(hierarchy.provideOutgoingCalls({ item: caller }).map(call => call.to.name))
            .toContain('\u8ba1\u7b97\u{1f680}');
    });

    it('supports escaped names in type hierarchy from reference positions', () => {
        const text = "part def 'base\\'s \u{1f680}';\npart def '\u6d3e\u751f' :> 'base\\'s \u{1f680}';\npart used : '\u6d3e\u751f';";
        const { dm, doc, uri } = setup(text);
        const hierarchy = new TypeHierarchyProvider(dm);
        const [derived] = hierarchy.prepareTypeHierarchy({
            textDocument: { uri }, position: doc.positionAt(text.lastIndexOf("'\u6d3e\u751f'") + 1),
        })!;
        const bases = hierarchy.provideSupertypes({ item: derived });
        expect(bases.map(base => base.name)).toEqual(["base's \u{1f680}"]);
        expect(hierarchy.provideSubtypes({ item: bases[0] }).map(item => item.name)).toEqual(['\u6d3e\u751f']);
    });

    it('navigates and renames quoted feature-chain ends through their receiver type', () => {
        const name = "'\u6e29\u5ea6.\u03a9\u{1f680}'";
        const text = `part def Engine { attribute ${name} : Real; }
part def Model {
    part engine : Engine;
    constraint { engine.${name} > 0 }
}`;
        const { dm, doc, uri } = setup(text);
        const params = {
            textDocument: { uri }, position: doc.positionAt(text.lastIndexOf(name) + 1),
        };
        const location = new DefinitionProvider(dm).provideDefinition(params)!;
        expect(location.range.start.line).toBe(0);
        expect(doc.getText(location.range)).toBe(name);
        const edit = new RenameProvider(dm).provideRename({ ...params, newName: '\u6e29\u5ea6' })!;
        expect(edit.changes![uri]).toHaveLength(2);
        const renamed = TextDocument.applyEdits(doc, edit.changes![uri]);
        expect(renamed).toContain("engine.'\u6e29\u5ea6' > 0");
        expect(renamed).toContain('part engine : Engine');
    });

    it('resolves Unicode short-name aliases and distinguishes their declaration in references', () => {
        const text = "part def <'\u03a9\u{1f680}'> Temperature;\npart value : '\u03a9\u{1f680}';";
        const { dm, doc, uri } = setup(text);
        const params = {
            textDocument: { uri }, position: doc.positionAt(text.lastIndexOf("'\u03a9") + 1),
        };
        const references = new ReferencesProvider(dm).provideReferences({
            ...params, context: { includeDeclaration: false },
        });
        expect(references).toHaveLength(1);
        const edit = new RenameProvider(dm).provideRename({ ...params, newName: '\u00b0C' })!;
        expect(TextDocument.applyEdits(doc, edit.changes![uri]))
            .toBe("part def <'\u00b0C'> Temperature;\npart value : '\u00b0C';");
    });

    it('validates complete quoted constraint paths and reports missing Unicode features', () => {
        const text = `part def Model {
    attribute '\u6e29\u5ea6 \u{1f680}' : Real;
    constraint { '\u6e29\u5ea6 \u{1f680}' > 1e3 }
    constraint { '\u4e0d\u5b58\u5728' > 0 }
}`;
        const { dm, uri } = setup(text);
        const diagnostics = new SemanticValidator(dm).validate(uri)
            .filter(diagnostic => diagnostic.code === 'unresolved-constraint-reference');
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain('\u4e0d\u5b58\u5728');
    });

    it.each([
        { mode: 'interactive', parse: parseDocument },
        { mode: 'batch', parse: parseDocumentBatch },
    ])('uses UTF-16 columns after astral names in $mode parsing', ({ parse }) => {
        const text = "package '\u{1f680}' { part def '\u03a9'; part p : '\u03a9'; }";
        const result = parse(text);
        expect(result.errors).toEqual([]);
        const tokens = result.tokenStream.getTokens();
        for (const token of tokens.filter(token => token.text === "'\u03a9'")) {
            expect(text.slice(token.column, token.column + token.text!.length)).toBe("'\u03a9'");
        }
        const invalid = parse("package '\u{1f680}' { part p : ; }");
        expect(invalid.errors.length).toBeGreaterThan(0);
        expect(invalid.errors.some(error => error.column === "package '\u{1f680}' { part p ".length)).toBe(true);
    });

    it('keeps semantic-token positions aligned after astral characters', () => {
        const text = "package '\u{1f680}' { part def '\u03a9'; part instance : '\u03a9'; }";
        const { dm, uri } = setup(text);
        const data = new SemanticTokensProvider(dm).provideSemanticTokens({ textDocument: { uri } }).data;
        let column = 0;
        let found = false;
        for (let i = 0; i < data.length; i += 5) {
            column = data[i] === 0 ? column + data[i + 1] : data[i + 1];
            if (text.slice(column, column + data[i + 2]) === 'instance') found = true;
        }
        expect(found).toBe(true);
    });
});
