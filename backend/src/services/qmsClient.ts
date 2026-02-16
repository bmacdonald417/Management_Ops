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
