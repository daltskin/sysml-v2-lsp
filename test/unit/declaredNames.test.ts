import { describe, expect, it } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../server/src/documentManager.js';
import { SysMLModelProvider } from '../../server/src/model/sysmlModelProvider.js';
import type { SysMLElementDTO } from '../../server/src/model/sysmlModelTypes.js';

/**
 * `sysml/model` reports the name and short name as written in an element's own
 * declaration (KerML 8.3.2.1.2 `declaredName`, `declaredShortName`) next to its
 * effective `name` and `shortName`: a usage without a name or short name of its
 * own declares neither, and is named after its naming feature (KerML 8.3.3.3.4).
 */
describe('sysml/model declared names', () => {
    const uri = 'file:///declared.sysml';

    /** The model's elements of `dm`'s document, depth first. */
    function elementsOf(dm: DocumentManager, version = 1): SysMLElementDTO[] {
        const model = new SysMLModelProvider(dm).getModel(uri, version, ['elements']);
        const all: SysMLElementDTO[] = [];
        const walk = (elements: SysMLElementDTO[]) => elements.forEach(e => { all.push(e); walk(e.children); });
        walk(model.elements!);
        return all;
    }

    /** Parses `text` in a fresh document manager and returns its elements. */
    function elements(text: string): SysMLElementDTO[] {
        const dm = new DocumentManager();
        dm.parse(TextDocument.create(uri, 'sysml', 1, text));
        return elementsOf(dm);
    }

    /**
     * The effective and declared names of each of `all`'s elements. An absent
     * `shortName` matches `shortName: undefined` in `toEqual`.
     */
    function names(all: SysMLElementDTO[]) {
        return all.map(({ name, shortName, declaredName, declaredShortName }) => ({ name, shortName, declaredName, declaredShortName }));
    }

    /** The effective and declared name of each of `all`'s elements. */
    function longNames(all: SysMLElementDTO[]) {
        return all.map(({ name, declaredName }) => ({ name, declaredName }));
    }

    /** The members of the element declared with `name` in `all`, in written order. */
    function membersOf(all: SysMLElementDTO[], name: string): SysMLElementDTO[] {
        return all.find(e => e.declaredName === name)!.children;
    }

    it('reports no declared name for a usage named after the feature it redefines', () => {
        const all = elements(`package N {
    part def V { part wheels; item payload; }
    part v : V {
        part :>> wheels;
        part redefines payload;
        part wheels2 :>> wheels;
    }
}
`);
        expect(names(membersOf(all, 'v'))).toEqual([
            { name: 'wheels', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'payload', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'wheels2', shortName: undefined, declaredName: 'wheels2', declaredShortName: null },
        ]);
    });

    it('reports the declared name of every element with one, equal to its name', () => {
        const all = elements(`package N {
    part def V { part wheels; item payload; }
    part v : V;
}
`);
        expect(names(all)).toEqual([
            { name: 'N', shortName: undefined, declaredName: 'N', declaredShortName: null },
            { name: 'V', shortName: undefined, declaredName: 'V', declaredShortName: null },
            { name: 'wheels', shortName: undefined, declaredName: 'wheels', declaredShortName: null },
            { name: 'payload', shortName: undefined, declaredName: 'payload', declaredShortName: null },
            { name: 'v', shortName: undefined, declaredName: 'v', declaredShortName: null },
        ]);
    });

    it('tells an effective short name from a declared one', () => {
        const all = elements(`package N {
    part def V { part <w> wheels; part <s> spare; part <o>; }
    part v : V {
        part :>> wheels;
        part <x> :>> spare;
        part <y> y2 :>> spare;
        part :>> o;
    }
}
`);
        expect(names(membersOf(all, 'v'))).toEqual([
            { name: 'wheels', shortName: 'w', declaredName: null, declaredShortName: null },
            { name: '', shortName: 'x', declaredName: null, declaredShortName: 'x' },
            { name: 'y2', shortName: 'y', declaredName: 'y2', declaredShortName: 'y' },
            { name: '', shortName: 'o', declaredName: null, declaredShortName: null },
        ]);
    });

    it('reports no declared name for a usage named after a feature it performs, exhibits, includes or varies', () => {
        const all = elements(`package N {
    action a;
    state s;
    use case u;
    part p {
        perform a;
        exhibit s;
        include u;
        perform action pa :> a;
    }
    part part1;
    variation part vp {
        variant part1;
        variant part vq;
    }
}
`);
        expect(names(membersOf(all, 'p'))).toEqual([
            { name: 'a', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 's', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'u', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'pa', shortName: undefined, declaredName: 'pa', declaredShortName: null },
        ]);
        expect(names(membersOf(all, 'vp'))).toEqual([
            { name: 'part1', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'vq', shortName: undefined, declaredName: 'vq', declaredShortName: null },
        ]);
    });

    it('reports no declared name whatever the form of the redefinition', () => {
        const all = elements(`package N {
    part def T;
    part def W { part sub; }
    part def V { part wheels : W; part spare; part 'spare wheel'; }
    part v : V {
        part :>> V::wheels;
        part :>> wheels : T;
        part :>> spare, wheels;
        part :>> 'spare wheel';
        part 'my wheel' :>> spare;
        part :>> wheels.sub;
        part :>> missing;
        ref part redefines spare [2];
    }
}
`);
        expect(names(membersOf(all, 'v'))).toEqual([
            { name: 'wheels', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'wheels', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'spare', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'spare wheel', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'my wheel', shortName: undefined, declaredName: 'my wheel', declaredShortName: null },
            { name: 'sub', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'missing', shortName: undefined, declaredName: null, declaredShortName: null },
            { name: 'spare', shortName: undefined, declaredName: null, declaredShortName: null },
        ]);
    });

    it('reports no declared name for a parameter or attribute named after the feature it redefines', () => {
        const all = elements(`package N {
    attribute def Real;
    action def A { in x : Real; out y : Real; attribute k : Real; }
    action a : A {
        in :>> x;
        out redefines y;
        attribute :>> k = 1;
        in x2 :>> x;
    }
}
`);
        expect(longNames(membersOf(all, 'a'))).toEqual([
            { name: 'x', declaredName: null },
            { name: 'y', declaredName: null },
            { name: 'k', declaredName: null },
            { name: 'x2', declaredName: 'x2' },
        ]);
    });

    it('reports the declared names of the members of a redefining usage, not its own', () => {
        const all = elements(`package N {
    part def V { part wheels; }
    part v : V {
        part :>> wheels {
            part hub;
            part :>> wheels;
        }
    }
}
`);
        const [redefining] = membersOf(all, 'v');
        expect(longNames([redefining])).toEqual([{ name: 'wheels', declaredName: null }]);
        expect(longNames(redefining.children)).toEqual([
            { name: 'hub', declaredName: 'hub' },
            { name: 'wheels', declaredName: null },
        ]);
    });

    it('takes no declared name from a comment or documentation', () => {
        const all = elements(`package N {
    part def V { part wheels; part spare; }
    part v : V {
        // part wheels :>> wheels;
        part :>> wheels;
        /* part named :>> spare; */
        part /* named */ :>> spare;
        doc /* part other :>> wheels; */
    }
}
`);
        expect(longNames(membersOf(all, 'v'))).toEqual([
            { name: 'wheels', declaredName: null },
            { name: 'spare', declaredName: null },
        ]);
    });

    it('reports names spelled like keywords as declared names', () => {
        const all = elements(`package N {
    part def V { part 'redefines'; part 'part'; }
    part v : V {
        part :>> 'redefines';
        part 'part' :>> 'part';
    }
}
`);
        expect(longNames(membersOf(all, 'v'))).toEqual([
            { name: 'redefines', declaredName: null },
            { name: 'part', declaredName: 'part' },
        ]);
    });

    it('reports no declared name for an anonymous element', () => {
        const all = elements(`package N {
    part def P { port p; }
    part a : P;
    part b : P;
    part : P;
    connect a.p to b.p;
}
`);
        const anonymous = all.filter(e => e.attributes.isAnonymous === true);
        expect(anonymous.map(({ type, name, declaredName, declaredShortName }) => ({ type, name, declaredName, declaredShortName }))).toEqual([
            { type: 'part', name: '', declaredName: null, declaredShortName: null },
            { type: 'connection', name: '', declaredName: null, declaredShortName: null },
        ]);
    });

    it('reports the declared names of definitions, packages, aliases and transitions', () => {
        const all = elements(`package <np> N {
    part def <pd> PD;
    alias <al> AL for PD;
    state def S {
        state s1;
        state s2;
        transition <t> t1 first s1 then s2;
        transition first s2 then s1;
    }
}
`);
        const named = all.filter(e => e.type !== 'state');
        expect(named.map(({ type, name, shortName, declaredName, declaredShortName }) => ({ type, name, shortName, declaredName, declaredShortName }))).toEqual([
            { type: 'package', name: 'N', shortName: 'np', declaredName: 'N', declaredShortName: 'np' },
            { type: 'part def', name: 'PD', shortName: 'pd', declaredName: 'PD', declaredShortName: 'pd' },
            { type: 'alias', name: 'AL', shortName: 'al', declaredName: 'AL', declaredShortName: 'al' },
            { type: 'state def', name: 'S', shortName: undefined, declaredName: 'S', declaredShortName: null },
            { type: 'transition', name: 't1', shortName: 't', declaredName: 't1', declaredShortName: 't' },
            { type: 'transition', name: '', shortName: undefined, declaredName: null, declaredShortName: null },
        ]);
    });

    it('follows the declaration as the document changes, is closed and reopened', () => {
        const dm = new DocumentManager();
        const named = 'package N {\n    part def V { part wheels; }\n    part v : V { part wheels :>> wheels; }\n}\n';
        const unnamed = 'package N {\n    part def V { part wheels; }\n    part v : V { part :>> wheels; }\n}\n';
        const redefined = () => longNames(membersOf(elementsOf(dm, 1), 'v'));

        dm.parse(TextDocument.create(uri, 'sysml', 1, named));
        expect(redefined()).toEqual([{ name: 'wheels', declaredName: 'wheels' }]);
        dm.parse(TextDocument.create(uri, 'sysml', 2, unnamed));
        expect(redefined()).toEqual([{ name: 'wheels', declaredName: null }]);
        dm.remove(uri);
        dm.parse(TextDocument.create(uri, 'sysml', 2, named));
        expect(redefined()).toEqual([{ name: 'wheels', declaredName: 'wheels' }]);
        expect(redefined()).toEqual(longNames(membersOf(elements(named), 'v')));
    });
});
