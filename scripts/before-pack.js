const path = require('path');
const { generateTursoConfig } = require('./generate-turso-config');
const { prepareNativeRuntime } = require('./prepare-native-runtime');

module.exports = async function beforePack(context) {
  const root = context.packager.projectDir || path.resolve(__dirname, '..');
  try {
    generateTursoConfig(root, process.env);
    if (context.electronPlatformName === 'win32') prepareNativeRuntime(root, process.env);
  } catch (error) {
    require('fs').rmSync(path.join(root, 'build', 'turso-config.env'), { force: true });
    require('fs').rmSync(path.join(root, 'build', 'native-runtime', 'vcruntime140.dll'), { force: true });
    throw error;
  }
};
