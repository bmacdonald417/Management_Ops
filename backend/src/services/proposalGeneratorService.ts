/**
 * Proposal & Governance Automation: generate a single document from proposal sections and form data.
 * Output: HTML (buffer). Can be extended to DOCX/PDF via docxtemplater or pdf-lib later.
 */
import { query } from '../db/connection.js';

export interface ProposalForGenerate {
  id: string;
  title: string;
  status: string;
  proposal_type: string;
  submission_deadline: string | null;
  solicitation_id: string | null;
}

export interface ProposalSectionRow {
  id: string;
  title: string;
  content: string | null;
  order: number;
}

export interface ProposalFormRow {
  id: string;
  form_name: string;
  form_data: Record<string, unknown>;
  status: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '<p></p>';
  let html = escapeHtml(md);
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');
  html = html.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return `<p>${html}</p>`;
}

function formDataToHtml(form: ProposalFormRow): string {
  const rows: string[] = [`<h4>${escapeHtml(form.form_name)}</h4>`, '<table class="form-data"><tbody>'];
  const data = form.form_data && typeof form.form_data === 'object' ? form.form_data as Record<string, unknown> : {};
  for (const [k, v] of Object.entries(data)) {
    const val = v == null ? '' : String(v);
    rows.push(`<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(val)}</td></tr>`);
  }
  rows.push('</tbody></table>');
  return rows.join('\n');
}

/**
 * Fetch proposal with sections and forms for generation.
 */
export async function getProposalForGenerate(proposalId: string): Promise<{
  proposal: ProposalForGenerate;
  sections: ProposalSectionRow[];
  forms: ProposalFormRow[];
} | null> {
  const prop = (await query(
    `SELECT id, title, status, proposal_type, submission_deadline, solicitation_id FROM proposals WHERE id = $1`,
    [proposalId]
  )).rows[0] as ProposalForGenerate | undefined;
  if (!prop) return null;

  const sections = (await query(
    `SELECT id, title, content, "order" FROM proposal_sections WHERE proposal_id = $1 ORDER BY "order" ASC, created_at ASC`,
    [proposalId]
  )).rows as ProposalSectionRow[];

  const forms = (await query(
    `SELECT id, form_name, form_data, status FROM proposal_forms WHERE proposal_id = $1 ORDER BY created_at ASC`,
    [proposalId]
  )).rows as ProposalFormRow[];

  return { proposal: prop, sections, forms };
}

/**
 * Generate proposal document as HTML buffer.
 * Format: title, deadline, then sections (title + content), then forms (form_name + form_data table).
 */
export async function generateProposalDocument(proposalId: string): Promise<Buffer> {
  const data = await getProposalForGenerate(proposalId);
  if (!data) throw new Error('Proposal not found');

  const { proposal, sections, forms } = data;
  const deadline = proposal.submission_deadline
    ? new Date(proposal.submission_deadline).toLocaleDateString('en-US', { dateStyle: 'long' })
    : '';

  const parts: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="UTF-8"/><title>' + escapeHtml(proposal.title) + '</title>',
    '<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2em auto;padding:0 1em;} h1,h2,h3,h4{color:#1e3a5f;} table.form-data{border-collapse:collapse;width:100%;} .form-data td,.form-data th{border:1px solid #ccc;padding:6px 10px;text-align:left;} .form-data th{background:#f5f5f5;}</style>',
    '</head><body>',
    '<h1>' + escapeHtml(proposal.title) + '</h1>',
    '<p><strong>Type:</strong> ' + escapeHtml(proposal.proposal_type) + ' &nbsp; <strong>Status:</strong> ' + escapeHtml(proposal.status) + '</p>'
  ];
  if (deadline) parts.push('<p><strong>Submission deadline:</strong> ' + escapeHtml(deadline) + '</p>');
  parts.push('<hr/>');

  for (const sec of sections) {
    parts.push('<h2>' + escapeHtml(sec.title) + '</h2>');
    parts.push(sec.content ? markdownToHtml(sec.content) : '<p></p>');
  }

  if (forms.length > 0) {
    parts.push('<h2>Forms</h2>');
    for (const form of forms) {
      parts.push(formDataToHtml(form));
    }
  }

  parts.push('</body></html>');
  const html = parts.join('\n');
  return Buffer.from(html, 'utf-8');
}
