const { spawnSync } = require('child_process');
const path = require('path');
const { validateRelease } = require('./validate-release');

function buildWindows(publish = false, root = path.resolve(__dirname, '..')) {
  if (process.platform !== 'win32') throw new Error('Build Windows releases on the Windows development PC.');
  // Never allow a local/CI environment to implicitly turn an ordinary build into a release.
  const env = { ...process.env };
  delete env.DEBUG;
  if (!publish) for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'GITHUB_RELEASE_TOKEN']) delete env[name];
  const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--win', '--publish', publish ? 'always' : 'never'], { cwd: root, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Windows build failed. Version is retained; fix the failure before retrying.');
  validateRelease(root);
}
if (require.main === module) {
  try { buildWindows(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { buildWindows };
