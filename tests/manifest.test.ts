import { createHash, createPublicKey } from 'node:crypto';
import manifest from '../public/manifest.json';

test('manifest asks for exactly the agreed access', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage', 'sidePanel']);
  expect(manifest.minimum_chrome_version).toBe('116');
  for (const key of ['host_permissions', 'optional_permissions', 'optional_host_permissions',
    'content_scripts', 'web_accessible_resources', 'externally_connectable']) {
    expect(manifest).not.toHaveProperty(key);
  }
});

test('extension pages cannot send data anywhere or load remote code', () => {
  const policy = manifest.content_security_policy.extension_pages;
  for (const rule of ["default-src 'self'", "script-src 'self'", "connect-src 'none'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"]) {
    expect(policy.split('; ')).toContain(rule);
  }
});

// Chrome derives the extension id from this key. Saved listings belong to the id, so changing the
// key would hide everything saved. Only the public half exists; no private key is kept anywhere.
test('a fixed public key keeps the extension id, and the saved listings, across folders', () => {
  const der = Buffer.from(manifest.key, 'base64');
  expect(createPublicKey({ key: der, format: 'der', type: 'spki' }).asymmetricKeyType).toBe('rsa');
  const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
    .map((digit) => String.fromCharCode(97 + parseInt(digit, 16)))
    .join('');
  expect(id).toBe('lnlcddeibdpccfdocfclbpclhacleoph');
});
