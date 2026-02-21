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

  const userPrompt = `You are writing assessor-ready, audit-grade policy statements for a Federal Contract Governance & Risk Management Manual.

CRITICAL: Generate content ONLY for this exact section. Do not generate content for any other section.

Target section ONLY: ${sectionId}
${context.existingContent ? `Existing content for this section (build on or replace):\n${context.existingContent}\n` : ''}
${qmsHint}

Provide exactly 1 or 2 IN-DEPTH, COMPREHENSIVE policy statements. Each statement must:
- Cover ONLY the topic of this section (${context.sectionTitle}) — nothing else
- Be written as formal, third-person policy text (e.g., "MacTech shall...", "All contracts must...")
- Be suitable for direct insertion into a controlled document and audit review
- Be comprehensive: a full paragraph or more per suggestion, not a single sentence
- Include implementation guidance (e.g., "Implement via MAC-FRM-XXX") where procedures/forms apply

Return a JSON object with:
- "suggestions": array of 1–2 strings — each string is ONE comprehensive assessor-ready policy statement (full paragraph with implementation refs if applicable). Use Markdown (bold for key terms).
- "qmsDocuments": array of strings — QMS/FRM forms required for this section only

Output ONLY content for section ${context.sectionNumber || context.sectionTitle}. Do not suggest content for other sections.`;

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You write assessor-ready, audit-grade policy statements — formal declarative language for controlled documents. Never output "include X" or "consider Y" prompts. Output the actual policy text and implementation references. Output only valid JSON with "suggestions" (assessor-ready statements) and "qmsDocuments" arrays.' },
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
