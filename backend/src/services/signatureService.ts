/**
 * Cryptographic approval signing (Ed25519).
 * Canonical payload + signature for QMS verification.
 */
import crypto from 'crypto';

const GOV_ED25519_PRIVATE_KEY = process.env.GOV_ED25519_PRIVATE_KEY ?? '';
const GOV_ED25519_PUBLIC_KEY_ID = process.env.GOV_ED25519_PUBLIC_KEY_ID ?? 'gov-1';

export interface CanonicalPayload {
  qmsHash: string;
  recordType: string;
  recordId: string;
  recordVersion: number;
  approvalType: string;
  signedAt: string;
  signedBy: string;
  controlTags: string[];
}

/**
 * Build canonical JSON (sorted keys, ISO8601 UTC).
 * Control tags sorted.
 */
export function buildCanonicalPayload(params: {
  qmsHash: string;
  recordType: string;
  recordId: string;
  recordVersion: number;
  approvalType: string;
  signedAt: Date;
  signedBy: string;
  controlTags?: string[];
}): { payload: CanonicalPayload; canonical: string } {
  const signedAt = params.signedAt.toISOString();
  const controlTags = [...(params.controlTags ?? [])].sort();
  const payload: CanonicalPayload = {
    qmsHash: params.qmsHash,
    recordType: params.recordType,
    recordId: params.recordId,
    recordVersion: params.recordVersion,
    approvalType: params.approvalType,
    signedAt,
    signedBy: params.signedBy,
    controlTags
  };
  const canonical = JSON.stringify(payload);
  return { payload, canonical };
}

/**
 * Sign canonical string with Ed25519.
 * Uses crypto.sign() (not createSign) per Node.js Ed25519 requirements.
 */
export function signCanonical(canonical: string): { signatureBase64: string; publicKeyId: string } | null {
  if (!GOV_ED25519_PRIVATE_KEY) return null;
  try {
    const keyForm = GOV_ED25519_PRIVATE_KEY.includes('-----')
      ? GOV_ED25519_PRIVATE_KEY
      : `-----BEGIN PRIVATE KEY-----\n${GOV_ED25519_PRIVATE_KEY}\n-----END PRIVATE KEY-----`;
    const privateKey = crypto.createPrivateKey(keyForm);
    const sig = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKey);
    return {
      signatureBase64: sig.toString('base64'),
      publicKeyId: GOV_ED25519_PUBLIC_KEY_ID
    };
  } catch {
    return null;
  }
}

/**
 * Verify Ed25519 signature (for tests).
 */
export function verifySignature(canonical: string, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    const keyForm = publicKeyPem.includes('-----')
      ? publicKeyPem
      : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`;
    const publicKey = crypto.createPublicKey(keyForm);
    return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKey, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}

export function isSigningConfigured(): boolean {
  return !!GOV_ED25519_PRIVATE_KEY;
}
