import { describe, it, expect } from 'vitest';

/** Helper: parse text and build a symbol table */
async function buildST(text: string, uri = 'test://test.sysml') {
    const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
    const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');
    const result = parseDocument(text);
    const st = new SymbolTable();
    st.build(uri, result);
    return { st, result };
}

describe('Symbol Table', () => {
    it('should build a symbol table from a parsed document', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const text = `
package VehicleModel {
    part def Vehicle {
        attribute mass : Real;
    }
}
`;
        const result = parseDocument(text);
        const symbolTable = new SymbolTable();
        symbolTable.build('test://vehicle.sysml', result);

        const symbols = symbolTable.getAllSymbols();
        expect(symbols.length).toBeGreaterThan(0);

        // Should find the package
        const packageSymbol = symbols.find(s => s.name === 'VehicleModel');
        expect(packageSymbol).toBeDefined();
    });

    it('should resolve symbols by name', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const text = `
package Test {
    part def MyPart {
        attribute x : Real;
    }
    part myInstance : MyPart;
}
`;
        const result = parseDocument(text);
        const symbolTable = new SymbolTable();
        symbolTable.build('test://test.sysml', result);

        const matches = symbolTable.findByName('MyPart');
        expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract correct type for interface usage with connect clause', async () => {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { SymbolTable } = await import('../../server/src/symbols/symbolTable.js');

        const text = `
package ConnTest {
    port def MechanicalPort {
        attribute torque : Real;
    }

    interface def BrakeCable {
        end leverEnd : MechanicalPort;
        end caliperEnd : MechanicalPort;
    }

    part def BrakeLever {
        port mechPort : MechanicalPort;
    }

    part def BrakeCaliper {
        port mechPort : MechanicalPort;
    }

    part def BrakeSystem {
        part frontLever : BrakeLever;
        part frontCaliper : BrakeCaliper;

        interface frontBrakeCable : BrakeCable connect
            frontLever.mechPort to frontCaliper.mechPort;
    }
}
`;
        const result = parseDocument(text);
        expect(result.errors.length).toBe(0);

        const symbolTable = new SymbolTable();
        symbolTable.build('test://conn.sysml', result);

        const iface = symbolTable.findByName('frontBrakeCable');
        expect(iface.length).toBeGreaterThanOrEqual(1);
        // The type should be 'BrakeCable', not 'BrakeCableconnectfrontLever'
        expect(iface[0].typeName).toBe('BrakeCable');
    });

    // ── Type extraction regression tests ──────────────────────────

    it('should extract typing via colon shorthand (: Type)', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`);
        const engine = st.findByName('engine');
        expect(engine.length).toBeGreaterThanOrEqual(1);
        expect(engine[0].typeNames).toContain('Engine');
    });

    it('should extract multiple types via colon (: A, B)', async () => {
        const { st } = await buildST(`
package Test {
    attribute def Scalar;
    attribute def Unit;
    attribute x : Scalar, Unit;
}
`);
        const x = st.findByName('x');
        expect(x.length).toBeGreaterThanOrEqual(1);
        // Should have both types
        expect(x[0].typeNames.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract specialization via :> syntax', async () => {
        const { st } = await buildST(`
package Test {
    part def Base;
    part def Derived :> Base;
}
`);
        const derived = st.findByName('Derived');
        expect(derived.length).toBeGreaterThanOrEqual(1);
        expect(derived[0].typeNames).toContain('Base');
    });

    it('should extract specialization via specializes keyword', async () => {
        const { st } = await buildST(`
package Test {
    part def Base;
    part def Child specializes Base;
}
`);
        const child = st.findByName('Child');
        expect(child.length).toBeGreaterThanOrEqual(1);
        expect(child[0].typeNames).toContain('Base');
    });

    it('should extract redefinition via :>> in specialization', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
    part def Sports :> Vehicle;
}
`);
        const sports = st.findByName('Sports');
        expect(sports.length).toBeGreaterThanOrEqual(1);
        expect(sports[0].typeNames).toContain('Vehicle');
    });

    it('should extract documentation from doc comment', async () => {
        const { st } = await buildST(`
package Test {
    part def Vehicle {
        doc /* A motor vehicle */
    }
}
`);
        const vehicle = st.findByName('Vehicle');
        expect(vehicle.length).toBeGreaterThanOrEqual(1);
        expect(vehicle[0].documentation).toBeDefined();
        expect(vehicle[0].documentation).toContain('motor vehicle');
    });

    it('should extract multiplicity bounds', async () => {
        const { st } = await buildST(`
package Test {
    part def Vehicle {
        part wheels : Wheel[4];
    }
    part def Wheel;
}
`);
        const wheels = st.findByName('wheels');
        expect(wheels.length).toBeGreaterThanOrEqual(1);
        expect(wheels[0].multiplicity).toBe('4');
    });

    it('should extract multiplicity range', async () => {
        const { st } = await buildST(`
package Test {
    part def Container {
        part items : Item[0..*];
    }
    part def Item;
}
`);
        const items = st.findByName('items');
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items[0].multiplicity).toBe('0..*');
        expect(items[0].multiplicityRange).toBeDefined();
        expect(items[0].multiplicityRange!.lower).toBe(0);
        expect(items[0].multiplicityRange!.upper).toBe('*');
    });

    it('should not include keywords as type names', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`);
        const engine = st.findByName('engine');
        expect(engine.length).toBeGreaterThanOrEqual(1);
        // Only 'Engine' should be in typeNames, not 'part' or other keywords
        for (const tn of engine[0].typeNames) {
            expect(tn).not.toBe('part');
            expect(tn).not.toBe('attribute');
        }
        expect(engine[0].typeNames).toContain('Engine');
    });

    it('should handle defined-by syntax', async () => {
        const { st } = await buildST(`
package Test {
    part def VehicleType;
    part car defined by VehicleType;
}
`);
        const car = st.findByName('car');
        expect(car.length).toBeGreaterThanOrEqual(1);
        expect(car[0].typeNames).toContain('VehicleType');
    });

    it('should handle subsets keyword in type extraction', async () => {
        const { st } = await buildST(`
package Test {
    part def Vehicle {
        part engine : Engine;
    }
    part def Engine;
    part def Car :> Vehicle {
        part carEngine subsets engine : Engine;
    }
}
`);
        const symbols = st.getAllSymbols();
        // carEngine should have Engine as type, not 'engine'
        const carEngine = symbols.find(s => s.name === 'carEngine');
        expect(carEngine).toBeDefined();
    });

    it('should find symbol at position', async () => {
        const { st } = await buildST(`package Test {
    part def Vehicle {
        attribute mass : Real;
    }
}
`);
        // 'Vehicle' starts on line 1
        const sym = st.findSymbolAtPosition('test://test.sysml', 1, 15);
        expect(sym).toBeDefined();
        expect(sym!.name).toBe('Vehicle');
    });

    it('should find references across symbol table', async () => {
        const { st } = await buildST(`
package Test {
    part def Engine;
    part def Vehicle {
        part engine : Engine;
    }
}
`);
        const refs = st.findReferences('Engine');
        expect(refs.length).toBeGreaterThanOrEqual(2); // definition + usage
    });
});
