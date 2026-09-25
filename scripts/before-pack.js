const path = require('path');
const { generateTursoConfig } = require('./generate-turso-config');

module.exports = async function beforePack(context) {
  const root = context.packager.projectDir || path.resolve(__dirname, '..');
  generateTursoConfig(root, process.env);
};
