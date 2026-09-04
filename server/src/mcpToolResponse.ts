/** Environment flag used by the bundled VS Code integration. */
export const COPILOT_MODE_ENV_VAR = 'SYSML_MCP_COPILOT_MODE';

/** Copilot-specific instructions retained for the bundled VS Code MCP host. */
export const COPILOT_SERVER_INSTRUCTIONS =
    'SysML v2 Model Context server. CRITICAL RULES:\n' +
    '1. Call EXACTLY the tool(s) the user asked for — nothing more. Never add extra tool calls.\n' +
    '2. "preview" means ONLY the preview tool. NEVER call getComplexity alongside preview.\n' +
    '3. getComplexity may ONLY be called when the user literally asks for ' +
    '"complexity" or "metrics".\n' +
    '4. AFTER calling the preview tool, you MUST IMMEDIATELY call the ' +
    '"renderMermaidDiagram" tool.\n' +
    '   Pass the "mermaidMarkup" field from the preview response as the "markup" parameter.\n' +
    '   Pass the "title" field as the "title" parameter.\n' +
    '   Do NOT paste mermaid markup as text — it will not render visually.\n' +
    '   The renderMermaidDiagram tool is the ONLY way to display diagrams to the user.\n' +
    '5. After rendering the diagram, reply with ONLY a brief one-sentence summary.\n' +
    '   NEVER show raw JSON, mermaid markup, element counts, participant counts, ' +
    'or semantic notes.\n' +
    '6. If the user asks "visualise/visualize this file" (or similar), use ' +
    'preview/visualise/visualize/visualiseFile/visualizeFile.\n' +
    '   Do NOT use getDefinition or getComplexity for these requests.';

/** Copilot-only follow-up for hosts that provide renderMermaidDiagram. */
export const COPILOT_PREVIEW_INSTRUCTION =
    'ACTION REQUIRED: You MUST now call the "renderMermaidDiagram" tool to ' +
    'display this diagram.\n' +
    'Pass the "mermaidMarkup" field from the data below as the "markup" parameter ' +
    'and the "title" field as the "title" parameter.\n\n' +
    'AFTER the diagram renders, respond with ONLY a single brief sentence such as ' +
    '"Here is your <diagramType> diagram." and nothing else.\n' +
    'Do NOT show or describe: mermaid markup, JSON data, element counts, participant counts, ' +
    'interaction counts, semantic notes, or any raw tool output.\n' +
    'If there are syntaxErrors in the data, mention them briefly. Otherwise output NOTHING extra.';

/** Whether host-specific Copilot rendering instructions should be emitted. */
export function isCopilotMode(
    env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
    return env[COPILOT_MODE_ENV_VAR] === '1';
}

/**
 * Build an MCP structured result with the JSON text fallback recommended by
 * the MCP 2025-06-18 specification for clients that do not consume
 * structuredContent yet.
 */
export function buildStructuredToolResponse<T extends object>(
    payload: T,
    instruction?: string,
): {
    content: Array<{ type: 'text'; text: string }>;
    structuredContent: Record<string, unknown>;
} {
    const serializedPayload = JSON.stringify(payload, null, 2);
    const content: Array<{ type: 'text'; text: string }> = [];

    if (instruction) {
        content.push({ type: 'text', text: instruction });
    }
    content.push({ type: 'text', text: serializedPayload });

    return {
        content,
        structuredContent: payload as Record<string, unknown>,
    };
}
