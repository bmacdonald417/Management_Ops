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

  const qmsHint = qmsDocuments.length > 0
    ? `\nQMS/FRM documents for this section: ${qmsDocuments.join(', ')}`
    : '';

  const sectionId = [context.sectionNumber, context.sectionTitle].filter(Boolean).join(' ');

  const userPrompt = `You are writing document-ready, audit-passable policy text for insertion into a controlled Federal Contract Governance & Risk Management Manual. Output is the actual text to be published — not suggestions, descriptions, or meta-instructions.

CRITICAL: Generate content ONLY for this exact section. Do not generate content for any other section.

Target section ONLY: ${sectionId}
${context.existingContent ? `Existing content for this section (build on or replace):\n${context.existingContent}\n` : ''}
${qmsHint}

LANGUAGE RULES:
- Use "this Manual" or "this document" — never "the Federal Contracting Governance & Risk Management Manual" or "the document"
- Write as formal, third-person policy text (e.g., "MacTech shall...", "All contracts must...")
- Output rich, audit-friendly verbiage suitable for direct insertion — no hedging, no "should consider," no meta-commentary
- Each output must be a full paragraph or more of publication-ready text

STRUCTURE: Provide exactly 1 or 2 paragraphs. Each paragraph MUST end with a sentence listing recommended controlled documents, e.g.:
"Reference: MAC-FRM-XXX [Title], MAC-SOP-YYY [Title]."
The user may delete the reference sentence later; include it so the text is audit-complete.

Return a JSON object with:
- "suggestions": array of 1–2 strings — each string is document-ready policy text (full paragraph ending with "Reference: [controlled docs]"). Use Markdown (bold for key terms).
- "qmsDocuments": array of strings — QMS/FRM forms for this section

Output ONLY content for section ${context.sectionNumber || context.sectionTitle}.`;

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You write document-ready, audit-passable policy text for controlled manuals. Use "this Manual" or "this document" — never "the document." Output publication-ready text, not suggestions. Each paragraph must end with "Reference: [controlled docs]." Output only valid JSON with "suggestions" and "qmsDocuments" arrays.' },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 3072
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { suggestions?: string[]; qmsDocuments?: string[] };
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 2) : [];
    const aiQms = Array.isArray(parsed.qmsDocuments) ? parsed.qmsDocuments.filter((s): s is string => typeof s === 'string').slice(0, 10) : [];
    const mergedQms = [...new Set([...qmsDocuments, ...aiQms])];
    return { suggestions, qmsDocuments: mergedQms };
  } catch (e) {
    console.error('Doctrine section suggestions error:', e);
    return { suggestions: [], qmsDocuments };
  }
}
