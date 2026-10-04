import { afterEach, describe, expect, it } from 'vitest';
import { escapeName } from '../../server/src/utils/names.js';
import { DEFAULT_URL_PREFIX, NAMESPACE_URL, getUrlPrefix, setProjectId, uuidV5 } from '../../server/src/utils/uuid.js';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const PROJECT = '3f9c2b1e-7a4d-4e8b-9c2f-1d5e6a7b8c9d';

/** The symbols of one document, built after setting the project ID. */
async function symbolsOf(text: string, projectId?: string) {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
    setProjectId(projectId);
    const st = new SymbolTable();
    st.build('file:///w/a.sysml', parseDocument(text));
    return { st, symbols: st.getSymbolsForUri('file:///w/a.sysml') };
}

afterEach(() => {
    setProjectId(undefined);
});

describe('uuidV5', () => {
    it('gives the published version 5 UUID of www.example.com in the DNS namespace', () => {
        expect(uuidV5(DNS_NAMESPACE, 'www.example.com')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
    });

    it('uses the URL namespace of the UUID standard, as KerML 9.1 prescribes', () => {
        expect(NAMESPACE_URL).toBe('6ba7b811-9dad-11d1-80b4-00c04fd430c8');
    });
});

describe('setProjectId', () => {
    it('makes `urn:uuid:<projectId>/` the URL prefix of top-level elements', () => {
        expect(setProjectId(PROJECT.toUpperCase())).toBe(true);
        expect(getUrlPrefix()).toBe(`urn:uuid:${PROJECT}/`);
    });

    it("rejects a project ID that isn't a UUID, keeping the prefix", () => {
        setProjectId(PROJECT);
        expect(setProjectId('my-project')).toBe(false);
        expect(getUrlPrefix()).toBe(`urn:uuid:${PROJECT}/`);
    });

    it('restores the default prefix without a project ID', () => {
        setProjectId(PROJECT);
        setProjectId(undefined);
        expect(getUrlPrefix()).toBe(DEFAULT_URL_PREFIX);
    });
});

describe('escapeName', () => {
    it.each([
        ['Engine', 'Engine'],
        ['_power2', '_power2'],
        ['my car', "'my car'"],
        ['part', "'part'"],
        ['2nd', "'2nd'"],
        ["it's", "'it\\'s'"],
        ['a\\b', "'a\\\\b'"],
    ])('writes `%s` as `%s`', (name, written) => {
        expect(escapeName(name)).toBe(written);
    });
});

describe('symbolId (KerML 9.1)', () => {
    const text = `package Demo {
    part def Engine;
    part a { port p; }
    part b { port p; }
    part 'my car' { part : Engine; }
    part 'part';
    connect a.p to b.p { attribute flowRate; }
}`;

    it("derives a top-level symbol's ID from its URL, and each other symbol's from its path in that symbol ID", async () => {
        const { st, symbols } = await symbolsOf(text, PROJECT);
        const demo = st.getSymbol('Demo')!;
        expect(demo.symbolId).toBe(uuidV5(NAMESPACE_URL, `urn:uuid:${PROJECT}/Demo`));
        const idOf = (path: string) => uuidV5(demo.symbolId, path);
        expect(st.getSymbol('Demo::Engine')!.symbolId).toBe(idOf('Demo::Engine'));
        expect(st.getSymbol('Demo::a::p')!.symbolId).toBe(idOf('Demo::a::p'));
        // A qualified name as written in the notation: quoted where needed.
        expect(st.getSymbol('Demo::my car')!.symbolId).toBe(idOf("Demo::'my car'"));
        expect(st.getSymbol('Demo::part')!.symbolId).toBe(idOf("Demo::'part'"));
        // Without a qualified name: the owner's path, `/` and the declaration as written.
        const anonymousPart = symbols.find((s) => s.kind === 'part' && s.name === '')!;
        expect(anonymousPart.symbolId).toBe(idOf("Demo::'my car'/part : Engine"));
        const connection = symbols.find((s) => s.kind === 'connection')!;
        expect(connection.symbolId).toBe(idOf('Demo/connect a.p to b.p'));
        const flowRate = symbols.find((s) => s.name === 'flowRate')!;
        expect(flowRate.symbolId).toBe(idOf('Demo/connect a.p to b.p/flowRate'));
    });

    it('gives the same model the same symbol IDs in one project, and other symbol IDs in another', async () => {
        const ids = async (projectId?: string) => (await symbolsOf(text, projectId)).symbols.map((s) => s.symbolId);
        const first = await ids(PROJECT);
        expect(await ids(PROJECT)).toEqual(first);
        const other = await ids('0b6c2f0e-1d2a-4c8e-9f3b-5a6d7e8f9a0b');
        expect(other.every((id, i) => id !== first[i])).toBe(true);
    });

    it('uses the default URL prefix without a project ID', async () => {
        const { st } = await symbolsOf(text);
        expect(st.getSymbol('Demo')!.symbolId).toBe(uuidV5(NAMESPACE_URL, `${DEFAULT_URL_PREFIX}Demo`));
    });

    it("puts a top-level name that isn't a basic name into its URL percent-encoded", async () => {
        const { st } = await symbolsOf("package 'my pkg';", PROJECT);
        expect(st.getSymbol('my pkg')!.symbolId).toBe(uuidV5(NAMESPACE_URL, `urn:uuid:${PROJECT}/'my%20pkg'`));
    });

    it('re-derives every element inside a renumbered top-level element, named or not', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { st } = await symbolsOf('');
        st.build('file:///w/b.sysml', parseDocument('part P { part x; part : X; }'));
        const [p, x, anonymous] = st.getSymbolsForUri('file:///w/b.sysml');
        const before = [p.symbolId, x.symbolId, anonymous.symbolId];
        // A clash in a document sorted first makes this P the second: P#2.
        st.build('file:///w/0.sysml', parseDocument('part P;'));
        expect(p.symbolId).toBe(uuidV5(NAMESPACE_URL, `${DEFAULT_URL_PREFIX}P#2`));
        expect(x.symbolId).toBe(uuidV5(p.symbolId, 'P::x'));
        expect(anonymous.symbolId).toBe(uuidV5(p.symbolId, 'P#2/part : X'));
        expect([p.symbolId, x.symbolId, anonymous.symbolId]).not.toContain(before[0]);
        expect(x.symbolId).not.toBe(before[1]);
        expect(anonymous.symbolId).not.toBe(before[2]);
    });
});
