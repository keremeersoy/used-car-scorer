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
