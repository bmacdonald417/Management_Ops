#!/usr/bin/env npx tsx
/**
 * Generate Ed25519 key pair for GOV_ED25519_PRIVATE_KEY.
 * Add the output to .env:
 *   GOV_ED25519_PRIVATE_KEY=<private key>
 *   GOV_ED25519_PUBLIC_KEY_ID=gov-1
 */
import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

console.log('Add to .env:\n');
console.log('GOV_ED25519_PRIVATE_KEY=' + privateKey.replace(/\n/g, '\\n'));
console.log('GOV_ED25519_PUBLIC_KEY_ID=gov-1');
console.log('\n--- Public key (for QMS verification) ---');
console.log(publicKey);
