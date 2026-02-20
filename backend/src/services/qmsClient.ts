/**
 * QMS (Quality Management System) API client.
 * Persists clause assessment forms as DRAFT/FINAL FormRecords.
 */

const QMS_BASE_URL = process.env.QMS_BASE_URL ?? '';
const QMS_INTEGRATION_KEY = process.env.QMS_INTEGRATION_KEY ?? '';

function getAuthHeader(): Record<string, string> {
  const key = QMS_INTEGRATION_KEY;
  if (key) return { 'X-INTEGRATION-KEY': key };
  return {};
}

async function qmsFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${QMS_BASE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers as Record<string, string>)
  };
  return fetch(url, { ...options, headers });
}

export interface QmsFormRecordPayload {
  templateCode: string;
  status: 'DRAFT' | 'FINAL';
  relatedEntityType?: string;
  relatedEntityId?: string;
  payload?: Record<string, unknown>;
}

export interface QmsFormRecord {
  id: string;
  templateCode: string;
  status: string;
  recordNumber?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  payload?: Record<string, unknown>;
  pdfUrl?: string;
}

export async function qmsCreateFormRecord(payload: QmsFormRecordPayload): Promise<QmsFormRecord | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const res = await qmsFetch('/api/form-records', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`QMS create failed: ${res.status}`);
    return (await res.json()) as QmsFormRecord;
  } catch (e) {
    console.error('QMS create error:', e);
    return null;
  }
}

export async function qmsUpdateFormRecord(id: string, payload: Partial<QmsFormRecordPayload>): Promise<QmsFormRecord | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const res = await qmsFetch(`/api/form-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`QMS update failed: ${res.status}`);
    return (await res.json()) as QmsFormRecord;
  } catch (e) {
    console.error('QMS update error:', e);
    return null;
  }
}

export interface QmsFinalizePayload {
  approvalTrail?: Array<{ step: string; actor: string; role?: string; timestamp: string; decision: string }>;
  pdfBase64?: string;
  payload?: Record<string, unknown>;
}

export async function qmsFinalizeFormRecord(id: string, payload: QmsFinalizePayload): Promise<QmsFormRecord | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const res = await qmsFetch(`/api/form-records/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`QMS finalize failed: ${res.status}`);
    return (await res.json()) as QmsFormRecord;
  } catch (e) {
    console.error('QMS finalize error:', e);
    return null;
  }
}

export interface QmsFormRecordFilters {
  templateCode?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function qmsListFormRecords(filters: QmsFormRecordFilters = {}): Promise<QmsFormRecord[]> {
  if (!QMS_BASE_URL) return [];
  try {
    const params = new URLSearchParams();
    if (filters.templateCode) params.set('templateCode', filters.templateCode);
    if (filters.relatedEntityType) params.set('relatedEntityType', filters.relatedEntityType);
    if (filters.relatedEntityId) params.set('relatedEntityId', filters.relatedEntityId);
    const qs = params.toString();
    const res = await qmsFetch(`/api/form-records${qs ? `?${qs}` : ''}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { records?: QmsFormRecord[]; items?: QmsFormRecord[] };
    return data.records ?? data.items ?? (Array.isArray(data) ? data : []);
  } catch (e) {
    console.error('QMS list error:', e);
    return [];
  }
}

export async function qmsGetFormRecord(id: string): Promise<QmsFormRecord | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const res = await qmsFetch(`/api/form-records/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as QmsFormRecord;
  } catch (e) {
    console.error('QMS get error:', e);
    return null;
  }
}

export function isQmsConfigured(): boolean {
  return !!(QMS_BASE_URL && QMS_INTEGRATION_KEY);
}

// --- Phase 4: Form templates & completed form repository ---

export interface FormTemplateResult {
  templateBuffer: Buffer;
  templateType: 'docx' | 'pdf' | 'json';
  schema?: unknown;
}

/**
 * Fetch a form template from QMS: GET /api/documents/:id/template.
 * Response: JSON with id, documentId, title, documentType, versionMajor, versionMinor, content, status.
 * Requires document:view. Returns template as JSON (templateType: 'json', schema from content).
 */
export async function qmsGetFormTemplate(qmsDocumentId: string): Promise<FormTemplateResult | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const res = await qmsFetch(`/api/documents/${encodeURIComponent(qmsDocumentId)}/template`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`QMS get template failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      id?: string;
      documentId?: string;
      title?: string;
      documentType?: string;
      versionMajor?: number;
      versionMinor?: number;
      content?: unknown;
      status?: string;
    };
    const schema = body.content ?? body;
    const templateBuffer = Buffer.from(JSON.stringify(body), 'utf-8');
    return { templateBuffer, templateType: 'json', schema };
  } catch (e) {
    console.error('QMS getFormTemplate error:', e);
    return null;
  }
}

export interface UploadCompletedFormMetadata {
  originalQMSDocumentId: string;
  proposalId: string;
  formName: string;
  fileName: string;
  mimeType: string;
}

export interface UploadCompletedFormResult {
  qmsDocumentId: string;
  status: string;
  downloadUrl: string;
}

/**
 * Upload a completed form to QMS (e.g. POST /api/documents/completed-forms).
 */
export async function qmsUploadCompletedForm(
  formBuffer: Buffer,
  metadata: UploadCompletedFormMetadata
): Promise<UploadCompletedFormResult | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(formBuffer)]), metadata.fileName);
    formData.append('originalQMSDocumentId', metadata.originalQMSDocumentId);
    formData.append('proposalId', metadata.proposalId);
    formData.append('formName', metadata.formName);

    const headers: Record<string, string> = { ...getAuthHeader() };
    delete (headers as Record<string, unknown>)['Content-Type'];

    const res = await fetch(`${QMS_BASE_URL.replace(/\/$/, '')}/api/documents/completed-forms`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) throw new Error(`QMS upload completed form failed: ${res.status}`);
    const data = (await res.json()) as UploadCompletedFormResult;
    return data;
  } catch (e) {
    console.error('QMS uploadCompletedForm error:', e);
    return null;
  }
}

/**
 * Download a document from QMS: GET /api/documents/:id/download.
 * QMS redirects (302) to GET /api/documents/:id/pdf?mode=download; fetch follows redirect and returns PDF buffer.
 */
export async function qmsDownloadDocument(qmsDocumentId: string): Promise<Buffer | null> {
  if (!QMS_BASE_URL) return null;
  try {
    const res = await qmsFetch(`/api/documents/${encodeURIComponent(qmsDocumentId)}/download`, { redirect: 'follow' });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`QMS download failed: ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error('QMS downloadDocument error:', e);
    return null;
  }
}

/** List form templates: GET /api/documents?type=form-template (documentType: FORM, status: EFFECTIVE). Response: { documents } ordered by documentId and version. */
export async function qmsListFormTemplates(): Promise<Array<{ id: string; name: string; templateCode?: string }>> {
  if (!QMS_BASE_URL) return [];
  try {
    const res = await qmsFetch('/api/documents?type=form-template');
    if (!res.ok) return [];
    const data = (await res.json()) as {
      documents?: Array<{ id?: string; documentId?: string; title?: string; name?: string; templateCode?: string }>;
    };
    const list = data.documents ?? [];
    return list.slice(0, 200).map((doc) => ({
      id: doc.documentId ?? doc.id ?? '',
      name: doc.title ?? doc.name ?? doc.documentId ?? doc.id ?? 'Untitled',
      templateCode: doc.templateCode
    })).filter((t) => t.id);
  } catch (e) {
    console.error('QMS listFormTemplates error:', e);
    return [];
  }
}

/** List completed form records: GET /api/documents/completed-forms. Uses document:view. Query: limit (default 50, max 200), offset (default 0), optional status, templateCode. Response: { records, total }. */
export interface QmsCompletedFormRecord {
  id: string;
  templateDocument?: { documentId?: string; title?: string };
  createdBy?: unknown;
  [key: string]: unknown;
}

export async function qmsListCompletedForms(options: {
  limit?: number;
  offset?: number;
  status?: string;
  templateCode?: string;
} = {}): Promise<{ records: QmsCompletedFormRecord[]; total: number }> {
  if (!QMS_BASE_URL) return { records: [], total: 0 };
  try {
    const params = new URLSearchParams();
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    params.set('limit', String(limit));
    params.set('offset', String(options.offset ?? 0));
    if (options.status) params.set('status', options.status);
    if (options.templateCode) params.set('templateCode', options.templateCode);
    const res = await qmsFetch(`/api/documents/completed-forms?${params.toString()}`);
    if (!res.ok) return { records: [], total: 0 };
    const data = (await res.json()) as { records?: QmsCompletedFormRecord[]; total?: number };
    return {
      records: data.records ?? [],
      total: data.total ?? (data.records?.length ?? 0)
    };
  } catch (e) {
    console.error('QMS listCompletedForms error:', e);
    return { records: [], total: 0 };
  }
}
