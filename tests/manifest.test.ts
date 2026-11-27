import { createHash, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../public/manifest.json';

test('manifest asks for exactly the agreed access', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage', 'sidePanel']);
  expect(manifest.minimum_chrome_version).toBe('116');
  for (const key of [
    'host_permissions',
    'optional_permissions',
    'content_scripts',
    'web_accessible_resources',
    'externally_connectable',
  ]) {
    expect(manifest).not.toHaveProperty(key);
  }
});

test('extension pages cannot send data anywhere or load remote code', () => {
  const policy = manifest.content_security_policy.extension_pages;
  for (const rule of [
    "default-src 'self'",
    "script-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ]) {
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

// Granted only if the owner turns automatic reading on, and for this one site only.
test('the only optional access is sahibinden.com over https', () => {
  expect(manifest.optional_host_permissions).toEqual(['https://*.sahibinden.com/*']);
});

test.each(['16', '32', '48', '128'])('the %s px icon exists and has that size', (size) => {
  const path = manifest.icons[size as keyof typeof manifest.icons];
  expect(manifest.action.default_icon[size as keyof typeof manifest.icons]).toBe(path);
  const png = readFileSync(join(__dirname, '../public', path));
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  // Width and height sit at fixed positions in the PNG header.
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([Number(size), Number(size)]);
});
