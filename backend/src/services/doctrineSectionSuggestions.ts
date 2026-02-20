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

  const userPrompt = `You are writing assessor-ready, audit-grade policy statements for a Federal Contract Governance & Risk Management Manual. Output must be formal, declarative language suitable for CMMC, DCAA, or contractual compliance review.

Doctrine title: ${context.doctrineTitle}
Section ${context.sectionNumber || ''}: ${context.sectionTitle}
${context.existingContent ? `Existing content for this section:\n${context.existingContent}\n` : ''}
${doctrineContext}
${qmsHint}

Provide 2–4 ASSESSOR-READY POLICY STATEMENTS. Each statement must be:
- Written as formal, third-person policy text (e.g., "MacTech shall...", "All contracts must...") — NOT instructions like "include X" or "consider adding Y"
- Suitable for direct insertion into a controlled document and audit review
- Specific to federal contracting (FAR/DFARS), risk management, and MacTech governance
- Concise but complete; avoid filler or generic boilerplate

Then, for each statement, if implementation requires procedures or forms: add IMPLEMENTATION GUIDANCE — e.g., "Implement via MAC-FRM-013 Clause Risk Log" or "Establish written procedure documenting [specific control]."

Return a JSON object with:
- "suggestions": array of strings — each string is ONE assessor-ready policy statement (optionally followed by implementation guidance in a second paragraph or bullet). Use Markdown (bold for key terms) where helpful.
- "qmsDocuments": array of strings — QMS/FRM forms or appendix documents required to implement (e.g., "MAC-FRM-013 Clause Risk Log", "MAC-SOP-008 Document Control Procedure")

Do NOT output generic prompts or "what to include" guidance. Output the actual policy text and implementation references.`;

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You write assessor-ready, audit-grade policy statements — formal declarative language for controlled documents. Never output "include X" or "consider Y" prompts. Output the actual policy text and implementation references. Output only valid JSON with "suggestions" (assessor-ready statements) and "qmsDocuments" arrays.' },
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
