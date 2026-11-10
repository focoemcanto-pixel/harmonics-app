// Adapt scripted integration LLMs to the conversational function-call protocol.
// Does not bypass memory, domain tools, closing prerequisites, claims or rendering.
export function semanticLlm(script) {
  return async (args) => {
    await args.executeTool('conduzir_atendimento', { intent: 'question', facts: {}, action: 'answer' });
    const result = await script(args);
    return { ...result, text: JSON.stringify({ text: result.text, after: '', action_claim: 'none' }) };
  };
}
