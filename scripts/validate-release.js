const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

function validateRelease(root = path.resolve(__dirname, '..')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const output = path.join(root, pkg.build.directories.output);
  const info = yaml.load(fs.readFileSync(path.join(output, 'latest.yml'), 'utf8'));
  if (info.version !== pkg.version) throw new Error('latest.yml version differs from package.json');
  if (!Array.isArray(info.files) || !info.files.length) throw new Error('latest.yml contains no artifacts');
  for (const file of info.files) {
    const name = decodeURIComponent(file.url);
    if (path.basename(name) !== name || !name.endsWith('.exe') || !name.includes(pkg.version)) throw new Error('Unexpected installer name in latest.yml');
    const bytes = fs.readFileSync(path.join(output, name));
    const hash = crypto.createHash('sha512').update(bytes).digest('base64');
    if (hash !== file.sha512 || bytes.length !== file.size) throw new Error('Installer checksum or size differs from latest.yml');
    if (!fs.statSync(path.join(output, `${name}.blockmap`)).size) throw new Error('Missing installer blockmap');
    if (info.path === file.url && info.sha512 !== hash) throw new Error('Legacy metadata checksum differs from installer');
  }
  const resources = path.join(output, 'win-unpacked', 'resources');
  const config = yaml.load(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
  for (const key of ['provider', 'owner', 'repo']) if (config[key] !== pkg.build.publish[key]) throw new Error(`Packaged update ${key} differs from release configuration`);
  if (config.token || config.private) throw new Error('Client update configuration must be public and token-free');
  const asar = require('@electron/asar');
  const archive = path.join(resources, 'app.asar');
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json').toString());
  if (packaged.version !== info.version) throw new Error('Packaged application version differs from installer metadata');
  console.log(`Validated KUMAKH ${pkg.version}: installer, SHA-512, size, blockmap, latest.yml and packaged feed.`);
  return info;
}
if (require.main === module) {
  try { validateRelease(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateRelease };
