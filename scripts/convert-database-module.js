// One-time, scoped source conversion. Not used by the application.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../electron/database.js');
let source = fs.readFileSync(file, 'utf8');
if (!source.includes('mysql.createPool')) throw new Error('Already converted');
source = source.replace('const mysql = require("mysql2/promise");', 'const { SQLitePool } = require("./sqlite-pool");');
source = source.replace(/  constructor\(\) \{[\s\S]*?\n  \}/, '  constructor(file, options) {\n    this.pool = new SQLitePool(file, options);\n  }');
source = source.replace(/      const connection = await this.pool.getConnection\(\);\s*connection.release\(\);/, '      await this.pool.ready;');
for (const method of ['ensureReportSubmissionsTable', 'ensureMediaTable', 'ensureVendorLedgerTable', 'ensureCustomerLedgerTable', 'ensureCustomerPaymentsTable']) {
  source = source.replace(new RegExp(`  async ${method}\\(\\) \\{[\\s\\S]*?\\n  \\}`), `  async ${method}() {\n    await this.pool.ready;\n  }`);
}
source = source.replace(/ON DUPLICATE KEY UPDATE/g, 'ON CONFLICT DO UPDATE SET')
  .replace(/VALUES\((\w+)\)/g, 'excluded.$1')
  .replace(/NOW\(\)/g, "datetime('now', 'localtime')")
  .replace(/CURRENT_DATE\(\)/g, "date('now', 'localtime')")
  .replace(/GREATEST\(/g, 'MAX(')
  .replace('INSERT IGNORE INTO RolePermissions (role_id, permission_id, allowed) SELECT ?, id, 1 FROM Permissions', 'INSERT INTO RolePermissions (role_id, permission_id, allowed) SELECT ?, id, 1 FROM Permissions WHERE 1 ON CONFLICT DO NOTHING');
source = source.replace('SHOW COLUMNS FROM \\`${table}\\`', 'PRAGMA table_info(\\`${table}\\`)').replace('rows.map((row) => row.Field)', 'rows.map((row) => row.name)');
source = source.replace('MySQL schema', 'database schema').replace('does not exist in MySQL.', 'does not exist in the database.');
// Keep related writes (including nested credit/ledger saves) in one transaction.
source = source.replace('  async save(table, payload) {', '  async save(table, payload) {\n    return this.pool.transaction(() => this.saveRecord(table, payload));\n  }\n\n  async saveRecord(table, payload) {');
source = source.replace('module.exports = { getDatabase, closeDatabase };', 'module.exports = { Database, getDatabase, closeDatabase };');
fs.writeFileSync(file, source);
