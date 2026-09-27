const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { peMachine } = require('../scripts/prepare-native-runtime');

test('Windows native binding staging validates PE format and architecture', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-pe-test-'));
  const file = path.join(directory, 'binding.dll');
  const image = Buffer.alloc(256);
  image.write('MZ', 0, 'ascii');
  image.writeUInt32LE(0x80, 0x3c);
  image.write('PE\0\0', 0x80, 'binary');
  image.writeUInt16LE(0x8664, 0x84);
  fs.writeFileSync(file, image);
  try {
    assert.equal(peMachine(file), 0x8664);
    image.writeUInt16LE(0x14c, 0x84);
    fs.writeFileSync(file, image);
    assert.equal(peMachine(file), 0x14c);
    image.write('NOPE', 0x80, 'ascii');
    fs.writeFileSync(file, image);
    assert.throws(() => peMachine(file), /PE signature/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('production package pins Windows Turso binding and bundles its required VC runtime', () => {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['@tursodatabase/sync-win32-x64-msvc'], '0.7.2');
  assert.equal(pkg.scripts['verify:release'], 'node scripts/verify-release.js');
  assert.ok(pkg.build.asarUnpack.some(rule => rule.includes('@tursodatabase') && rule.endsWith('.node')));
  assert.ok(pkg.build.extraResources.some(resource =>
    resource.from === 'build/native-runtime/vcruntime140.dll'
    && resource.to.endsWith('/vcruntime140.dll'),
  ));
  assert.match(
    fs.readFileSync(path.join(root, 'scripts', 'verify-package.js'), 'utf8'),
    /verify-native-runtime\.js/,
  );
});
