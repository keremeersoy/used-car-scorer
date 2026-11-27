// The repository is public: nothing personal, secret or taken from a real listing may be in it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findLeaks } from './privacy';

const root = join(__dirname, '..');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

// Samples are assembled from pieces so this file does not trip its own check.
test.each([
  ['a mobile number', ['0532', '123', '45', '67'].join(' ')],
  ['a mobile number with a country code', ['+90', '5321234567'].join('')],
  ['a personal email', ['someone', 'gmail.com'].join('@')],
  ['a home folder path', ['/Users', 'someone', 'project'].join('/')],
  ['a private key', ['-----BEGIN', 'PRIVATE KEY-----'].join(' ')],
  ['a GitHub token', ['ghp', 'a'.repeat(36)].join('_')],
])('detects %s', (_, sample) => {
  expect(findLeaks(`text ${sample} text`)).toHaveLength(1);
});

test.each([
  'sahibinden.com@evil.com',
  'noreply@anthropic.com',
  '89894884+someone@users.noreply.github.com',
  '1.250.000 TL, 199.000 km, 2017',
])('allows %j', (sample) => {
  expect(findLeaks(sample)).toEqual([]);
});

test('no tracked file leaks anything', () => {
  const leaks = tracked
    .filter((file) => !file.endsWith('.png'))
    .flatMap((file) =>
      findLeaks(readFileSync(join(root, file), 'utf8')).map((leak) => `${file}: ${leak}`),
    );
  expect(leaks).toEqual([]);
});

test('saved listing pages and local work files are never tracked', () => {
  const forbidden =
    /^(fixtures|\.superpowers|dist|node_modules)\/|\.(mhtml|pem|key|env)$|sahibinden.*\.html$|\.expected\.json$/;
  expect(tracked.filter((file) => forbidden.test(file))).toEqual([]);
});
