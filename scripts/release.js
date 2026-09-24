const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildWindows } = require('./build-win');

function preflight(pkg, lock, env, platform = process.platform) {
  if (platform !== 'win32') throw new Error('Release publishing requires Windows.');
  const feed = pkg.build.publish;
  if (feed?.provider !== 'github' || !feed.owner || /YOUR_|PLACEHOLDER/i.test(feed.owner) || !feed.repo || feed.releaseType !== 'release' || feed.private || feed.token) throw new Error('Set build.publish.owner to your GitHub account; use a public release repository and releaseType: release.');
  if (!(env.GH_TOKEN || env.GITHUB_TOKEN)) throw new Error('Set GH_TOKEN (or GITHUB_TOKEN) in this terminal session before releasing.');
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version) || lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) throw new Error('package.json and package-lock.json must have the same stable version.');
  return true;
}
function release(kind, root = path.resolve(__dirname, '..')) {
  if (!['patch', 'minor', 'major', 'publish'].includes(kind)) throw new Error('Choose patch, minor, major or publish.');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
  preflight(pkg, lock, process.env);
  const lockFile = path.join(root, '.release.lock');
  const handle = fs.openSync(lockFile, 'wx');
  try {
    fs.writeFileSync(handle, `pid=${process.pid}\n`);
    if (kind !== 'publish') {
      if (!process.env.npm_execpath) throw new Error('Run releases through npm run release:patch/minor/major.');
      const bumped = spawnSync(process.execPath, [process.env.npm_execpath, 'version', kind, '--no-git-tag-version', '--ignore-scripts'], { cwd: root, stdio: 'inherit' });
      if (bumped.error || bumped.status !== 0) throw new Error('Version bump failed; inspect package files before retrying.');
    }
    buildWindows(true, root);
    console.log('Release published. Confirm all three assets are visible on the public GitHub release.');
  } finally { fs.closeSync(handle); fs.unlinkSync(lockFile); }
}
if (require.main === module) {
  try { release(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { preflight, release };
