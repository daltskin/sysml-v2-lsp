import { describe, expect, it } from 'vitest';
import {
    buildStructuredToolResponse,
    COPILOT_MODE_ENV_VAR,
    COPILOT_PREVIEW_INSTRUCTION,
    isCopilotMode,
} from '../../server/src/mcpToolResponse.js';

describe('MCP structured tool responses', () => {
    it('returns structuredContent and an equivalent JSON text fallback', () => {
        const payload = { valid: true, issues: [{ code: 'example' }] };
        const response = buildStructuredToolResponse(payload);

        expect(response.structuredContent).toEqual(payload);
        expect(response.content).toHaveLength(1);
        expect(JSON.parse(response.content[0].text)).toEqual(payload);
    });

    it('prepends optional host instructions without changing structuredContent', () => {
        const payload = { mermaidMarkup: 'flowchart LR\nA-->B', title: 'Example' };
        const response = buildStructuredToolResponse(payload, COPILOT_PREVIEW_INSTRUCTION);

        expect(response.structuredContent).toEqual(payload);
        expect(response.content).toHaveLength(2);
        expect(response.content[0].text).toContain('ACTION REQUIRED');
        expect(JSON.parse(response.content[1].text)).toEqual(payload);
    });

    it('disables Copilot mode by default', () => {
        expect(isCopilotMode({})).toBe(false);
    });

    it('enables Copilot mode only with an explicit opt-in', () => {
        expect(isCopilotMode({ [COPILOT_MODE_ENV_VAR]: '1' })).toBe(true);
        expect(isCopilotMode({ [COPILOT_MODE_ENV_VAR]: '0' })).toBe(false);
        expect(isCopilotMode({ [COPILOT_MODE_ENV_VAR]: 'true' })).toBe(false);
    });
});
