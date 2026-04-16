import { describe, expect, it } from 'vitest';

async function buildST(text: string, uri = 'test://test.sysml') {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
    const result = parseDocument(text);
    const st = new SymbolTable();
    st.build(uri, result);
    return { st, result };
}

describe('Metadata parsing', () => {
    it('should parse metadata def with short name', async () => {
        const text = `
package test{
    private import Metaobjects::SemanticMetadata;

    part def Product{
        attribute partNumber;
        part components : Product;
    }
    metadata def <product> :> SemanticMetadata {
        :>> baseType = Product meta SysML::Definition;
    }

    metadata def <component> :> SemanticMetadata {
        :>> baseType = Product::components meta SysML::Usage;
    }

    #product part def myProductType{
        attribute redefines partNumber = "101";
        #component part myComponent{
            attribute redefines partNumber = "111";
        }
    }

    part myProductUsage : myProductType;
}
`;
        const { st, result } = await buildST(text);

        const symbols = st.getSymbolsForUri('test://test.sysml');

        const metadataSymbols = symbols.filter(s => s.kind === 'metadata def');
        expect(metadataSymbols.length).toBe(2);
        expect(metadataSymbols.map(s => s.name)).toEqual(['product', 'component']);

        // Verify annotated elements have correct names (not annotation names)
        const myProductType = symbols.find(s => s.name === 'myProductType');
        expect(myProductType).toBeDefined();
        expect(myProductType!.kind).toBe('part def');
        expect(myProductType!.metadataAnnotations).toEqual(['product']);

        const myComponent = symbols.find(s => s.name === 'myComponent');
        expect(myComponent).toBeDefined();
        expect(myComponent!.kind).toBe('part');
        expect(myComponent!.metadataAnnotations).toEqual(['component']);

        // Verify non-annotated elements have no annotations
        const product = symbols.find(s => s.name === 'Product');
        expect(product).toBeDefined();
        expect(product!.metadataAnnotations).toBeUndefined();
    });
});
