const fs = require('fs');
const path = require('path');

function peMachine(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error(`Invalid Windows runtime binary: ${file}`);
  const peOffset = bytes.readUInt32LE(0x3c);
  if (bytes.toString('ascii', peOffset, peOffset + 4) !== 'PE\u0000\u0000') {
    throw new Error(`Invalid Windows PE signature: ${file}`);
  }
  return bytes.readUInt16LE(peOffset + 4);
}

function prepareNativeRuntime(root = path.resolve(__dirname, '..'), environment = process.env) {
  if (environment.npm_lifecycle_event === 'test') return null;
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('The Windows x64 release requires a win32 x64 build environment.');
  }
  const windowsDirectory = environment.SystemRoot || environment.WINDIR;
  if (!windowsDirectory) throw new Error('Cannot locate the Windows SystemRoot for VCRUNTIME140.dll.');
  const source = path.join(windowsDirectory, 'System32', 'vcruntime140.dll');
  if (!fs.existsSync(source)) throw new Error(`Required Microsoft x64 runtime is missing: ${source}`);
  if (peMachine(source) !== 0x8664) throw new Error(`Required Microsoft runtime is not x64: ${source}`);

  const destination = path.join(root, 'build', 'native-runtime', 'vcruntime140.dll');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  const version = fs.statSync(destination);
  console.log(`Staged Microsoft VCRUNTIME140.dll (${version.size} bytes) for app-local native loading.`);
  return destination;
}

if (require.main === module) {
  try {
    prepareNativeRuntime();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { peMachine, prepareNativeRuntime };
