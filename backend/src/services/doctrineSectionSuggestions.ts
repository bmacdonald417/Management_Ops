/**
 * Phase 3: Copilot suggestions for governance doctrine sections.
 * Phase 2: Includes QMS/FRM document suggestions to fulfill each section.
 */
import { getOpenAIClient, getOpenAIModel } from '../lib/openaiClient.js';

export interface DoctrineSectionSuggestionsContext {
  doctrineTitle: string;
  sectionTitle: string;
  sectionNumber?: string;
  existingContent?: string;
  fullDoctrineContext?: string;
  qmsReferences?: string[];
}

export interface DoctrineSuggestionsResult {
  suggestions: string[];
  qmsDocuments: string[];
}

/**
 * Returns suggested content snippets and QMS documents for a doctrine section.
 */
export async function getDoctrineSectionSuggestions(context: DoctrineSectionSuggestionsContext): Promise<DoctrineSuggestionsResult> {
  const qmsDocuments = Array.isArray(context.qmsReferences) ? context.qmsReferences : [];

  const client = getOpenAIClient();
  if (!client) return { suggestions: [], qmsDocuments };

  const doctrineContext = (context.fullDoctrineContext && context.fullDoctrineContext.trim())
    ? `\nReference doctrine / policy context (use to align suggestions):\n${context.fullDoctrineContext.slice(0, 4000)}`
    : '';

  const qmsHint = qmsDocuments.length > 0
    ? `\nSuggested QMS/FRM documents that may fulfill this section (mention in suggestions where relevant): ${qmsDocuments.join(', ')}`
    : '';

  const userPrompt = `You are helping write a Governance & Risk Doctrine document aligned with federal contracting and MacTech QMS.

Doctrine title: ${context.doctrineTitle}
Section ${context.sectionNumber || ''}: ${context.sectionTitle}
${context.existingContent ? `Existing content for this section:\n${context.existingContent}\n` : ''}
${doctrineContext}
${qmsHint}

Provide 2–3 short, concrete content suggestions for this section. Use Markdown (headings, lists, bold) where appropriate. Suggest which QMS forms (e.g. MAC-FRM-xxx, MAC-SOP-xxx) or appendix documents should be added to fulfill this section. Return a JSON object with:
- "suggestions": array of strings (each a paragraph or short Markdown block)
- "qmsDocuments": array of strings (document IDs/titles to add to QMS, e.g. "MAC-FRM-013 Clause Risk Log")
Include both policy text suggestions and actionable QMS document recommendations. Align with federal governance best practices.`;

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You are a governance and risk management policy writer. Output only valid JSON with "suggestions" and "qmsDocuments" arrays. Use Markdown in suggestions where helpful.' },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 2048
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { suggestions?: string[]; qmsDocuments?: string[] };
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 5) : [];
    const aiQms = Array.isArray(parsed.qmsDocuments) ? parsed.qmsDocuments.filter((s): s is string => typeof s === 'string').slice(0, 10) : [];
    const mergedQms = [...new Set([...qmsDocuments, ...aiQms])];
    return { suggestions, qmsDocuments: mergedQms };
  } catch (e) {
    console.error('Doctrine section suggestions error:', e);
    return { suggestions: [], qmsDocuments };
  }
}
