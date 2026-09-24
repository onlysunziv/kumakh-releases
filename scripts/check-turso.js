const { Database } = require("../electron/database");

const required = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];
const missing = required.filter((name) => !String(process.env[name] || "").trim());

if (missing.length) {
  console.error(`Optional Turso sync is not configured: missing ${missing.join(" and ")}.`);
  process.exitCode = 1;
} else {
  (async () => {
    const database = new Database(undefined, { seed: false, initializePermissions: false });
    try {
      await database.open();
      const [tables] = await database.pool.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'");
      const counts = {};
      for (const table of ["Students", "Staff", "Purchases", "Inventory", "CafeSales", "Users"]) {
        const [rows] = await database.pool.query(`SELECT COUNT(*) AS count FROM "${table}"`);
        counts[table] = rows[0].count;
      }
      console.log("Turso connection: OK");
      console.log(`Local synchronized schema tables: ${tables[0].count}`);
      console.log(`Operational records: ${JSON.stringify(counts)}`);
      console.log(`Sync status: ${JSON.stringify(database.getSyncStatus())}`);
    } catch (error) {
      console.error(`Turso connection failed: ${error.code || "TURSO_CONNECTION_FAILED"}`);
      console.error(error.message);
      process.exitCode = 1;
    } finally {
      await database.close().catch(() => {});
    }
  })();
}
