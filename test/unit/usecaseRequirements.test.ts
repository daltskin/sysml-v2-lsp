import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Regression tests for use case, actor, stakeholder, and requirement parsing.
 *
 * These tests verify that the full pipeline — ANTLR parse → SymbolTable →
 * SysMLModelProvider — correctly extracts actor, subject, stakeholder, and
 * requirement elements, including their parent-child relationships.
 *
 * Added to prevent regressions where new element kinds (e.g. StakeholderUsage)
 * are present in the grammar but missing from inferKind() or the element enum.
 */
describe('Use Case & Requirement Element Extraction', () => {
    const fixturesDir = join(__dirname, '..', 'fixtures');

    async function getModelForText(text: string, scopes?: string[]) {
        const { parseDocument } = await import('../../server/src/parser/parseDocument.js');
        const { DocumentManager } = await import('../../server/src/documentManager.js');
        const { SysMLModelProvider } = await import('../../server/src/model/sysmlModelProvider.js');

        const uri = 'test://usecase-test.sysml';
        const docManager = new DocumentManager();
        const { TextDocument } = await import('vscode-languageserver-textdocument');
        const doc = TextDocument.create(uri, 'sysml', 1, text);
        docManager.parse(doc);

        const provider = new SysMLModelProvider(docManager);
        return provider.getModel(uri, 1, scopes as any);
    }

    async function getModelForFixture(fixturePath: string, scopes?: string[]) {
        const text = readFileSync(join(fixturesDir, fixturePath), 'utf-8');
        return getModelForText(text, scopes);
    }

    /** Recursively find all elements matching a predicate. */
    function findAll(
        elements: any[],
        predicate: (el: any) => boolean,
    ): any[] {
        const results: any[] = [];
        for (const el of elements) {
            if (predicate(el)) results.push(el);
            if (el.children) results.push(...findAll(el.children, predicate));
        }
        return results;
    }

    // -------------------------------------------------------------------
    // Symbol Table: element kind recognition
    // -------------------------------------------------------------------

    describe('element kinds', () => {
        it('should recognise actor usages inside use case defs', async () => {
            const model = await getModelForText(`
package Test {
    item def Hero;
    use case def Rescue {
        actor hero : Hero;
    }
}
`, ['elements']);

            const actors = findAll(model.elements!, e => e.type === 'actor');
            expect(actors.length).toBeGreaterThanOrEqual(1);
            expect(actors[0].name).toBe('hero');
            expect(actors[0].attributes['partType']).toBe('Hero');
        });

        it('should recognise subject usages inside use case defs', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle;
    use case def Drive {
        subject car : Vehicle;
    }
}
`, ['elements']);

            const subjects = findAll(model.elements!, e => e.type === 'subject');
            expect(subjects.length).toBeGreaterThanOrEqual(1);
            expect(subjects[0].name).toBe('car');
        });

        it('should recognise stakeholder usages inside requirement defs', async () => {
            const model = await getModelForText(`
package Test {
    item def PM;
    requirement def MaxSpeed {
        stakeholder pm : PM;
    }
}
`, ['elements']);

            const stakeholders = findAll(model.elements!, e => e.type === 'stakeholder');
            expect(stakeholders.length).toBeGreaterThanOrEqual(1);
            expect(stakeholders[0].name).toBe('pm');
            expect(stakeholders[0].attributes['partType']).toBe('PM');
        });

        it('should recognise stakeholder usages inside concern defs', async () => {
            const model = await getModelForText(`
package Test {
    part def HeroAssociation;
    concern 'Reduce parts' {
        stakeholder heroAss : HeroAssociation;
    }
}
`, ['elements']);

            const stakeholders = findAll(model.elements!, e => e.type === 'stakeholder');
            expect(stakeholders.length).toBeGreaterThanOrEqual(1);
            expect(stakeholders[0].name).toBe('heroAss');
        });

        it('should recognise include use case usages', async () => {
            const model = await getModelForText(`
package Test {
    use case def Login;
    use case def Checkout {
        include use case login : Login;
    }
}
`, ['elements']);

            const includes = findAll(model.elements!, e => e.type === 'include use case');
            expect(includes.length).toBeGreaterThanOrEqual(1);
            expect(includes[0].name).toBe('login');
        });
    });

    // -------------------------------------------------------------------
    // Parent-child relationships (critical for visualization)
    // -------------------------------------------------------------------

    describe('parent-child structure', () => {
        it('should nest actor and subject as children of use case def', async () => {
            const model = await getModelForText(`
package Test {
    item def Hero;
    part def Batmobile;
    use case def Rescue {
        subject bm : Batmobile;
        actor driver : Hero;
    }
}
`, ['elements']);

            const pkg = model.elements!.find(e => e.name === 'Test')!;
            const uc = pkg.children.find(e => e.type === 'use case def' && e.name === 'Rescue')!;
            expect(uc).toBeDefined();

            const childTypes = uc.children.map(c => c.type);
            expect(childTypes).toContain('subject');
            expect(childTypes).toContain('actor');
        });

        it('should nest stakeholder as child of requirement def', async () => {
            const model = await getModelForText(`
package Test {
    item def PM;
    requirement def MaxSpeed {
        stakeholder pm : PM;
        attribute maxSpeed;
    }
}
`, ['elements']);

            const pkg = model.elements!.find(e => e.name === 'Test')!;
            const req = pkg.children.find(e => e.type === 'requirement def' && e.name === 'MaxSpeed')!;
            expect(req).toBeDefined();

            const childTypes = req.children.map(c => c.type);
            expect(childTypes).toContain('stakeholder');

            const stakeholder = req.children.find(c => c.type === 'stakeholder')!;
            expect(stakeholder.name).toBe('pm');
            expect(stakeholder.attributes['partType']).toBe('PM');
        });

        it('should nest subject as child of requirement def', async () => {
            const model = await getModelForText(`
package Test {
    part def Vehicle;
    requirement def MaxSpeed {
        subject v : Vehicle;
    }
}
`, ['elements']);

            const pkg = model.elements!.find(e => e.name === 'Test')!;
            const req = pkg.children.find(e => e.type === 'requirement def')!;
            const childTypes = req.children.map(c => c.type);
            expect(childTypes).toContain('subject');
        });
    });

    // -------------------------------------------------------------------
    // Full fixture integration test
    // -------------------------------------------------------------------

    describe('usecase-requirements fixture', () => {
        it('should parse the full fixture without errors', async () => {
            const model = await getModelForFixture('valid/usecase-requirements.sysml');
            expect(model.version).toBe(1);
            expect(model.stats!.totalElements).toBeGreaterThan(0);
        });

        it('should contain all expected element kinds', async () => {
            const model = await getModelForFixture('valid/usecase-requirements.sysml', ['elements']);
            const all = findAll(model.elements!, () => true);
            const types = new Set(all.map(e => e.type));

            expect(types).toContain('use case def');
            expect(types).toContain('actor');
            expect(types).toContain('subject');
            expect(types).toContain('stakeholder');
            expect(types).toContain('requirement def');
            expect(types).toContain('requirement');
        });

        it('should extract actor and subject inside use case def', async () => {
            const model = await getModelForFixture('valid/usecase-requirements.sysml', ['elements']);
            const pkg = model.elements!.find(e => e.name === 'UseCaseFixture')!;
            const ucDef = pkg.children.find(e =>
                e.type === 'use case def' && e.name === 'PerformEmergencyStop',
            )!;
            expect(ucDef).toBeDefined();

            const actor = ucDef.children.find(c => c.type === 'actor');
            expect(actor).toBeDefined();
            expect(actor!.name).toBe('operator');
            expect(actor!.attributes['partType']).toBe('Operator');

            const subject = ucDef.children.find(c => c.type === 'subject');
            expect(subject).toBeDefined();
            expect(subject!.name).toBe('v');
        });

        it('should extract stakeholder inside requirement def', async () => {
            const model = await getModelForFixture('valid/usecase-requirements.sysml', ['elements']);
            const pkg = model.elements!.find(e => e.name === 'UseCaseFixture')!;
            const reqDef = pkg.children.find(e =>
                e.type === 'requirement def' && e.name === 'VehicleMaxSpeed',
            )!;
            expect(reqDef).toBeDefined();

            const stakeholder = reqDef.children.find(c => c.type === 'stakeholder');
            expect(stakeholder).toBeDefined();
            expect(stakeholder!.name).toBe('pm');
            expect(stakeholder!.attributes['partType']).toBe('ProjectManager');
        });
    });

    // -------------------------------------------------------------------
    // Type string contract — prevents silent kind omissions
    // -------------------------------------------------------------------

    describe('element type strings contract', () => {
        it('should emit all use-case-related type strings that the extension expects', async () => {
            const model = await getModelForText(`
package Test {
    item def Hero;
    item def PM;
    part def Vehicle;

    use case def UC {
        subject v : Vehicle;
        actor h : Hero;
    }

    use case def UC2;
    use case def UC3 {
        include use case inc : UC2;
    }

    requirement def ReqDef {
        subject v : Vehicle;
        stakeholder pm : PM;
    }
}
`, ['elements']);

            const all = findAll(model.elements!, () => true);
            const types = new Set(all.map(e => e.type));

            // These are the exact type strings the VS Code extension
            // visualization panel filters on. If any are missing here,
            // the use case view will lose links.
            const requiredTypes = [
                'use case def',
                'actor',
                'subject',
                'stakeholder',
                'include use case',
                'requirement def',
            ];

            for (const t of requiredTypes) {
                expect(types, `Missing element type '${t}' — check inferKind() in symbolTable.ts`).toContain(t);
            }
        });
    });
});
