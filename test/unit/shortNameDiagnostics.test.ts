import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { SysMLModelProvider } from '../../server/src/model/sysmlModelProvider.js';
import { SemanticValidator } from '../../server/src/providers/semanticValidator.js';

/**
 * A clash of names (KerML 8.3.2.4.5 `validateNamespaceDistinguishibility`,
 * 8.3.2.4.3 `isDistinguishableFrom`) is reported on the identifier that
 * clashes: the declared short name when an element clashes on that alone,
 * else its name.
 */
describe('clash diagnostics on the identifier that clashes', () => {
    const uri = 'file:///short-name-diagnostics.sysml';
    const CODES = ['duplicate-definition', 'ambiguous-namespace-name'];

    /** Parses `text` in a fresh document manager, failing on a syntax error. */
    function setup(text: string) {
        const dm = new DocumentManager();
        const doc = TextDocument.create(uri, 'sysml', 1, text);
        dm.parse(doc);
        expect(dm.get(uri)!.errors.map(error => error.message)).toEqual([]);
        return { dm, doc };
    }

    /** Each clash diagnostic of `text` as `code line:covered text`, sorted. */
    function clashes(text: string): string[] {
        const { dm, doc } = setup(text);
        return new SemanticValidator(dm).validate(uri)
            .filter(d => CODES.includes(String(d.code)))
            .map(d => `${d.code} ${d.range.start.line}:${doc.getText(d.range)}`)
            .sort();
    }

    /** Each clash diagnostic of `text` as `line:covered text message`, sorted. */
    function clashMessages(text: string): string[] {
        const { dm, doc } = setup(text);
        return new SemanticValidator(dm).validate(uri)
            .filter(d => CODES.includes(String(d.code)))
            .map(d => `${d.range.start.line}:${doc.getText(d.range)} ${d.message}`)
            .sort();
    }

    /** The same for the diagnostics of `sysml/model`. */
    function modelClashes(text: string): string[] {
        const { dm, doc } = setup(text);
        const model = new SysMLModelProvider(dm).getModel(uri, 1, ['diagnostics']);
        return (model.diagnostics ?? [])
            .filter(d => CODES.includes(d.code))
            .map(d => `${d.code} ${d.range.start.line}:${doc.getText(d.range)}`)
            .sort();
    }

    it('reports a clash on a short name at the short name, and on a name at the name', () => {
        const text = `package P {
    part def <w> A;
    part def <w> B;
    part def <C> D;
    part def C;
}`;
        expect(clashes(text)).toEqual([
            'ambiguous-namespace-name 1:w',
            'ambiguous-namespace-name 2:w',
            'ambiguous-namespace-name 3:C',
            'ambiguous-namespace-name 4:C',
            'duplicate-definition 1:w',
            'duplicate-definition 2:w',
            'duplicate-definition 3:C',
            'duplicate-definition 4:C',
        ]);
        expect(modelClashes(text)).toEqual([
            'ambiguous-namespace-name 1:w',
            'ambiguous-namespace-name 2:w',
            'ambiguous-namespace-name 3:C',
            'ambiguous-namespace-name 4:C',
        ]);
    });

    it('says short name for a clash on the element\'s own short name, and name for one on its name', () => {
        const text = `package P {
    part def <w> A;
    part def <w> B;
    part def <C> D;
    part def C;
}`;
        expect(clashMessages(text)).toEqual([
            "1:w Ambiguous short name 'w': also declared as part def in this document (line 3).",
            "1:w Duplicate definition: short name 'w' is defined 2 times in the same scope",
            "2:w Ambiguous short name 'w': also declared as part def in this document (line 2).",
            "2:w Duplicate definition: short name 'w' is defined 2 times in the same scope",
            "3:C Ambiguous short name 'C': also declared as part def in this document (line 5).",
            "3:C Duplicate definition: short name 'C' is defined 2 times in the same scope",
            "4:C Ambiguous name 'C': also declared as part def in this document (line 4).",
            "4:C Duplicate definition: 'C' is defined 2 times in the same scope",
        ]);
        const { dm } = setup(text);
        const model = new SysMLModelProvider(dm).getModel(uri, 1, ['diagnostics']);
        expect((model.diagnostics ?? []).filter(d => d.code === 'ambiguous-namespace-name').map(d => d.message).sort()).toEqual([
            "Ambiguous name 'C': also declared as part def in this document (line 4).",
            "Ambiguous short name 'C': also declared as part def in this document (line 5).",
            "Ambiguous short name 'w': also declared as part def in this document (line 2).",
            "Ambiguous short name 'w': also declared as part def in this document (line 3).",
        ]);
    });

    it('keeps a clash on a name at the name, with or without a short name', () => {
        const text = `package P {
    part def <w1> Wheel;
    part def <w2> Wheel;
    part def <A> A;
    part def A;
}`;
        expect(clashes(text)).toEqual([
            'ambiguous-namespace-name 1:Wheel',
            'ambiguous-namespace-name 2:Wheel',
            'ambiguous-namespace-name 3:A',
            'ambiguous-namespace-name 4:A',
            'duplicate-definition 1:Wheel',
            'duplicate-definition 2:Wheel',
            'duplicate-definition 3:A',
            'duplicate-definition 4:A',
        ]);
    });

    it('reports a clash on both identifiers with one element at each identifier', () => {
        const text = `package P {
    part def <x> X;
    part def <x> X;
}`;
        expect(clashMessages(text)).toEqual([
            "1:X Ambiguous name 'X': also declared as part def in this document (line 3).",
            "1:X Duplicate definition: 'X' is defined 2 times in the same scope",
            "1:x Ambiguous short name 'x': also declared as part def in this document (line 3).",
            "1:x Duplicate definition: short name 'x' is defined 2 times in the same scope",
            "2:X Ambiguous name 'X': also declared as part def in this document (line 2).",
            "2:X Duplicate definition: 'X' is defined 2 times in the same scope",
            "2:x Ambiguous short name 'x': also declared as part def in this document (line 2).",
            "2:x Duplicate definition: short name 'x' is defined 2 times in the same scope",
        ]);
    });

    it('reports a clash on the name with one element and on the short name with another at each identifier, each naming its own peers', () => {
        const text = `package P {
    part def <e> Engine;
    part def <e> Wheel;
    part def Wheel;
}`;
        expect(clashMessages(text)).toEqual([
            "1:e Ambiguous short name 'e': also declared as part def in this document (line 3).",
            "1:e Duplicate definition: short name 'e' is defined 2 times in the same scope",
            "2:Wheel Ambiguous name 'Wheel': also declared as part def in this document (line 4).",
            "2:Wheel Duplicate definition: 'Wheel' is defined 2 times in the same scope",
            "2:e Ambiguous short name 'e': also declared as part def in this document (line 2).",
            "2:e Duplicate definition: short name 'e' is defined 2 times in the same scope",
            "3:Wheel Ambiguous name 'Wheel': also declared as part def in this document (line 3).",
            "3:Wheel Duplicate definition: 'Wheel' is defined 2 times in the same scope",
        ]);
        expect(modelClashes(text)).toEqual([
            'ambiguous-namespace-name 1:e',
            'ambiguous-namespace-name 2:Wheel',
            'ambiguous-namespace-name 2:e',
            'ambiguous-namespace-name 3:Wheel',
        ]);
    });

    it('reports a clash across two documents of one package at each document\'s own identifier, in either order', () => {
        for (const order of [['a', 'b'], ['b', 'a']]) {
            const texts: Record<string, string> = {
                a: 'package P {\n    part def <e> Engine;\n    part def <e> Wheel;\n}',
                b: 'package P {\n    part def Wheel;\n}',
            };
            const dm = new DocumentManager();
            const docs = Object.fromEntries(order.map(key => {
                const doc = TextDocument.create(`file:///${key}.sysml`, 'sysml', 1, texts[key]);
                dm.parse(doc);
                return [key, doc];
            }));
            const ambiguous = (key: string) => new SemanticValidator(dm).validate(docs[key].uri)
                .filter(d => d.code === 'ambiguous-namespace-name')
                .map(d => `${d.range.start.line}:${docs[key].getText(d.range)} ${d.message}`)
                .sort();
            expect(ambiguous('a')).toEqual([
                "1:e Ambiguous short name 'e': also declared as part def in this document (line 3).",
                "2:Wheel Ambiguous name 'Wheel': also declared as part def in document b.sysml (line 2).",
                "2:e Ambiguous short name 'e': also declared as part def in this document (line 2).",
            ]);
            expect(ambiguous('b')).toEqual([
                "1:Wheel Ambiguous name 'Wheel': also declared as part def in document a.sysml (line 3).",
            ]);
        }
    });

    it('reports usages, aliases, features and transitions at their own short names', () => {
        const text = `package P {
    part <p> one;
    part <p> two;
    alias <q> Q1 for one;
    alias <q> Q2 for two;
    state def S {
        state s1; state s2;
        transition <t> t1 first s1 then s2;
        transition <t> t2 first s2 then s1;
    }
}`;
        expect(clashes(text)).toEqual([
            'ambiguous-namespace-name 1:p',
            'ambiguous-namespace-name 2:p',
            'ambiguous-namespace-name 3:q',
            'ambiguous-namespace-name 4:q',
            'ambiguous-namespace-name 7:t',
            'ambiguous-namespace-name 8:t',
        ]);
    });

    it('reports a quoted short name and one spelled like a keyword at that short name', () => {
        const text = `package P {
    part def <'part'> E1;
    part def <'part'> E2;
    part def <'a b'> F1;
    part def <'a b'> F2;
}`;
        expect(clashes(text).filter(d => d.startsWith('duplicate-definition'))).toEqual([
            "duplicate-definition 1:'part'",
            "duplicate-definition 2:'part'",
            "duplicate-definition 3:'a b'",
            "duplicate-definition 4:'a b'",
        ]);
    });

    it('never takes the short name of a member, a body element or a comment', () => {
        const text = `package P {
    part def Twin { part <m> member; doc /* part def <Twin> Other; */ }
    part def Twin { part <m> member2; }
    // part def <Twin> Commented;
}`;
        expect(clashes(text)).toEqual([
            'ambiguous-namespace-name 1:Twin',
            'ambiguous-namespace-name 2:Twin',
            'duplicate-definition 1:Twin',
            'duplicate-definition 2:Twin',
        ]);
    });

    it('reports a usage named after a feature, whose short name is not its own, at its name', () => {
        const text = `package P {
    part def V { part <w> wheels; part <w> tyres; }
    part v : V {
        part :>> wheels;
        part :>> tyres;
    }
}`;
        expect(clashes(text)).toEqual([
            'ambiguous-namespace-name 1:w',
            'ambiguous-namespace-name 1:w',
            'ambiguous-namespace-name 3:wheels',
            'ambiguous-namespace-name 4:tyres',
        ]);
    });

    it('follows the text over a document lifetime: change, close and reopen at the same version', () => {
        const dm = new DocumentManager();
        const at = (text: string, version: number) => {
            const doc = TextDocument.create(uri, 'sysml', version, text);
            dm.parse(doc);
            return new SemanticValidator(dm).validate(uri)
                .filter(d => d.code === 'duplicate-definition')
                .map(d => `${d.range.start.line}:${doc.getText(d.range)}`);
        };
        expect(at('package P {\n    part def <w> A;\n    part def <w> B;\n}', 1)).toEqual(['1:w', '2:w']);
        expect(at('package P {\n    part def <v> A;\n    part def A;\n}', 2)).toEqual(['1:A', '2:A']);
        dm.remove(uri);
        expect(at('package P {\n    part def <long> A;\n    part def <long> B;\n}', 2)).toEqual(['1:long', '2:long']);
    });
});
