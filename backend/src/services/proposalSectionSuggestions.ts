/**
 * Copilot: proposal section content suggestions via LLM.
 * Used by Proposal detail UI when user requests "Get Copilot Suggestions".
 */
import { getOpenAIClient, getOpenAIModel } from '../lib/openaiClient.js';
import { query } from '../db/connection.js';

export interface ProposalSectionSuggestionsContext {
  solicitationDetails: string;
  sectionTitle: string;
  existingContent?: string;
  qmsDoctrineSections?: string[];
}

/**
 * Returns an array of suggested content snippets for a proposal section.
 */
export async function getProposalSectionSuggestions(context: ProposalSectionSuggestionsContext): Promise<string[]> {
  const client = getOpenAIClient();
  if (!client) return [];

  const doctrine = (context.qmsDoctrineSections && context.qmsDoctrineSections.length > 0)
    ? `\nGovernance / doctrine excerpts to align with:\n${context.qmsDoctrineSections.slice(0, 3).join('\n\n')}`
    : '';

  const userPrompt = `You are helping write a contract proposal section.

Solicitation/opportunity context:
${context.solicitationDetails}

Section title: ${context.sectionTitle}
${context.existingContent ? `Existing draft:\n${context.existingContent}\n` : ''}
${doctrine}

Provide 2–3 short, concrete content suggestions (paragraphs or bullet points) that could be used for this section. Return a JSON object with a single key "suggestions" whose value is an array of strings. Each string is one suggestion (a paragraph or a short bullet list). Be specific to the section title and context.`;

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You are a federal contract and proposal writing assistant. Output only valid JSON with a "suggestions" array of strings.' },
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
    console.error('Proposal section suggestions error:', e);
    return [];
  }
}

/**
 * Load solicitation summary for a proposal (for context in suggestions).
 */
export async function getSolicitationDetailsForProposal(proposalId: string): Promise<string> {
  const r = (await query(
    `SELECT p.solicitation_id, s.title, s.solicitation_number, s.agency, s.contract_type, s.anticipated_value
     FROM proposals p LEFT JOIN solicitations s ON p.solicitation_id = s.id WHERE p.id = $1`,
    [proposalId]
  )).rows[0] as { solicitation_id: string | null; title: string; solicitation_number: string; agency: string; contract_type: string; anticipated_value: unknown } | undefined;
  if (!r || !r.solicitation_id) return 'No linked solicitation.';
  const parts: string[] = [];
  if (r.solicitation_number) parts.push(`Solicitation: ${r.solicitation_number}`);
  if (r.title) parts.push(`Title: ${r.title}`);
  if (r.agency) parts.push(`Agency: ${r.agency}`);
  if (r.contract_type) parts.push(`Contract type: ${r.contract_type}`);
  if (r.anticipated_value != null) parts.push(`Anticipated value: ${r.anticipated_value}`);
  return parts.join('. ');
}
