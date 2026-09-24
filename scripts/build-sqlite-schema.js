// Intentional conversion of the checked-in schema, never run during startup.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'mysql.sql'), 'utf8');
const metadata = {};
const statements = [];
for (const match of source.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\) ENGINE=InnoDB;/g)) {
  const [, table, body] = match;
  const indexes = [];
  metadata[table] = {};
  let converted = body.replace(/^\s*INDEX (\w+) \(([^)]+)\),?\s*$/gm, (_, name, columns) => {
    indexes.push(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columns});`);
    return '';
  });
  converted = converted.replace(/^(\s*)(`?\w+`?)\s+(VARCHAR\(\d+\)|CHAR\(\d+\)|DECIMAL\((\d+),(\d+)\)|TINYINT\(1\)|INT|DATETIME|DATE|JSON|MEDIUMTEXT|TEXT)(.*)$/gm,
    (_, space, name, type, precision, scale, rest) => {
      metadata[table][name.replace(/`/g, '')] = { type, ...(scale ? { precision: Number(precision), scale: Number(scale) } : {}) };
      const sqlType = /^(INT|TINYINT)/.test(type) ? 'INTEGER' : 'TEXT';
      // Match MySQL's case-insensitive identifier/value comparisons for ASCII.
      const collation = /^(VARCHAR|CHAR)/.test(type) ? ' COLLATE NOCASE' : '';
      if (rest.includes('PRIMARY KEY') && !rest.includes('NOT NULL')) rest = rest.replace('PRIMARY KEY', 'NOT NULL PRIMARY KEY');
      if (scale) rest = rest.replace(/DEFAULT ([\d.]+)/, "DEFAULT '$1'");
      return `${space}${name} ${sqlType}${collation}${rest}`;
    });
  converted = converted.replace(/,\s*$/, '\n');
  statements.push(`CREATE TABLE IF NOT EXISTS ${table} (${converted});`, ...indexes);
}
if (Object.keys(metadata).length !== 43) throw new Error(`Review table count: ${Object.keys(metadata).length}`);
fs.mkdirSync(path.join(root, 'database'), { recursive: true });
fs.writeFileSync(path.join(root, 'database', 'KUMAKH_DATABASE.sql'), '-- Derived from mysql.sql; applied transactionally by sqlite-pool.js.\n' + statements.join('\n\n') + '\n');
fs.writeFileSync(path.join(root, 'database', 'columns.json'), JSON.stringify(metadata, null, 2) + '\n');
let seeds = source.slice(source.indexOf('INSERT INTO Roles'));
seeds = seeds.replace(/ON DUPLICATE KEY UPDATE[\s\S]*?;/g, 'ON CONFLICT DO NOTHING;').replace(/SET FOREIGN_KEY_CHECKS = 1;/, '');
fs.writeFileSync(path.join(root, 'database', 'seed.sql'), seeds);
console.log(`Generated ${Object.keys(metadata).length} tables.`);
