/**
 * Phase 3: Copilot suggestions for governance doctrine sections.
 * Uses LLM with doctrine title, section title, existing content, and optional full doctrine context.
 */
import { getOpenAIClient, getOpenAIModel } from '../lib/openaiClient.js';

export interface DoctrineSectionSuggestionsContext {
  doctrineTitle: string;
  sectionTitle: string;
  existingContent?: string;
  fullDoctrineContext?: string;
}

/**
 * Returns suggested content snippets for a doctrine section (Markdown-friendly).
 */
export async function getDoctrineSectionSuggestions(context: DoctrineSectionSuggestionsContext): Promise<string[]> {
  const client = getOpenAIClient();
  if (!client) return [];

  const doctrineContext = (context.fullDoctrineContext && context.fullDoctrineContext.trim())
    ? `\nReference doctrine / policy context (use to align suggestions):\n${context.fullDoctrineContext.slice(0, 4000)}`
    : '';

  const userPrompt = `You are helping write a Governance & Risk Doctrine document.

Doctrine title: ${context.doctrineTitle}
Section title: ${context.sectionTitle}
${context.existingContent ? `Existing content for this section:\n${context.existingContent}\n` : ''}
${doctrineContext}

Provide 2–3 short, concrete content suggestions for this section. Use Markdown (headings, lists, bold) where appropriate. Return a JSON object with a single key "suggestions" whose value is an array of strings. Each string is one suggestion (a paragraph or a short Markdown block). Align with governance and enterprise risk management best practices.`;

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You are a governance and risk management policy writer. Output only valid JSON with a "suggestions" array of strings. Use Markdown in suggestions where helpful.' },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2048
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { suggestions?: string[] };
    const arr = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return arr.filter((s): s is string => typeof s === 'string').slice(0, 5);
  } catch (e) {
    console.error('Doctrine section suggestions error:', e);
    return [];
  }
}
