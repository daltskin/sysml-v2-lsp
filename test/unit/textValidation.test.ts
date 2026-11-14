/**
 * `sysml/validateText` (experimental): validating one or more texts against
 * the elaborated model without changing the server's state. Grouped by the
 * guarantees the request makes:
 *
 * - settings and limits: answered only when enabled, within its limits;
 * - validation coverage: a text gets exactly the diagnostics an open
 *   document with that text gets, against the workspace, the standard
 *   library and the other texts of the request;
 * - isolation: nothing changes, and no other request sees the texts;
 * - invalid parameters: answered with InvalidParams, changing nothing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Diagnostic } from 'vscode-languageserver/node';
import type { TextValidationSettings } from '../../server/src/providers/textValidationProvider.js';
import { hiddenSyntaxErrorCases } from '../fixtures/syntaxDiagnostics.js';

const enabled: TextValidationSettings = {
    enabled: true, maxDocuments: 10, maxLines: 1_000,
    maxCharacters: 1_000_000, maxTotalCharacters: 10_000_000,
};

/** A document manager holding `entries`, with a text validator over it, enabled unless `settings` say otherwise. */
async function setup(
    entries: { uri: string; text: string }[],
    settings: TextValidationSettings = enabled,
    isReported?: (diagnostic: Diagnostic) => boolean,
) {
    const { TextDocument } = await import('vscode-languageserver-textdocument');
    const { DocumentManager } = await import('../../server/src/documentManager.js');
    const { SemanticValidator } = await import('../../server/src/providers/semanticValidator.js');
    const { TextValidationProvider } = await import('../../server/src/providers/textValidationProvider.js');
    const dm = new DocumentManager();
    for (const { uri, text } of entries) dm.parse(TextDocument.create(uri, 'sysml', 1, text));
    const semanticValidator = new SemanticValidator(dm);
    const validator = new TextValidationProvider(dm, semanticValidator, isReported);
    validator.configure(settings);
    /** The diagnostics of one text, validated as the content of `uri` (a new document by default). */
    const validateOne = (text: string, uri = 'file:///ws/new.sysml') => validator.validate({ documents: [{ uri, text }] }).documents[0].diagnostics;
    return { dm, semanticValidator, validator, validateOne };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/**
 * The diagnostics the server publishes for the open document at `uri`:
 * syntax, keyword and semantic,
 * composed as `server.ts` composes them before publishing.
 */
async function ownDiagnostics({ dm, semanticValidator }: Setup, uri: string): Promise<Diagnostic[]> {
    const { DiagnosticsProvider } = await import('../../server/src/providers/diagnosticsProvider.js');
    const { validateKeywords } = await import('../../server/src/providers/keywordValidator.js');
    return [
        ...new DiagnosticsProvider(dm).getDiagnostics(uri),
        ...validateKeywords(dm.get(uri)!),
        ...semanticValidator.validate(uri),
    ];
}

const codes = (diagnostics: { code?: unknown }[]) => diagnostics.map(d => d.code);
const qualifiedNames = ({ dm }: Setup) => dm.getWorkspaceSymbolTable().getAllSymbols().map(s => s.qualifiedName).sort();

/** The JSON-RPC error `run` throws, checked to have `code` (as the client receives it). */
function rpcError(code: number, run: () => unknown): Error {
    try {
        run();
    } catch (error) {
        expect(error).toMatchObject({ code });
        return error as Error;
    }
    throw new Error(`expected JSON-RPC error ${code}`);
}

const InvalidParams = -32602;
const MethodNotFound = -32601;

describe('TextValidationProvider', () => {
    describe('settings and limits', () => {
        const motors = { uri: 'file:///ws/motors.sysml', text: 'package Motors { part def Motor; }' };

        it('is disabled by default, answering MethodNotFound with how to enable it', async () => {
            const { DEFAULT_TEXT_VALIDATION_SETTINGS } = await import('../../server/src/providers/textValidationProvider.js');
            const { validateOne } = await setup([], DEFAULT_TEXT_VALIDATION_SETTINGS);
            expect(DEFAULT_TEXT_VALIDATION_SETTINGS.enabled).toBe(false);
            expect(rpcError(MethodNotFound, () => validateOne('package A;')).message).toContain('sysml.experimental.validateText.enabled');
        });

        it.each([
            ['no settings section at all', undefined],
            ['an empty settings section', {}],
            ['enabled missing, only limits set', { maxDocuments: 3, maxLines: 50 }],
            ['enabled: false', { enabled: false }],
            ['enabled: null', { enabled: null }],
            ['enabled as a string', { enabled: 'true' }],
            ['enabled as a number', { enabled: 1 }],
        ])('is not allowed with %s: MethodNotFound, changing nothing', async (_case, section) => {
            const { readTextValidationSettings } = await import('../../server/src/providers/textValidationProvider.js');
            const { dm, validator } = await setup([motors], readTextValidationSettings(section));
            expect(rpcError(MethodNotFound, () => validator.validate({ documents: [{ uri: motors.uri, text: 'package Other;' }] })).message)
                .toContain('sysml.experimental.validateText.enabled');
            expect(dm.getUris()).toEqual([motors.uri]);
            expect(dm.getText(motors.uri)).toBe(motors.text);
        });

        it('is not allowed while disabled, even for parameters that are otherwise invalid', async () => {
            const { DEFAULT_TEXT_VALIDATION_SETTINGS } = await import('../../server/src/providers/textValidationProvider.js');
            const { validator } = await setup([], DEFAULT_TEXT_VALIDATION_SETTINGS);
            rpcError(MethodNotFound, () => validator.validate(undefined as never));
            rpcError(MethodNotFound, () => validator.validate({ documents: [] }));
        });

        it('applies the default limits when enabled without limits of its own', async () => {
            const { readTextValidationSettings } = await import('../../server/src/providers/textValidationProvider.js');
            const { validator } = await setup([], readTextValidationSettings({ enabled: true }));
            const documents = (count: number, lines: number) => Array.from({ length: count }, (_, i) => ({
                uri: `file:///ws/d${i}.sysml`,
                text: `package D${i} {\n${'\n'.repeat(lines - 2)}}\n`,
            }));
            expect(validator.validate({ documents: documents(5, 200) }).documents).toHaveLength(5);
            expect(rpcError(InvalidParams, () => validator.validate({ documents: documents(6, 3) })).message)
                .toContain('6 documents, more than the 5 allowed');
            expect(rpcError(InvalidParams, () => validator.validate({ documents: documents(1, 201) })).message)
                .toContain('documents[0] has 201 lines, more than the 200 allowed');
        });

        it('applies the limits the client configured, larger or smaller than the defaults', async () => {
            const text = (lines: number) => `package A {\n${'\n'.repeat(lines - 2)}}\n`;
            const larger = await setup([], { ...enabled, maxDocuments: 20, maxLines: 400 });
            expect(larger.validateOne(text(400))).toBeDefined();
            rpcError(InvalidParams, () => larger.validateOne(text(401)));

            const smaller = await setup([], { ...enabled, maxDocuments: 1, maxLines: 2 });
            expect(smaller.validateOne(text(2))).toBeDefined();
            rpcError(InvalidParams, () => smaller.validateOne(text(3)));
            rpcError(InvalidParams, () => smaller.validator.validate({
                documents: [{ uri: 'file:///ws/a.sysml', text: '' }, { uri: 'file:///ws/b.sysml', text: '' }],
            }));
        });

        it('follows the latest settings: enabled, disabled again', async () => {
            const { validator, validateOne } = await setup([]);
            expect(validateOne('package A;')).toEqual([]);
            validator.configure({ ...enabled, enabled: false });
            rpcError(MethodNotFound, () => validateOne('package A;'));
        });

        it('reads the settings section, replacing missing and invalid values by the defaults', async () => {
            const { readTextValidationSettings, DEFAULT_TEXT_VALIDATION_SETTINGS: defaults } = await import('../../server/src/providers/textValidationProvider.js');
            expect(readTextValidationSettings(undefined)).toEqual(defaults);
            expect(readTextValidationSettings(null)).toEqual(defaults);
            expect(defaults).toEqual({
                enabled: false, maxDocuments: 5, maxLines: 200,
                maxCharacters: 8_192, maxTotalCharacters: 16_384,
            });
            expect(readTextValidationSettings({ enabled: true, maxDocuments: 3, maxLines: 500 }))
                .toEqual({ ...defaults, enabled: true, maxDocuments: 3, maxLines: 500 });
            expect(readTextValidationSettings({ enabled: 'yes', maxDocuments: 0, maxLines: -1 })).toEqual(defaults);
            expect(readTextValidationSettings({ maxDocuments: 2.5, maxLines: '100' })).toEqual(defaults);
            expect(readTextValidationSettings({ maxCharacters: 20_000, maxTotalCharacters: 30_000 }))
                .toEqual({ ...defaults, maxCharacters: 20_000, maxTotalCharacters: 30_000 });
            for (const value of [0, -1, 1.5, '8192', null, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
                expect(readTextValidationSettings({ maxCharacters: value, maxTotalCharacters: value }))
                    .toEqual(defaults);
            }
        });

        it('counts lines as an editor shows them', async () => {
            const { lineCount } = await import('../../server/src/providers/textValidationProvider.js');
            expect(lineCount('')).toBe(0);
            expect(lineCount('package A;')).toBe(1);
            expect(lineCount('package A;\n')).toBe(1);
            expect(lineCount('package A {\n}\n\n')).toBe(3);
            expect(lineCount('a\r\nb\rc\nd')).toBe(4);
            expect(lineCount('x'.repeat(10_000))).toBe(1);
        });

        it('accepts a request at the limits', async () => {
            const { validator } = await setup([], { ...enabled, maxDocuments: 2, maxLines: 3 });
            const result = validator.validate({
                documents: [{ uri: 'file:///ws/a.sysml', text: 'package A {\n    part def B;\n}\n' }, { uri: 'file:///ws/b.sysml', text: 'package B;' }],
            });
            expect(result.documents).toHaveLength(2);
        });

        it.each([
            ['more documents than maxDocuments', { documents: [motors, { uri: 'file:///ws/a.sysml', text: '' }, { uri: 'file:///ws/b.sysml', text: '' }] }, '3 documents, more than the 2 allowed'],
            ['a text longer than maxLines', { documents: [motors, { uri: 'file:///ws/a.sysml', text: 'package A {\n\n\n}' }] }, 'documents[1] has 4 lines, more than the 3 allowed'],
        ])('answers InvalidParams for %s, before anything changes', async (_case, params, mentions) => {
            const { dm, validator } = await setup([motors], { ...enabled, maxDocuments: 2, maxLines: 3 });
            expect(rpcError(InvalidParams, () => validator.validate(params)).message).toContain(mentions);
            expect(dm.getUris()).toEqual([motors.uri]);
            expect(dm.getText(motors.uri)).toBe(motors.text);
        });

        it('accepts exact default character limits and rejects one more before parsing', async () => {
            const { readTextValidationSettings } = await import('../../server/src/providers/textValidationProvider.js');
            const { dm, validator } = await setup([motors], readTextValidationSettings({ enabled: true }));
            const text = ' '.repeat(8_192);
            expect(validator.validate({
                documents: [{ uri: motors.uri, text }, { uri: 'file:///ws/empty.sysml', text }],
            }).documents).toHaveLength(2);
            const parse = vi.spyOn(dm, 'withTexts');
            const oversized = rpcError(InvalidParams, () => validator.validate({
                documents: [{ uri: motors.uri, text: text + ' ' }],
            }));
            expect(oversized.message).toContain('sysml.experimental.validateText.maxCharacters');
            const total = rpcError(InvalidParams, () => validator.validate({
                documents: [
                    { uri: motors.uri, text },
                    { uri: 'file:///ws/empty.sysml', text },
                    { uri: 'file:///ws/extra.sysml', text: ' ' },
                ],
            }));
            expect(total.message).toContain('sysml.experimental.validateText.maxTotalCharacters');
            expect(parse).not.toHaveBeenCalled();
            expect(dm.getText(motors.uri)).toBe(motors.text);
            expect(dm.getUris()).toEqual([motors.uri]);
        });

        it('rejects dense single-line input under default limits before parsing', async () => {
            const { readTextValidationSettings } = await import('../../server/src/providers/textValidationProvider.js');
            const { dm, validator } = await setup([motors], readTextValidationSettings({ enabled: true }));
            const parse = vi.spyOn(dm, 'withTexts');
            const text = 'package Generated { '
                + Array.from({ length: 4_000 }, (_, i) => `part def Type${i}; part usage${i} : Type${i};`).join(' ')
                + ' }';
            expect(text).not.toContain('\n');
            expect(rpcError(InvalidParams, () => validator.validate({
                documents: [{ uri: motors.uri, text }],
            })).message).toContain('sysml.experimental.validateText.maxCharacters');
            expect(parse).not.toHaveBeenCalled();
            expect(dm.getText(motors.uri)).toBe(motors.text);
        });

        it('counts UTF-16 code units and follows configured character limits', async () => {
            const { readTextValidationSettings } = await import('../../server/src/providers/textValidationProvider.js');
            const context = await setup([], readTextValidationSettings({
                enabled: true, maxCharacters: 8, maxTotalCharacters: 9,
            }));
            expect(context.validateOne('/*\u{1f680}*/')).toEqual([]);
            expect(context.validator.validate({ documents: [
                { uri: 'file:///a.sysml', text: '    ' }, { uri: 'file:///b.sysml', text: '     ' },
            ] }).documents).toHaveLength(2);
            expect(rpcError(InvalidParams, () => context.validateOne('/*\u{1f680}\u{1f680}\u{1f680}*/')).message)
                .toContain('maxCharacters');
            expect(rpcError(InvalidParams, () => context.validator.validate({ documents: [
                { uri: 'file:///a.sysml', text: '     ' }, { uri: 'file:///b.sysml', text: '     ' },
            ] })).message).toContain('maxTotalCharacters');
        });
    });

    describe('validation coverage: the diagnostics an open document with the same text gets', () => {
        it.each(hiddenSyntaxErrorCases)('preserves syntax errors with $name (#154)', async ({ text, line }) => {
            const uri = 'file:///ws/syntax.sysml';
            const context = await setup([{ uri, text }]);
            const errors = context.dm.get(uri)!.errors;
            expect(errors).toHaveLength(1);
            const diagnostics = context.validateOne(text, uri);
            const syntaxDiagnostics = diagnostics.filter(d => d.severity === 1 && d.code === undefined);
            expect(syntaxDiagnostics).toHaveLength(errors.length);
            expect(syntaxDiagnostics[0].range.start.line).toBe(line);
            expect(diagnostics).toEqual(await ownDiagnostics(context, uri));
        });

        it('reports syntax errors', async () => {
            const { validateOne } = await setup([]);
            const diagnostics = validateOne('package P { part def A }');
            expect(diagnostics.length).toBeGreaterThan(0);
            expect(diagnostics[0].range.start.line).toBe(0);
        });

        it('includes the keyword checks', async () => {
            const { validateOne } = await setup([]);
            expect(codes(validateOne("part def '';"))).toContain('empty-name');
        });

        it('resolves references to other documents of the workspace', async () => {
            const { validateOne } = await setup([{ uri: 'file:///ws/engine.sysml', text: 'package Parts { part def Engine; }' }]);
            expect(codes(validateOne('package Car { private import Parts::*; part engine : Engine; }'))).not.toContain('unresolved-type');
            expect(codes(validateOne('package Car { private import Parts::*; part gearbox : Gearbox; }'))).toContain('unresolved-type');
        });

        it('validates a text as if it were the content of its uri\'s document, not as a second copy', async () => {
            const uri = 'file:///ws/engine.sysml';
            const { validateOne } = await setup([{ uri, text: 'part def Engine;' }]);

            // As a new document, a second top-level Engine clashes with the existing one ...
            expect(codes(validateOne('part def Engine;'))).toContain('ambiguous-namespace-name');
            // ... checked as engine.sysml's content, it takes the existing one's place in the check.
            expect(codes(validateOne('part def Engine;', uri))).not.toContain('ambiguous-namespace-name');
        });

        it('leaves out the codes the client disabled, as the published diagnostics do', async () => {
            const { validateOne } = await setup([], enabled, d => d.code !== 'unresolved-type');
            const diagnostics = validateOne("package Car { part gearbox : Gearbox; part def '';}");
            expect(codes(diagnostics)).not.toContain('unresolved-type');
            expect(codes(diagnostics)).toContain('empty-name');
        });

        it('reports only the requested documents: a document the change breaks is reported once it is in the request', async () => {
            const parts = { uri: 'file:///ws/parts.sysml', text: 'package Parts { part def Engine; }' };
            const car = { uri: 'file:///ws/car.sysml', text: 'package Car { private import Parts::*; part engine : Engine; }' };
            const { validator } = await setup([parts, car]);
            const withoutEngine = { uri: parts.uri, text: 'package Parts { }' };

            const alone = validator.validate({ documents: [withoutEngine] });
            expect(alone.documents.map(d => d.uri)).toEqual([parts.uri]);
            expect(alone.documents[0].diagnostics).toEqual([]);

            const withCar = validator.validate({ documents: [withoutEngine, car] });
            expect(codes(withCar.documents[1].diagnostics)).toContain('unresolved-type');
        });

        describe('the same text under the same uri as an existing document', () => {
            const uri = 'file:///ws/vehicle.sysml';
            const text = 'package Vehicle {\n    part def Engine;\n    part engine : Engine;\n    part gearbox : Gearbox;\n}\n';

            it('gives exactly the diagnostics the document has, and changes nothing', async () => {
                const context = await setup([
                    { uri, text },
                    { uri: 'file:///ws/other.sysml', text: 'package Other { private import Vehicle::*; part e : Engine; }' },
                ]);
                const { dm, semanticValidator, validateOne } = context;
                const own = await ownDiagnostics(context, uri);
                const symbolsBefore = qualifiedNames(context);
                const otherBefore = semanticValidator.validate('file:///ws/other.sysml');

                const diagnostics = validateOne(text, uri);
                expect(diagnostics).toEqual(own);
                expect(codes(diagnostics)).toContain('unresolved-type');
                expect(codes(diagnostics)).not.toContain('ambiguous-namespace-name');
                expect(codes(diagnostics)).not.toContain('duplicate-definition');

                expect(dm.getText(uri)).toBe(text);
                expect(dm.getVersion(uri)).toBe(1);
                expect(qualifiedNames(context)).toEqual(symbolsBefore);
                expect(semanticValidator.validate('file:///ws/other.sysml')).toEqual(otherBefore);
                expect(await ownDiagnostics(context, uri)).toEqual(own);
            });

            it('recognizes the document under another spelling of its uri (Windows drive letter)', async () => {
                const scanned = 'file:///c:/ws/vehicle.sysml';
                const { dm, validateOne } = await setup([{ uri: scanned, text }]);
                expect(codes(validateOne(text, 'file:///C%3A/ws/vehicle.sysml'))).not.toContain('ambiguous-namespace-name');
                expect(dm.getUris()).toEqual([scanned]);
            });
        });

        it('gives every fixture and example, as its own document\'s new content, exactly the diagnostics it has open', async () => {
            const root = join(__dirname, '..', '..');
            const folders = ['test/fixtures/valid', 'test/fixtures/invalid', 'examples'];
            const files = folders.flatMap(folder => readdirSync(join(root, folder))
                .filter(name => name.endsWith('.sysml'))
                .map(name => ({ uri: `file:///ws/${folder}/${name}`, text: readFileSync(join(root, folder, name), 'utf-8') })));
            expect(files.length).toBeGreaterThan(8);
            // All in one workspace, so cross-file checks (clashes, references) count too.
            const context = await setup(files, { ...enabled, maxLines: Number.MAX_SAFE_INTEGER });

            const all = new Set<unknown>();
            for (const { uri, text } of files) {
                const diagnostics = context.validateOne(text, uri);
                expect(diagnostics, uri).toEqual(await ownDiagnostics(context, uri));
                codes(diagnostics).forEach(code => all.add(code));
            }
            // Syntax errors (no code) and semantic checks are both among them.
            expect(all.has(undefined)).toBe(true);
            expect(all.size).toBeGreaterThan(2);
        }, 120_000);

        describe('text that is not SysML v2', () => {
            it.each([
                ['prose', 'This is not a model, just a sentence.'],
                ['JSON', '{ "parts": [ { "name": "engine" } ] }'],
                ['Python', 'def engine():\n    return 42\n'],
                ['XMI', '<?xml version="1.0"?>\n<xmi:XMI xmlns:xmi="http://www.omg.org/XMI"><uml:Model name="M"/></xmi:XMI>'],
                ['control characters', '\u0000\u0001 part \u0007 def'],
            ])('reports %s as syntax errors, without throwing or changing anything', async (_kind, text) => {
                const uri = 'file:///ws/parts.sysml';
                const context = await setup([{ uri, text: 'package Parts { part def Engine; }' }]);

                const diagnostics = context.validateOne(text, uri);
                expect(diagnostics.length).toBeGreaterThan(0);
                expect(diagnostics.every(d => d.range.start.line >= 0 && d.message.length > 0)).toBe(true);

                expect(context.dm.getText(uri)).toBe('package Parts { part def Engine; }');
                expect(qualifiedNames(context)).toContain('Parts::Engine');
            });

            it('accepts empty and blank text as an empty model', async () => {
                const { validateOne } = await setup([]);
                expect(validateOne('')).toEqual([]);
                expect(validateOne('  \n\t\n')).toEqual([]);
            });
        });

        describe('several documents at once', () => {
            const motors = { uri: 'file:///ws/motors.sysml', text: 'package Motors { part def Motor; }' };
            const vehicle = { uri: 'file:///ws/vehicle.sysml', text: 'package Vehicle { private import Motors::*; part motor : Motor; }' };

            it('resolves references between the documents, which one at a time do not', async () => {
                const { validator, validateOne } = await setup([]);
                const together = validator.validate({ documents: [motors, vehicle] });
                expect(together.documents.map(d => d.uri)).toEqual([motors.uri, vehicle.uri]);
                expect(together.documents.flatMap(d => codes(d.diagnostics))).not.toContain('unresolved-type');

                expect(codes(validateOne(vehicle.text, vehicle.uri))).toContain('unresolved-type');
            });

            it('gives each document its own diagnostics, under the uri the client sent', async () => {
                const scanned = 'file:///c:/ws/motors.sysml';
                const { validator } = await setup([{ uri: scanned, text: motors.text }]);
                const result = validator.validate({
                    documents: [
                        { uri: 'file:///C%3A/ws/motors.sysml', text: 'package Motors { part def Motor; part m : Missing; }' },
                        { uri: 'file:///c:/ws/vehicle.sysml', text: vehicle.text },
                    ],
                });
                expect(result.documents.map(d => d.uri)).toEqual(['file:///C%3A/ws/motors.sysml', 'file:///c:/ws/vehicle.sysml']);
                expect(codes(result.documents[0].diagnostics)).toContain('unresolved-type');
                expect(codes(result.documents[1].diagnostics)).not.toContain('unresolved-type');
                // The motors text was checked in place of the scanned document (another spelling of its uri): no clash.
                expect(result.documents.flatMap(d => codes(d.diagnostics))).not.toContain('ambiguous-namespace-name');
            });

            it('checks new contents for several existing documents at once, and changes nothing', async () => {
                const context = await setup([motors, vehicle]);
                const { dm, semanticValidator, validator } = context;
                const symbolsBefore = qualifiedNames(context);
                const vehicleBefore = semanticValidator.validate(vehicle.uri);

                // Rename Motor to Engine in both documents: valid only when both change together.
                const result = validator.validate({
                    documents: [
                        { uri: motors.uri, text: 'package Motors { part def Engine; }' },
                        { uri: vehicle.uri, text: 'package Vehicle { private import Motors::*; part motor : Engine; }' },
                    ],
                });
                expect(result.documents.flatMap(d => codes(d.diagnostics))).not.toContain('unresolved-type');

                expect(dm.getUris()).toEqual([motors.uri, vehicle.uri]);
                expect(dm.getText(motors.uri)).toBe(motors.text);
                expect(dm.getText(vehicle.uri)).toBe(vehicle.text);
                expect(qualifiedNames(context)).toEqual(symbolsBefore);
                expect(semanticValidator.validate(vehicle.uri)).toEqual(vehicleBefore);
            });
        });
    });

    describe('isolation: nothing changes, and no other request sees the texts', () => {
        it('leaves documents, symbols and later diagnostics unchanged', async () => {
            const uri = 'file:///ws/parts.sysml';
            const context = await setup([
                { uri, text: 'package Parts { part def Engine; }' },
                { uri: 'file:///ws/car.sysml', text: 'package Car { part engine : Parts::Engine; }' },
            ]);
            const { dm, semanticValidator, validateOne } = context;
            const before = semanticValidator.validate('file:///ws/car.sysml');
            const urisBefore = dm.getUris();

            // Validating a version of parts.sysml without Engine must not leak into car.sysml.
            validateOne('package Parts { }', uri);
            validateOne('package Extra { part def Engine; }');

            expect(dm.getUris()).toEqual(urisBefore);
            expect(dm.getText(uri)).toBe('package Parts { part def Engine; }');
            expect(dm.getVersion(uri)).toBe(1);
            expect(qualifiedNames(context)).toContain('Parts::Engine');
            expect(qualifiedNames(context)).not.toContain('Extra::Engine');
            expect(semanticValidator.validate('file:///ws/car.sysml')).toEqual(before);
        });

        it('gives other requests the same answers afterwards: no temporary symbol is visible to them', async () => {
            const { CompletionProvider } = await import('../../server/src/providers/completionProvider.js');
            const { DefinitionProvider } = await import('../../server/src/providers/definitionProvider.js');
            const parts = { uri: 'file:///ws/parts.sysml', text: 'package Parts { part def Engine; }' };
            const car = { uri: 'file:///ws/car.sysml', text: 'package Car {\n    private import Parts::*;\n    part engine : Engine;\n    \n}\n' };
            const { dm, validator } = await setup([parts, car]);
            const completion = new CompletionProvider(dm);
            const definition = new DefinitionProvider(dm);
            const ask = () => ({
                completions: completion.provideCompletions({ textDocument: { uri: car.uri }, position: { line: 3, character: 4 } }).map(c => c.label).sort(),
                definition: definition.provideDefinition({ textDocument: { uri: car.uri }, position: { line: 2, character: 20 } }),
            });
            const before = ask();
            expect(before.definition?.uri).toBe(parts.uri);

            // Moves Engine to a new document and adds a definition only the temporary texts have.
            validator.validate({
                documents: [
                    { uri: parts.uri, text: 'package Parts { part def Temporary; }' },
                    { uri: 'file:///ws/moved.sysml', text: 'package Parts2 { part def Engine; }' },
                ],
            });

            const after = ask();
            expect(after).toEqual(before);
            expect(after.completions).not.toContain('Temporary');
        });

        it('restores every document when validation throws', async () => {
            const uri = 'file:///ws/parts.sysml';
            const context = await setup([{ uri, text: 'package Parts { part def Engine; }' }]);
            const documents = [
                { uri, text: 'package Other;' },
                { uri: 'file:///ws/new.sysml', text: 'package New;' },
            ];
            expect(() => context.dm.withTexts(documents, () => { throw new Error('boom'); })).toThrow('boom');
            expect(context.dm.getUris()).toEqual([uri]);
            expect(context.dm.getText(uri)).toBe('package Parts { part def Engine; }');
            expect(qualifiedNames(context)).toContain('Parts::Engine');
        });

        it('changes nothing when a text cannot be parsed: every text is parsed before anything changes', async () => {
            const uri = 'file:///ws/parts.sysml';
            const context = await setup([{ uri, text: 'package Parts { part def Engine; }' }]);
            let ran = false;
            const documents = [
                { uri, text: 'package Other;' },
                { uri: 'file:///ws/new.sysml', text: 42 as unknown as string },
            ];
            expect(() => context.dm.withTexts(documents, () => { ran = true; })).toThrow();
            expect(ran).toBe(false);
            expect(context.dm.getUris()).toEqual([uri]);
            expect(context.dm.getText(uri)).toBe('package Parts { part def Engine; }');
            expect(qualifiedNames(context)).toContain('Parts::Engine');
        });

        it('keeps version-keyed caches apart: the temporary texts never reuse a real document version', async () => {
            // The semantic validator caches which requirements are satisfied, keyed by every document's version.
            const requirements = { uri: 'file:///ws/requirements.sysml', text: 'requirement def MaxMass;\nrequirement maxMass : MaxMass;\n' };
            const satisfaction = { uri: 'file:///ws/satisfaction.sysml', text: 'part vehicle;\nsatisfy maxMass by vehicle;\n' };
            const { semanticValidator, validator } = await setup([requirements, satisfaction]);
            expect(codes(semanticValidator.validate(requirements.uri))).not.toContain('unsatisfied-requirement');

            // Without the satisfy statement, maxMass is unsatisfied. Had the temporary texts kept the real
            // versions (1), the cache filled above would still say it is satisfied.
            const result = validator.validate({ documents: [{ uri: satisfaction.uri, text: 'part vehicle;\n' }, requirements] });
            expect(codes(result.documents[1].diagnostics)).toContain('unsatisfied-requirement');

            // And the cache filled during validation doesn't leak into the real documents afterwards.
            expect(codes(semanticValidator.validate(requirements.uri))).not.toContain('unsatisfied-requirement');
        });

        it.each([2 ** 31 - 1, 2 ** 31 - 2])('does not reuse real version %i or its cached symbols', async version => {
            const { TextDocument } = await import('vscode-languageserver-textdocument');
            const uri = 'file:///ws/version.sysml';
            const original = 'package P { part def Existing; part original : Existing; }';
            const { dm, semanticValidator, validator, validateOne } = await setup([]);
            dm.parse(TextDocument.create(uri, 'sysml', version, original));
            semanticValidator.validate(uri);
            const result = validateOne('package P { part proposed : Missing; }', uri);
            expect(result.filter(d => d.code === 'unresolved-type').map(d => d.message))
                .toEqual([expect.stringContaining('Missing')]);
            expect(result.some(d => d.message.includes('Existing'))).toBe(false);
            validator.validate({ documents: [{ uri, text: 'package Other;' }] });
            expect(dm.getText(uri)).toBe(original);
            expect(dm.getVersion(uri)).toBe(version);
            expect(codes(semanticValidator.validate(uri))).not.toContain('unresolved-type');
        });

        it('uses distinct internal versions above the LSP integer range', async () => {
            const { dm } = await setup([]);
            const uri = 'file:///ws/new.sysml';
            const first = dm.withTexts([{ uri, text: 'package A;' }], () => dm.getVersion(uri));
            const next = dm.withTexts([{ uri, text: 'package B;' }], () => dm.getVersion(uri));
            expect(first).toBe(2 ** 31);
            expect(next).toBe(first + 1);
            expect(dm.getUris()).toEqual([]);
        });

        it('gives each text a revision of its own, also a document opened again at the same version', async () => {
            const { TextDocument } = await import('vscode-languageserver-textdocument');
            const { dm } = await setup([]);
            const uri = 'file:///ws/rev.sysml';
            expect(dm.getRevision(uri)).toBe(-1);
            dm.parse(TextDocument.create(uri, 'sysml', 1, 'package A;'));
            const first = dm.getRevision(uri);
            // The same version again keeps the cached text and its revision.
            dm.parse(TextDocument.create(uri, 'sysml', 1, 'package A;'));
            expect(dm.getRevision(uri)).toBe(first);
            dm.remove(uri);
            expect(dm.getRevision(uri)).toBe(-1);
            dm.parse(TextDocument.create(uri, 'sysml', 1, 'package A;'));
            const reopened = dm.getRevision(uri);
            expect(reopened).toBeGreaterThan(first);
            dm.cacheTextOnly(uri, 2, 'package B;');
            expect(dm.getRevision(uri)).toBeGreaterThan(reopened);
            const standIn = dm.withTexts([{ uri, text: 'package C;' }], () => dm.getRevision(uri));
            expect(standIn).toBeGreaterThan(reopened);
            // The real text is back afterwards, with its own revision.
            expect(dm.getRevision(uri)).not.toBe(standIn);
        });

        it('rejects exhausted internal versions without changing documents', async () => {
            const motors = { uri: 'file:///ws/motors.sysml', text: 'package Motors { part def Motor; }' };
            const { dm } = await setup([motors]);
            dm['temporaryVersion'] = Number.MAX_SAFE_INTEGER;
            expect(() => dm.withTexts([{ uri: motors.uri, text: 'package Other;' }], () => undefined))
                .toThrow('Temporary document version space exhausted');
            expect(dm.getText(motors.uri)).toBe(motors.text);
        });

        it('sees the relationships of the temporary texts: a satisfy added in a validated text satisfies', async () => {
            // Requirement checks skip documents whose version means "no such document" (negative).
            const requirements = { uri: 'file:///ws/requirements.sysml', text: 'requirement def MaxMass;\nrequirement maxMass : MaxMass;\n' };
            const satisfaction = { uri: 'file:///ws/satisfaction.sysml', text: 'part vehicle;\n' };
            const { semanticValidator, validator } = await setup([requirements, satisfaction]);
            expect(codes(semanticValidator.validate(requirements.uri))).toContain('unsatisfied-requirement');

            const result = validator.validate({ documents: [{ uri: satisfaction.uri, text: 'part vehicle;\nsatisfy maxMass by vehicle;\n' }, requirements] });
            expect(codes(result.documents[1].diagnostics)).not.toContain('unsatisfied-requirement');
            expect(codes(semanticValidator.validate(requirements.uri))).toContain('unsatisfied-requirement');
        });

        it('works with documents cached but not parsed yet (as open documents are while the parse worker runs)', async () => {
            const context = await setup([]);
            const { dm, validateOne } = context;
            const uri = 'file:///ws/parts.sysml';
            dm.cacheTextOnly(uri, 3, 'package Parts { part def Engine; }');

            expect(codes(validateOne('package Car { private import Parts::*; part engine : Engine; }'))).not.toContain('unresolved-type');
            expect(codes(validateOne('part def Wheel;', uri))).not.toContain('ambiguous-namespace-name');

            expect(dm.getText(uri)).toBe('package Parts { part def Engine; }');
            expect(dm.getVersion(uri)).toBe(3);
            expect(qualifiedNames(context)).toContain('Parts::Engine');
            expect(qualifiedNames(context)).not.toContain('Wheel');
        });
    });

    describe('invalid parameters', () => {
        const motors = { uri: 'file:///ws/motors.sysml', text: 'package Motors { part def Motor; }' };

        it.each([
            ['no parameters at all', undefined, '"documents" must be a non-empty array'],
            ['no documents', {}, '"documents" must be a non-empty array'],
            ['an empty list', { documents: [] }, '"documents" must be a non-empty array'],
            ['documents that are not a list', { documents: motors }, '"documents" must be a non-empty array'],
            ['a document without text', { documents: [{ uri: motors.uri }] }, 'documents[0] needs "text"'],
            ['text that is not a string', { documents: [{ uri: motors.uri, text: 42 }] }, 'documents[0] needs "text"'],
            ['null text', { documents: [{ uri: motors.uri, text: null }] }, 'documents[0] needs "text"'],
            ['a document without uri', { documents: [{ text: 'package A;' }] }, 'documents[0] needs "uri"'],
            ['a uri that is not a string', { documents: [{ uri: 7, text: 'package A;' }] }, 'documents[0] needs "uri"'],
            ['an empty uri', { documents: [{ uri: '', text: 'package A;' }] }, 'documents[0] needs "uri"'],
            ['a blank uri', { documents: [{ uri: '  ', text: 'package A;' }] }, 'documents[0] needs "uri"'],
            ['the same document twice', { documents: [motors, { ...motors, text: 'package B;' }] }, 'documents[0] and documents[1] name the same document'],
            [
                'the same document under two spellings',
                { documents: [{ uri: 'file:///c:/ws/a.sysml', text: '' }, { uri: 'file:///C%3A/ws/a.sysml', text: '' }] },
                'name the same document',
            ],
        ])('answers InvalidParams for %s, changing nothing', async (_case, params, mentions) => {
            const { dm, validator } = await setup([motors]);
            expect(rpcError(InvalidParams, () => validator.validate(params as never)).message).toContain(mentions);
            expect(dm.getUris()).toEqual([motors.uri]);
            expect(dm.getText(motors.uri)).toBe(motors.text);
        });
    });
});
