const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

async function verifyGithubRelease(root = path.resolve(__dirname, '..')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const releaseUrl = `https://api.github.com/repos/${pkg.build.publish.owner}/${pkg.build.publish.repo}/releases/latest`;
  const releaseResponse = await fetch(releaseUrl, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'kumakh-release-verifier' } });
  if (!releaseResponse.ok) throw new Error(`GitHub release lookup failed: HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.json();
  if (release.tag_name !== `v${pkg.version}`) throw new Error(`Latest GitHub release is ${release.tag_name}, expected v${pkg.version}`);
  const assets = new Map(release.assets.map(asset => [asset.name, asset]));
  const output = path.join(root, pkg.build.directories.output);
  const metadata = yaml.load(fs.readFileSync(path.join(output, 'latest.yml'), 'utf8'));
  const expected = [`KCMT-Setup-${pkg.version}.exe`, `KCMT-Setup-${pkg.version}.exe.blockmap`, 'latest.yml'];
  for (const name of expected) if (!assets.has(name)) throw new Error(`GitHub release is missing ${name}`);
  const installer = metadata.files[0];
  if (installer.url !== expected[0]) throw new Error(`latest.yml points to ${installer.url}, expected ${expected[0]}`);
  const bytes = fs.readFileSync(path.join(output, installer.url));
  const hash = crypto.createHash('sha512').update(bytes).digest('base64');
  if (hash !== installer.sha512 || bytes.length !== installer.size) throw new Error('Local installer does not match latest.yml');
  if (assets.get(expected[0]).size !== bytes.length) throw new Error('GitHub installer size differs from local build');
  console.log(`Verified GitHub release v${pkg.version}: ${expected.join(', ')}`);
}

if (require.main === module) verifyGithubRelease().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { verifyGithubRelease };
