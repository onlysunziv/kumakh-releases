const quote = name => '"' + name.replaceAll('"', '""') + '"';

// Compare the entire original row atomically on the server. Wall clocks and
// second-resolution updated_at values cannot safely order writes across PCs.
// Apply the same guard during local rebase so the renderer sees the cloud winner.
function protectCloudRow(mutation) {
  const { tableName, changeType, before, after } = mutation;
  const table = quote(tableName);
  if (changeType === 'insert') {
    if (!after || !Object.keys(after).length) throw new Error('SYNC_MUTATION_INCOMPLETE');
    const fields = Object.keys(after);
    return { operation: 'rewrite', stmt: {
      sql: `INSERT INTO ${table} (${fields.map(quote).join(',')}) VALUES (${fields.map(() => '?').join(',')}) ON CONFLICT DO NOTHING`,
      values: fields.map(field => after[field]),
    } };
  }
  if (!before || !Object.keys(before).length) throw new Error('SYNC_MUTATION_INCOMPLETE');
  const fields = Object.keys(before);
  const where = fields.map(field => `${quote(field)} COLLATE BINARY IS ?`).join(' AND ');
  if (changeType === 'delete') return { operation: 'rewrite', stmt: {
    sql: `DELETE FROM ${table} WHERE ${where}`, values: fields.map(field => before[field]),
  } };
  if (changeType !== 'update' || !after) throw new Error('SYNC_MUTATION_INCOMPLETE');
  const updates = Object.keys(mutation.updates || after);
  if (!updates.length) return { operation: 'skip' };
  return { operation: 'rewrite', stmt: {
    sql: `UPDATE ${table} SET ${updates.map(field => `${quote(field)}=?`).join(',')} WHERE ${where}`,
    values: [...updates.map(field => after[field]), ...fields.map(field => before[field])],
  } };
}
module.exports = { protectCloudRow };
