import { describe, it, expect } from 'vitest';
import { parseDocument } from '../../server/src/parser/parseDocument.js';

describe('Constraint body expressions', () => {
    it('should parse require constraint inside requirement def', () => {
        const text = `
requirement def WeightRequirement {
    doc /* The bicycle shall weigh no more than 12 kg. */
    subject bicycle : Bicycle;
    require constraint { bicycle.totalMass <= 12 [SI::kg] }
}`;
        const result = parseDocument(text);
        result.errors.forEach(e => console.log(` L${e.line}:${e.column} ${e.message}`));
        expect(result.errors.length).toBe(0);
    });

    it('should parse constraint def with expression body', () => {
        const text = `
constraint def SpeedLimit {
    maxSpeed > 0
}`;
        const result = parseDocument(text);
        result.errors.forEach(e => console.log(` L${e.line}:${e.column} ${e.message}`));
        expect(result.errors.length).toBe(0);
    });

    it('should parse constraint usage with == operator', () => {
        const text = `
constraint sizeCheck { width == 100 }`;
        const result = parseDocument(text);
        result.errors.forEach(e => console.log(` L${e.line}:${e.column} ${e.message}`));
        expect(result.errors.length).toBe(0);
    });

    it('should parse the full bike.sysml example without errors', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const bikeText = fs.readFileSync(
            path.resolve(__dirname, '../../examples/bike.sysml'), 'utf8'
        );
        const result = parseDocument(bikeText);
        result.errors.forEach(e => console.log(` L${e.line}:${e.column} ${e.message}`));
        expect(result.errors.length).toBe(0);
    });
});
