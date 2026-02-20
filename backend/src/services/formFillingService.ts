/**
 * Form Filling Service (Phase 4).
 * Fills QMS form templates with proposal-specific data and returns a completed document buffer.
 * - JSON: Renders form data as HTML or structured JSON (no extra deps).
 * - DOCX/PDF: Require optional deps (docxtemplater, pdf-lib); throws if not available.
 */

export type TemplateType = 'docx' | 'pdf' | 'json';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formDataToHtml(formData: Record<string, unknown>): string {
  const rows: string[] = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Completed Form</title></head><body>',
    '<table border="1" cellpadding="8" style="border-collapse:collapse;">',
    '<tbody>'
  ];
  for (const [k, v] of Object.entries(formData)) {
    const val = v == null ? '' : String(v);
    rows.push(`<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(val)}</td></tr>`);
  }
  rows.push('</tbody></table></body></html>');
  return rows.join('\n');
}

/**
 * Fill a form template with data and return the completed document as a Buffer.
 * - json: Returns HTML or JSON buffer (no optional deps).
 * - docx: Requires docxtemplater + pizzip; throws if not installed.
 * - pdf: Requires pdf-lib (or similar); throws if not installed.
 */
export async function fillForm(
  templateBuffer: Buffer,
  templateType: TemplateType,
  formData: Record<string, unknown>
): Promise<Buffer> {
  if (templateType === 'json') {
    const html = formDataToHtml(formData);
    return Buffer.from(html, 'utf-8');
  }

  if (templateType === 'docx') {
    throw new Error(
      'DOCX form filling requires optional deps: npm install docxtemplater pizzip. Use a JSON form template until then.'
    );
  }

  if (templateType === 'pdf') {
    throw new Error(
      'PDF form filling requires optional dep: npm install pdf-lib. Use a JSON form template until then.'
    );
  }

  throw new Error(`Unsupported template type: ${templateType}`);
}
