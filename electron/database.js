const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { SQLitePool } = require("./sqlite-pool");
const { TursoPool } = require("./turso-pool");
const electronApp = process.versions.electron ? require("electron").app : null;

function tursoConfigPath() {
  if (!electronApp || process.env.NODE_ENV === "test") return null;
  const packagedConfig = electronApp.isPackaged && process.resourcesPath
    ? path.join(process.resourcesPath, "config", "turso.env")
    : null;
  const candidates = electronApp.isReady()
    ? [
        path.join(electronApp.getPath("userData"), "runtime.env"),
        packagedConfig,
      ]
    : [
        packagedConfig,
      ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || null;
}

function readEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf("=");
    if (!trimmed || trimmed.startsWith("#") || separator <= 0) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function resolveTursoConfiguration() {
  const persistentConfig = electronApp?.isReady()
    ? path.join(electronApp.getPath("userData"), "runtime.env")
    : null;
  const packagedConfig = electronApp?.isPackaged && process.resourcesPath
    ? path.join(process.resourcesPath, "config", "turso.env")
    : null;
  const userConfig = tursoConfigPath();
  if (!userConfig && electronApp?.isPackaged) {
    throw Object.assign(new Error("Packaged Turso configuration is unavailable."), { code: "TURSO_PACKAGED_CONFIGURATION_MISSING" });
  }
  const fromUserConfig = readEnvFile(userConfig);
  const url = String(fromUserConfig.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || "").trim();
  const authToken = String(fromUserConfig.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "").trim();
  if (!url || !authToken) return null;
  if (electronApp?.isPackaged && userConfig === packagedConfig && persistentConfig) {
    fs.mkdirSync(path.dirname(persistentConfig), { recursive: true });
    const temporary = `${persistentConfig}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, `TURSO_DATABASE_URL=${url}\nTURSO_AUTH_TOKEN=${authToken}\n`, { encoding: "utf8", mode: 0o600 });
    try { fs.renameSync(temporary, persistentConfig); } catch (error) {
      fs.rmSync(temporary, { force: true });
      if (!fs.existsSync(persistentConfig)) throw error;
    }
  }
  return { url, authToken, source: persistentConfig || userConfig || "environment" };
}

function applyTursoConfiguration(configured) {
  if (!configured) return;
  process.env.TURSO_DATABASE_URL = configured.url;
  process.env.TURSO_AUTH_TOKEN = configured.authToken;
}

function reportHttpError(status, fallbackMessage) {
  const code = Number(status) || 0;
  const messages = {
    400: "The report request was rejected by the endpoint.",
    401: "Report authentication failed. Sign in again.",
    403: "The report endpoint denied access.",
    404: "The configured Google Apps Script /exec endpoint was not found.",
    408: "The report endpoint timed out.",
    429: "The report endpoint is busy. Try again later.",
  };
  if (code >= 500) return "The report endpoint returned a server error. Try again later.";
  return messages[code] || fallbackMessage || `The report endpoint returned HTTP ${code || "unknown"}.`;
}

function reportNetworkError(error) {
  const message = String(error?.message || error || "");
  if (error?.name === "AbortError" || /timeout|aborted/i.test(message)) return "The report endpoint timed out.";
  if (/fetch failed|network|unable to connect|offline/i.test(message)) return "Unable to reach the report endpoint. Check your connection and /exec URL.";
  return message || "Report submission failed.";
}

async function postReportRequest(endpoint, body, timeoutMs = 90000) {
  return fetch(endpoint, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body,
  });
}

const TABLES = Object.freeze({
  courses: "Courses",
  students: "Students",
  staff: "Staff",
  vendors: "Vendors",
  expenses: "Expenses",
  purchases: "Purchases",
  payroll: "Payroll",
  inventory: "Inventory",
  cafeTables: "CafeTables",
  cafeCategories: "CafeCategories",
  cafeMenu: "CafeMenu",
  cafeSales: "CafeSales",
  cafeCustomers: "CafeCustomers",
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  dayClosings: "DayClosings",
  auditLog: "AuditLog",
  reportSubmissions: "ReportSubmissions",
  systemSettings: "SystemSettings",
});

const ACTIONS = Object.freeze({
  getcourses: ["list", TABLES.courses], savecourse: ["save", TABLES.courses],
  updatecourse: ["save", TABLES.courses], deletecourse: ["delete", TABLES.courses],
  getstudents: ["list", TABLES.students], addstudent: ["save", TABLES.students],
  updatestudent: ["save", TABLES.students], deletestudent: ["delete", TABLES.students],
  updatestudentstatus: ["status", TABLES.students],
  getstaff: ["list", TABLES.staff], savestaff: ["save", TABLES.staff],
  updatestaff: ["save", TABLES.staff], deletestaff: ["delete", TABLES.staff],
  updatestaffstatus: ["status", TABLES.staff],
  getvendors: ["list", TABLES.vendors], savevendor: ["save", TABLES.vendors], deletevendor: ["delete", TABLES.vendors],
  saveexpense: ["save", TABLES.expenses], getexpensespurchases: ["expenses", null],
  savepurchase: ["savePurchase", null], getpurchasebills: ["purchaseBills", null],
  uploadpurchasebill: ["uploadPurchaseBill", null],
  getinventory: ["list", TABLES.inventory], getpayroll: ["list", TABLES.payroll],
  savepayroll: ["save", TABLES.payroll], markpayrollpaid: ["save", TABLES.payroll],
  getpayrollsummary: ["payrollSummary", null],
  getcafetables: ["list", TABLES.cafeTables], savecafetable: ["save", TABLES.cafeTables],
  savecafetables: ["save", TABLES.cafeTables], disablecafetable: ["status", TABLES.cafeTables],
  getcafecategories: ["list", TABLES.cafeCategories], savecafecategory: ["save", TABLES.cafeCategories],
  getcafemenu: ["list", TABLES.cafeMenu], savecafemenu: ["save", TABLES.cafeMenu],
  disablecafemenuitem: ["status", TABLES.cafeMenu],
  getcafecustomers: ["list", TABLES.cafeCustomers], savecafecustomer: ["save", TABLES.cafeCustomers],
  disablecafecustomer: ["status", TABLES.cafeCustomers],
  savecafesale: ["save", TABLES.cafeSales], getcafesales: ["list", TABLES.cafeSales],
  getcafedailysales: ["dailySales", null], getcafetodaysummary: ["todaySummary", null],
  submitcafedailyclosingreport: ["cafeClosing", TABLES.dayClosings],
  authenticateuser: ["authenticate", null],   getusersadmin: ["adminUsers", null],
  savesystemuser: ["save", TABLES.users], deletesystemuser: ["delete", TABLES.users],
  getrolesadmin: ["adminRoles", null], savesystemrole: ["save", TABLES.roles],
  deletesystemrole: ["delete", TABLES.roles], getpermissionmatrix: ["permissions", null],
  savepermissionassignment: ["permission", null],
  getstudentpayments: ["list", "StudentPayments"], savestudentpayment: ["save", "StudentPayments"],
  savevendorpayment: ["save", "VendorPayments"], savestaffpayment: ["save", "StaffPayments"],
  getcreditsales: ["list", "CreditSales"], getcustomerledger: ["customerLedger", null], getvendorledger: ["vendorLedger", null],
  getduereceived: ["list", "DueReceived"], saveduereceived: ["save", "DueReceived"],
  getcustomerpayments: ["list", "CustomerPayments"],
  authenticatereports: ["authenticateReports", null], savereportconfig: ["saveReportConfig", null], getreportconfig: ["reportConfig", null], getreportpreview: ["reportPreview", null],
  submitreport: ["submitReport", null], retryreport: ["retryReport", null],
  getreportsubmissions: ["reportSubmissions", null],
});

const COLUMNS = Object.freeze({
  Courses: ["course_name", "duration", "total_fee", "status"],
  Students: ["registration_number", "joining_date", "full_name", "student_contact", "date_of_birth", "gender", "marital_status", "address", "parents_name", "relationship", "parents_contact", "course_id", "course_name", "course_duration", "registration_fee", "training_course_fee", "discount", "passport_photo", "documents", "student_folder", "status"],
  Staff: ["employee_id", "full_name", "passport_photo", "address", "gender", "blood_group", "mobile_number", "email", "citizenship_number", "personal_pan_no", "marital_status", "home_number", "alternative_number", "date_of_birth", "father_name", "mother_name", "grandfather_name", "grandmother_name", "spouse_name", "account_number", "account_name", "bank_name", "swift_code", "job_title", "report_to", "department", "company_name", "company_address", "company_contact_no", "joining_date", "basic_salary", "documents", "staff_folder", "status"],
  Vendors: ["name", "pan_vat_no", "address", "contact_no", "email", "status"],
  Expenses: ["name", "category", "amount", "expense_date", "notes", "payment_method", "reference", "remarks"],
  Purchases: ["invoice_no", "vendor_id", "purchase_date", "grand_total", "paid_amount", "due_amount", "payment_status", "payment_method", "discount", "tax", "remarks", "bill_file_id", "bill_file_url", "digital_bill_url", "created_by"],
  Payroll: ["employee_id", "payroll_month", "designation", "basic_salary", "normal_working_days", "days_worked", "earned_salary", "bonus", "allowance", "total_earning", "deduction", "tds", "net_salary", "total_paid", "due_salary", "payment_status", "payment_method", "payment_date", "remarks"],
  Inventory: ["item_name", "quantity", "unit", "status"],
  CafeCategories: ["name", "status"],
  CafeMenu: ["name", "category_id", "price", "quantity", "unit", "cost_price", "description", "status"],
  CafeTables: ["table_no", "status"],
  CafeCustomers: ["name", "phone", "credit_limit", "address", "status"],
  CafeSales: ["sale_date", "total_bill", "payment_status", "table_no", "customer_id", "customer_name", "customer_phone", "discount_amount", "vat_amount", "tendered_amount", "paid_amount", "change_amount", "due_amount", "payment_method", "items_ordered"],
  CreditSales: ["customer_id", "customer_name", "customer_phone", "sale_date", "table_no", "total_bill", "paid_amount", "due_amount", "payment_method", "items_ordered"],
  CustomerLedger: ["customer_id", "customer_name", "total_credit_amount", "total_received_amount", "total_due_amount", "last_transaction_date"],
  VendorLedger: ["vendor_id", "vendor_name", "total_purchased_amount", "total_paid_amount", "total_due_amount", "last_transaction_date"],
  Users: ["username", "password_hash", "full_name", "employee_id", "role_id", "status"],
  Roles: ["name", "description", "status"],
  Permissions: ["permission_key", "name", "description"],
  FileAttachments: ["entity", "entity_id", "file_name", "file_path"],
  StudentPayments: ["student_id", "student_name", "payment_date", "course", "course_fee", "total_paid", "amount", "payment_mode", "payment_type", "remarks"],
  VendorPayments: ["vendor_id", "vendor_name", "payment_date", "paid_amount", "payment_method", "notes"],
  StaffPayments: ["employee_id", "employee_name", "payment_date", "paid_amount", "payment_method", "notes"],
  DueReceived: ["customer_id", "customer_name", "receipt_date", "previous_due_amount", "received_amount", "remaining_due_amount", "payment_mode", "remarks"],
  CustomerPayments: ["customer_id", "customer_name", "payment_date", "amount", "payment_method", "previous_due_amount", "remaining_due_amount", "remarks"],
  DayClosings: ["closing_date"],
  ReportSubmissions: ["report_key", "report_name", "date_from", "date_to", "status", "rows_json", "remote_id", "error_message", "submitted_by", "submitted_at"],
});

const normalizeAction = (value) => String(value || "").replace(/[\s_-]+/g, "").toLowerCase();
const now = () => new Date();
const idFor = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const hash = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const STUDENT_MEDIA_CHUNK_SIZE = 256 * 1024;
const DEFAULT_REPORTS_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhLYE9xhzyQGON8WwSG3SalW8wWXT6wbLfuR7QA56kkLJdYhlZBejroyvRqxhYjpRTow/exec";

class Database {
  constructor(file, options) {
    const configured = resolveTursoConfiguration();
    applyTursoConfiguration(configured);
    const replicaFile = file || require("./sqlite-pool").databasePath();
    if (options?.forceSQLite || file) {
      this.pool = new SQLitePool(file, options);
    } else if (configured) {
      this.pool = new TursoPool(replicaFile, {
        ...options,
        syncUrl: configured.url,
        authToken: configured.authToken,
      });
    } else {
      throw Object.assign(new Error("Turso configuration is missing for this installation. Provision the existing cloud database settings before starting KUMAKH."), { code: "TURSO_CONFIGURATION_MISSING" });
    }
    this.initializePermissions = options?.initializePermissions !== false;
  }

  async adminRoles() {
    const [rows] = await this.pool.query("SELECT id, name, description, status FROM Roles ORDER BY name ASC");
    return rows.map((row) => ({
      "Role ID": row.id,
      "Role Name": row.name,
      Description: row.description || "",
      Status: row.status || "Active",
    }));
  }

  async adminUsers() {
    const [rows] = await this.pool.query(
      "SELECT u.id, u.username, u.full_name, u.employee_id, u.role_id, u.status, r.name AS role_name FROM Users u LEFT JOIN Roles r ON r.id=u.role_id ORDER BY u.username ASC",
    );
    const [rolePermissions] = await this.pool.query(
      "SELECT rp.role_id, p.permission_key FROM RolePermissions rp JOIN Permissions p ON p.id=rp.permission_id WHERE rp.allowed=1",
    );
    const [userPermissions] = await this.pool.query(
      "SELECT up.user_id, p.permission_key, up.allowed FROM UserPermissions up JOIN Permissions p ON p.id=up.permission_id",
    );
    const roleMap = new Map();
    rolePermissions.forEach((item) => {
      if (!roleMap.has(item.role_id)) roleMap.set(item.role_id, new Set());
      roleMap.get(item.role_id).add(item.permission_key);
    });
    const userMap = new Map();
    userPermissions.forEach((item) => {
      if (!userMap.has(item.user_id)) userMap.set(item.user_id, new Map());
      userMap.get(item.user_id).set(item.permission_key, Boolean(item.allowed));
    });
    return rows.map((row) => {
      const permissions = new Set(roleMap.get(row.role_id) || []);
      (userMap.get(row.id) || new Map()).forEach((allowed, key) => {
        if (allowed) permissions.add(key);
        else permissions.delete(key);
      });
      return {
        userId: row.id,
        username: row.username,
        fullName: row.full_name || "",
        employeeId: row.employee_id || "",
        role: row.role_name || "",
        status: row.status || "Inactive",
        permissions: [...permissions],
      };
    });
  }

  async open() {
    if (!this.ready) {
      await this.pool.ready;
      await this.ensureReportSubmissionsTable();
      if (this.initializePermissions) await this.ensurePermissionCatalog();
      this.ready = true;
    }
  }

  async close() {
    return this.pool.end();
  }

  async pushChanges() {
    return typeof this.pool.push === "function" ? this.pool.push() : null;
  }

  async pullChanges() {
    return typeof this.pool.pull === "function" ? this.pool.pull() : null;
  }

  async syncNow() {
    return typeof this.pool.sync === "function" ? this.pool.sync() : null;
  }

  getSyncStatus() {
    return typeof this.pool.syncStatus === "function"
      ? this.pool.syncStatus()
      : { state: "offline", pending: false, lastSyncAt: null, lastError: null };
  }

  async ensureReportSubmissionsTable() {
    await this.pool.ready;
  }

  async ensurePermissionCatalog() {
    const modules = [
      ["dashboard", "Dashboard"],
      ["cafe", "Café / POS"],
      ["courses", "Courses"],
      ["students", "Students"],
      ["payments", "Student Payments"],
      ["staff", "Staff"],
      ["payroll", "Payroll"],
      ["paymentout", "Payment Out"],
      ["purchases", "Purchases"],
      ["expenses", "Expenses"],
      ["vendors", "Vendors"],
      ["reports", "Reports"],
      ["settings", "Settings"],
      ["users", "Users"],
    ];
    const actions = ["view", "add", "modify", "delete"];
    for (const [module, label] of modules) {
      for (const action of actions) {
        const permissionKey = `${module}.${action}`;
        await this.pool.query(
          "INSERT INTO Permissions (id, permission_key, name, description, created_at, updated_at, data_json) VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), ?) ON CONFLICT DO UPDATE SET name=excluded.name, description=excluded.description, updated_at=datetime('now', 'localtime')",
          [`perm-${permissionKey}`, permissionKey, `${label} ${action}`, `${action} access for ${label}`, JSON.stringify({ permissionKey })],
        );
      }
    }
    const [adminRoles] = await this.pool.query("SELECT id FROM Roles WHERE UPPER(name)='ADMIN' LIMIT 1");
    if (!adminRoles[0]) return;
    await this.pool.query(
      "INSERT INTO RolePermissions (role_id, permission_id, allowed) SELECT ?, id, 1 FROM Permissions WHERE 1 ON CONFLICT DO NOTHING",
      [adminRoles[0].id],
    );
  }

  async request(action, payload = {}, { onReportProgress = () => {} } = {}) {
    await this.open();
    const [operation, table] = ACTIONS[normalizeAction(action)] || [];
    if (!operation) throw new Error(`Unsupported database action: ${action}`);
    let data;
    if (operation === "authenticate") data = await this.authenticate(payload);
    else if (operation === "list") data = await this.list(table);
    else if (operation === "adminUsers") data = await this.adminUsers();
    else if (operation === "adminRoles") data = await this.adminRoles();
    else if (operation === "save") data = await this.save(table, payload);
    else if (operation === "savePurchase") data = await this.savePurchase(payload);
    else if (operation === "purchaseBills") data = await this.purchaseBills();
    else if (operation === "uploadPurchaseBill") data = await this.uploadPurchaseBill(payload);
    else if (operation === "delete") data = await this.remove(table, payload);
    else if (operation === "status") data = await this.status(table, payload);
    else if (operation === "expenses") data = { expenses: await this.list(TABLES.expenses), purchases: await this.list(TABLES.purchases) };
    else if (operation === "payrollSummary") data = await this.payrollSummary();
    else if (operation === "dailySales" || operation === "todaySummary") data = await this.salesSummary(operation);
    else if (operation === "cafeClosing") data = await this.pool.transaction(async () => {
      const summary = await this.salesSummary("todaySummary");
      if (payload.date && payload.date !== summary.date) throw new Error("Reload today's closing report before submitting.");
      return this.saveRecord(table, { ...summary, sales: undefined, id: `cafe-closing-${summary.date}`, closingDate: summary.date });
    });
    else if (operation === "customerLedger") data = await this.customerLedger();
    else if (operation === "vendorLedger") data = await this.vendorLedger();
    else if (operation === "permissions") data = await this.permissions();
    else if (operation === "permission") data = await this.savePermissionAssignment(payload);
    else if (operation === "authenticateReports") {
      try { data = await this.authenticateReports(payload); }
      catch (error) {
        // Return structured failures across IPC; thrown errors lose their codes
        // and expose Electron's internal "Error invoking remote method" prefix.
        return { success: false, message: error.message, code: error.code || 'REPORT_SIGNIN_FAILED', retryable: Boolean(error.retryable) };
      }
    }
    else if (operation === "saveReportConfig") data = await this.saveReportConfig(payload);
    else if (operation === "reportConfig") data = await this.reportConfig();
    else if (operation === "reportPreview") data = await this.reportPreview(payload);
    else if (operation === "submitReport") data = await this.submitReport(payload, onReportProgress);
    else if (operation === "retryReport") data = await this.retryReport(payload, onReportProgress);
    else if (operation === "reportSubmissions") data = await this.reportSubmissions(payload);
    if (operation === "submitReport" || operation === "retryReport") return data;
    return { success: true, data };
  }

  async list(table) {
    if (table === "Payroll") {
      const [rows] = await this.pool.query(`
        SELECT p.*, s.full_name AS staff_full_name, s.job_title AS staff_job_title,
          s.joining_date AS staff_joining_date
        FROM Payroll p
        LEFT JOIN Staff s ON s.employee_id = p.employee_id
        ORDER BY p.id DESC
      `);
      return rows.map((row) => {
        const output = this.outputRecord(table, row);
        const employeeName = row.employee_name || row.staff_full_name || row.employee_id || "";
        const designation = row.designation || row.staff_job_title || "";
        return {
          ...output,
          "Employee ID": row.employee_id || "",
          "Employee Name": employeeName,
          employeeName,
          Designation: designation,
          designation,
          "Joining Date": row.joining_date || row.staff_joining_date || "",
          "Days Worked": Number(row.days_worked || 0),
          daysWorked: Number(row.days_worked || 0),
        };
      });
    }
    if (table === "Vendors") {
      const [rows] = await this.pool.query(`
        SELECT v.*,
          COALESCE(p.total_purchased, 0) AS total_purchases,
          COALESCE(p.total_paid, 0) + COALESCE(vp.total_paid, 0) AS total_paid,
          MAX(
            COALESCE(p.total_purchased, 0) -
            COALESCE(p.total_paid, 0) -
            COALESCE(vp.total_paid, 0), 0
          ) AS total_due
        FROM Vendors v
        LEFT JOIN (
          SELECT vendor_id, SUM(grand_total) AS total_purchased, SUM(paid_amount) AS total_paid
          FROM Purchases
          GROUP BY vendor_id
        ) p ON p.vendor_id = v.id
        LEFT JOIN (
          SELECT vendor_id, SUM(paid_amount) AS total_paid
          FROM VendorPayments
          GROUP BY vendor_id
        ) vp ON vp.vendor_id = v.id
        ORDER BY v.id DESC`);
      return rows.map((row) => ({
        ...this.outputRecord(table, row),
        "Vendor ID": row.id,
        "Vendor Name": row.name,
        "Total Purchases": Number(row.total_purchases || 0),
        "Total Paid": Number(row.total_paid || 0),
        "Due Amount": Number(row.total_due || 0),
        vendorId: row.id,
        vendorName: row.name,
        totalPurchases: Number(row.total_purchases || 0),
        totalPaid: Number(row.total_paid || 0),
        totalDue: Number(row.total_due || 0),
      }));
    }

    if (table === "Courses") await this.removeDuplicateCourses();
    const [rows] = await this.pool.query(
      `SELECT * FROM \`${table}\` ORDER BY id ${table === "Inventory" ? "ASC" : "DESC"}`,
    );
    const hydrated = table === "Students" || table === "Staff"
      ? await Promise.all(rows.map((row) => this.hydrateMedia(table, row)))
      : rows;
    return hydrated.map((row) => this.outputRecord(table, row));
  }

    async purchaseBills() {
      const [bills] = await this.pool.query(`
        SELECT p.*, v.name AS vendor_name, v.address AS vendor_address,
          v.pan_vat_no AS vendor_pan_vat_no, v.contact_no AS vendor_contact
        FROM Purchases p
        LEFT JOIN Vendors v ON v.id = p.vendor_id
        ORDER BY p.purchase_date DESC, p.created_at DESC`);
      const [items] = await this.pool.query(`
        SELECT pi.*, p.invoice_no, p.vendor_id
        FROM PurchaseItems pi
        JOIN Purchases p ON p.id = pi.purchase_id
        ORDER BY pi.purchase_id, pi.id`);
      const itemRows = items.map((item) => ({
        ...item,
        purchaseId: item.purchase_id,
        billId: item.purchase_id,
        itemName: item.item_name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        amount: Number(item.amount || 0),
        unit: (() => {
          try { return JSON.parse(item.data_json || "{}").unit || ""; } catch (_) { return ""; }
        })(),
      }));
      const billRows = bills.map((bill) => ({
        ...bill,
        id: bill.id,
        purchaseId: bill.id,
        billId: bill.id,
        "Purchase ID": bill.id,
        "Bill ID": bill.id,
        vendorId: bill.vendor_id,
        vendorName: bill.vendor_name || "",
        vendorAddress: bill.vendor_address || "",
        panVatNo: bill.vendor_pan_vat_no || "",
        contactNo: bill.vendor_contact || "",
        invoiceNo: bill.invoice_no || "",
        purchaseDate: bill.purchase_date,
        grandTotal: Number(bill.grand_total || 0),
        subtotal: Number((Number(bill.grand_total || 0) + Number(bill.discount || 0) - Number(bill.tax || 0)).toFixed(2)),
        paidAmount: Number(bill.paid_amount || 0),
        dueAmount: Number(bill.due_amount || 0),
        discount: Number(bill.discount || 0),
        tax: Number(bill.tax || 0),
        paymentStatus: bill.payment_status || "",
        paymentMethod: bill.payment_method || "",
        items: itemRows.filter((item) => item.purchase_id === bill.id),
      }));
      const result = billRows.slice();
      result.bills = billRows;
      result.items = itemRows;
      return result;
    }

    async savePurchase(payload) {
      const input = { ...(payload || {}) };
      const vendorId = String(input.vendorId || input.vendor_id || "").trim();
      const invoiceNo = String(input.invoiceNo || input.invoiceNumber || input.invoice_no || "").trim();
      const purchaseDate = String(input.purchaseDate || input.purchase_date || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const items = (Array.isArray(input.items) ? input.items : []).map((item) => ({
        itemName: String(item.itemName || item.name || "").trim(),
        quantity: Number(item.quantity ?? item.qty),
        unit: String(item.unit || "").trim(),
        unitPrice: Number(item.unitPrice ?? item.price),
      }));
      if (!vendorId) throw new Error("Vendor ID is required.");
      const normalizedInvoiceNo = invoiceNo || `INV-${purchaseDate.replace(/-/g, "")}-${Date.now()}`;
      if (!items.length || items.some((item) => !item.itemName || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
        throw new Error("At least one valid purchase item is required.");
      }
      const discount = Number(input.discount ?? input.discount_amount ?? 0);
      const tax = Number(input.tax ?? input.tax_amount ?? 0);
      const subtotal = Number(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2));
      const grandTotal = Number((subtotal - discount + tax).toFixed(2));
      const paidAmount = Number(input.paidAmount ?? input.paid_amount ?? 0);
      if (![discount, tax, paidAmount].every(Number.isFinite) || discount < 0 || tax < 0 || grandTotal < 0 || paidAmount < 0 || paidAmount > grandTotal) {
        throw new Error("Purchase totals or paid amount are invalid.");
      }
      const dueAmount = Number((grandTotal - paidAmount).toFixed(2));
      const paymentStatus = paidAmount === 0 ? "UNPAID" : paidAmount >= grandTotal ? "PAID" : "PARTIAL";
      return this.pool.transaction(async () => {
        const [vendors] = await this.pool.query("SELECT id, name FROM Vendors WHERE id = ? LIMIT 1", [vendorId]);
        if (!vendors[0]) throw new Error("Selected vendor was not found.");
        const day = purchaseDate.replace(/-/g, "");
        const [existing] = await this.pool.query("SELECT id FROM Purchases WHERE id LIKE ? ORDER BY id DESC LIMIT 1", [`PUR-${day}-%`]);
        const last = existing[0] ? Number(String(existing[0].id).split("-").pop()) || 0 : 0;
        const purchaseId = `PUR-${day}-${String(last + 1).padStart(4, "0")}`;
        const createdAt = now();
        const purchase = {
          id: purchaseId,
          invoice_no: normalizedInvoiceNo,
          vendor_id: vendorId,
          purchase_date: purchaseDate,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          due_amount: dueAmount,
          payment_status: paymentStatus,
          payment_method: input.paymentMethod || input.payment_method || "",
          discount,
          tax,
          remarks: String(input.remarks || ""),
          created_by: String(input.createdBy || input.created_by || ""),
          created_at: createdAt,
          data_json: JSON.stringify({ ...input, id: purchaseId, purchaseId, invoiceNo: normalizedInvoiceNo }),
        };
        await this.pool.query(
          `INSERT INTO Purchases
            (id, invoice_no, vendor_id, purchase_date, grand_total, paid_amount, due_amount,
             payment_status, payment_method, discount, tax, remarks, created_by, created_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [purchase.id, purchase.invoice_no, purchase.vendor_id, purchase.purchase_date, purchase.grand_total, purchase.paid_amount, purchase.due_amount, purchase.payment_status, purchase.payment_method, purchase.discount, purchase.tax, purchase.remarks, purchase.created_by, purchase.created_at, purchase.data_json],
        );
        const savedItems = [];
        for (const item of items) {
          const amount = Number((item.quantity * item.unitPrice).toFixed(2));
          const itemId = idFor("purchase-item");
          await this.pool.query(
            `INSERT INTO PurchaseItems (id, purchase_id, item_name, quantity, unit_price, amount, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [itemId, purchaseId, item.itemName, item.quantity, item.unitPrice, amount, JSON.stringify(item)],
          );
          const [inventory] = await this.pool.query("SELECT id, quantity FROM Inventory WHERE lower(trim(item_name)) = lower(trim(?)) LIMIT 1", [item.itemName]);
          const inventoryId = inventory[0] ? inventory[0].id : idFor("inventory");
          const nextQuantity = Number((Number(inventory[0]?.quantity || 0) + item.quantity).toFixed(3));
          if (inventory[0]) {
            await this.pool.query("UPDATE Inventory SET quantity = ?, data_json = ? WHERE id = ?", [nextQuantity, JSON.stringify({ itemName: item.itemName, unit: item.unit }), inventoryId]);
          } else {
            await this.pool.query("INSERT INTO Inventory (id, item_name, quantity, unit, status, data_json) VALUES (?, ?, ?, ?, ?, ?)", [inventoryId, item.itemName, nextQuantity, item.unit, "Active", JSON.stringify({ itemName: item.itemName, unit: item.unit })]);
          }
          await this.pool.query(
            `INSERT INTO InventoryTransactions (id, inventory_id, quantity, transaction_type, created_at, data_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [idFor("inventory-tx"), inventoryId, item.quantity, "PURCHASE_IN", createdAt, JSON.stringify({ purchaseId, invoiceNo: normalizedInvoiceNo, rate: item.unitPrice })],
          );
          savedItems.push({ id: itemId, purchaseId, itemName: item.itemName, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, amount });
        }
        await this.refreshVendorLedger(vendorId);
        return {
          purchaseId,
          billId: purchaseId,
          purchase: {
            ...purchase,
            purchaseId,
            billId: purchaseId,
            invoiceNo: normalizedInvoiceNo,
            vendorId,
            vendorName: vendors[0].name,
            subtotal,
            grandTotal,
            paidAmount,
            dueAmount,
            paymentStatus,
            items: savedItems,
          },
          items: savedItems,
        };
      });
    }

    async uploadPurchaseBill(payload) {
      const purchaseId = String(payload.billId || payload.purchaseId || "").trim();
      const base64 = String(payload.file?.base64 || payload.file?.data || "").replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
      if (!purchaseId) throw new Error("Purchase ID is required.");
      if (!base64) throw new Error("A generated PDF is required.");
      const [rows] = await this.pool.query("SELECT id FROM Purchases WHERE id = ? LIMIT 1", [purchaseId]);
      if (!rows[0]) throw new Error("Purchase bill was not found.");
      const directory = path.join(path.dirname(this.pool.file), "..", "purchase-bills");
      fs.mkdirSync(directory, { recursive: true });
      const fileName = `${purchaseId}.pdf`;
      const filePath = path.join(directory, fileName);
      fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
      await this.pool.query("UPDATE Purchases SET bill_file_url = ?, digital_bill_url = ? WHERE id = ?", [filePath, filePath, purchaseId]);
      return { purchaseId, billId: purchaseId, fileName, fileUrl: filePath };
    }
  async removeDuplicateCourses() {
    const [rows] = await this.pool.query(
      "SELECT id, course_name, duration, total_fee FROM Courses ORDER BY created_at ASC, id ASC",
    );
    const canonicalByKey = new Map();
    for (const row of rows) {
      const key = [
        String(row.course_name || "").trim().toLowerCase(),
        String(row.duration || "").trim().toLowerCase(),
        Number(row.total_fee || 0).toFixed(2),
      ].join("|");
      if (!String(row.id || "").startsWith("courses-")) {
        continue;
      }
      if (!canonicalByKey.has(key)) {
        canonicalByKey.set(key, row.id);
        continue;
      }
      const canonicalId = canonicalByKey.get(key);
      await this.pool.query(
        "UPDATE Students SET course_id = ? WHERE course_id = ?",
        [canonicalId, row.id],
      );
      await this.pool.query("DELETE FROM Courses WHERE id = ?", [row.id]);
    }
  }

  async ensureMediaTable() {
    await this.pool.ready;
  }

  async storeMedia(entityTable, entityId, mediaType, media, identifier) {
    return require('./person-files').saveFile(this, entityTable, entityId, mediaType, media, identifier);
  }

  async hydrateMedia(table, row) {
    return require('./person-files').hydrate(this, table, row);
  }

  output(row) {
    let data = {};
    if (row.data_json) {
      try { data = typeof row.data_json === "string" ? JSON.parse(row.data_json) : row.data_json; } catch (error) { data = {}; }
    }
    return { ...data, ...row, data_json: undefined };
  }

  outputRecord(table, row) {
    const output = this.output(row);
    if (table === "CafeTables") {
      const tableNo = output.table_no ?? output.tableNo ?? output["Table No"] ?? "";
      const tableName = output.table_name ?? output.tableName ?? output["Table Name"] ?? "";
      const capacity = output.capacity ?? output.Capacity ?? 1;
      output.table_no = tableNo;
      output.tableNo = tableNo;
      output.table_name = tableName;
      output.tableName = tableName;
      output.capacity = capacity;
      output.Capacity = capacity;
    }
    const aliases = {
      Students: {
        "Student ID": "id",
        "Registration Number": "registration_number",
        "Full Name": "full_name",
        Course: "course_name",
        "Course Duration": "course_duration",
        "Registration Fee": "registration_fee",
        "Training/Course Fee": "training_course_fee",
        Discount: "discount",
        Status: "status",
      },
      Courses: {
        "Course ID": "id",
        "Course Name": "course_name",
        Duration: "duration",
        "Total Fee": "total_fee",
        Status: "status",
      },
      CafeTables: {
        "Table ID": "id",
        "Table No": "table_no",
        "Table Name": "table_name",
        Capacity: "capacity",
        Status: "status",
      },
      CafeSales: {
        "Sale ID": "id", "Sale Date": "sale_date", "Table No": "table_no",
        "Total Bill": "total_bill", "Payment Method": "payment_method",
        "Paid Amount": "paid_amount", "Due Amount": "due_amount",
      },
      CafeCategories: { "Category ID": "id", "Category Name": "name", Status: "status" },
      CafeMenu: {
        "Item ID": "id", "Item Name": "name", "Selling Price": "price",
        Unit: "unit", Description: "description", Status: "status",
      },
      StudentPayments: {
        "Payment ID": "id",
        "Student ID": "student_id",
        "Student Name": "student_name",
        Amount: "amount",
        "Payment Date": "payment_date",
        "Payment Mode": "payment_mode",
        "Payment Type": "payment_type",
      },
      VendorPayments: {
        "Payment ID": "id",
        "Vendor ID": "vendor_id",
        "Vendor Name": "vendor_name",
        Amount: "paid_amount",
        "Payment Date": "payment_date",
        "Payment Method": "payment_method",
        Remarks: "notes",
      },
      CafeCustomers: {
        "Customer ID": "id",
        "Customer Name": "name",
        "Phone Number": "phone",
        Address: "address",
        "Credit Limit": "credit_limit",
        Status: "status",
      },
      CreditSales: {
        "Credit Sale ID": "id",
        "Customer ID": "customer_id",
        "Customer Name": "customer_name",
        "Customer Phone": "customer_phone",
        "Total Bill": "total_bill",
        "Paid Amount": "paid_amount",
        "Due Amount": "due_amount",
      },
      DueReceived: {
        "Receipt ID": "id",
        "Customer ID": "customer_id",
        "Customer Name": "customer_name",
        "Received Amount": "received_amount",
        "Receipt Date": "receipt_date",
        "Previous Due Amount": "previous_due_amount",
        "Remaining Due Amount": "remaining_due_amount",
        "Payment Mode": "payment_mode",
        Remarks: "remarks",
      },
      CustomerPayments: {
        "Payment ID": "id",
        "Customer ID": "customer_id",
        "Customer Name": "customer_name",
        Amount: "amount",
        "Payment Date": "payment_date",
        "Payment Method": "payment_method",
        "Previous Due Amount": "previous_due_amount",
        "Remaining Due Amount": "remaining_due_amount",
        Remarks: "remarks",
      },
    }[table] || {};
    Object.entries(aliases).forEach(([displayName, source]) => {
      if (output[displayName] === undefined) output[displayName] = output[source] ?? "";
    });
    return output;
  }

  async save(table, payload) {
    return this.pool.transaction(() => this.saveRecord(table, payload));
  }

  async saveRecord(table, payload) {
    const input = { ...(payload || {}) };
    // The renderer keeps the historical Apps Script field names. Normalize
    // those names at the database boundary so the database schema remains the
    // canonical contract without breaking existing frontend callers.
    const aliases = {
      Courses: { courseName: "course_name" },
      Roles: { roleName: "name", roleDescription: "description" },
      Students: { studentName: "full_name", studentContact: "student_contact" },
      Staff: { employeeName: "full_name" },
      Vendors: { vendorName: "name", panVatNo: "pan_vat_no", panNo: "pan_vat_no", contactNo: "contact_no", contactNumber: "contact_no" },
      Expenses: { expenseName: "name", expenseDate: "expense_date" },
      Purchases: { invoiceNumber: "invoice_no", vendorId: "vendor_id", purchaseDate: "purchase_date", grandTotal: "grand_total", paymentStatus: "payment_status" },
      CafeCategories: { categoryName: "name" },
      CafeMenu: { itemName: "name", sellingPrice: "price", available: "status", categoryName: "category_name" },
      CafeTables: { tableNo: "table_no", tableName: "table_name", capacity: "capacity" },
      CafeCustomers: { customerName: "name", phoneNumber: "phone" },
      CafeSales: { saleDate: "sale_date", tableNo: "table_no", customerId: "customer_id", customerName: "customer_name", customerPhone: "customer_phone" },
      StudentPayments: { studentId: "student_id", studentName: "student_name", paymentDate: "payment_date", paymentMode: "payment_mode" },
      VendorPayments: { vendorId: "vendor_id", vendorName: "vendor_name", amount: "paid_amount", paymentDate: "payment_date", paymentMethod: "payment_method" },
      StaffPayments: { employeeId: "employee_id", employeeName: "employee_name", amount: "paid_amount", paymentDate: "payment_date", paymentMethod: "payment_method" },
      DueReceived: { customerId: "customer_id", customerName: "customer_name", receiptDate: "receipt_date", receivedAmount: "received_amount", paymentMode: "payment_mode" },
      CustomerPayments: { customerId: "customer_id", customerName: "customer_name", paymentDate: "payment_date", amount: "amount", paymentMethod: "payment_method" },
      DayClosings: { closingDate: "closing_date" },
    }[table] || {};
    // Student forms intentionally keep their historical nested payload shape.
    // Flatten it at the persistence boundary, while retaining the original
    // values in data_json for existing consumers.
    if (table === "Students" && input.student && typeof input.student === "object") {
      Object.assign(input, input.student);
      if (input.passportPhoto && input.passport_photo == null) input.passport_photo = input.passportPhoto;
      if (input.documents && input.student.documents == null) input.student.documents = input.documents;
    }
    if (table === "Staff" && input.staff && typeof input.staff === "object") {
      Object.assign(input, input.staff);
      if (input.passportPhoto && input.passport_photo == null) input.passport_photo = input.passportPhoto;
    }
    if ((table === "Students" || table === "Staff") && input.passportPhoto && input.passport_photo == null) {
      input.passport_photo = input.passportPhoto;
    }
    if (table === "Students" || table === "Staff") {
      if (input.passportPhoto?.data && !input.passportPhoto.base64) {
        input.passportPhoto = { ...input.passportPhoto, base64: input.passportPhoto.data };
      }
      if (Array.isArray(input.documents)) {
        input.documents = input.documents.map((document) =>
          document?.data && !document.base64
            ? { ...document, base64: document.data }
            : document,
        );
      }
    }
    for (const [source, target] of Object.entries(aliases)) {
      if (input[target] == null && input[source] != null) input[target] = input[source];
    }
    if (table === "CafeSales") {
      for (const column of COLUMNS.CafeSales) {
        if (input[column] == null && input[camel(column)] != null) input[column] = input[camel(column)];
      }
    }
    if (table === "Students" && input.course_id == null && input.courseId != null) {
      input.course_id = input.courseId;
    }
    if (table === "Students" && input.course_id == null && input.course) {
      const [courses] = await this.pool.query(
        "SELECT id FROM Courses WHERE id = ? OR course_name = ? LIMIT 1",
        [String(input.course), String(input.course)],
      );
      if (courses[0]) input.course_id = courses[0].id;
    }
    if (table === "StaffPayments" && input.notes == null && input.remarks != null) input.notes = input.remarks;
    if (table === "VendorPayments" && input.notes == null && input.remarks != null) input.notes = input.remarks;
    if (table === "Payroll") {
      const employeeId = String(input.employee_id || input.employeeId || "").trim();
      const payrollMonth = String(input.payroll_month || input.payrollMonth || "").trim();
      if (!employeeId || !payrollMonth) {
        throw new Error("Employee and payroll month are required.");
      }
      const [staffRows] = await this.pool.query(
        "SELECT basic_salary, joining_date FROM Staff WHERE employee_id = ? LIMIT 1",
        [employeeId],
      );
      const joiningDate = String(staffRows[0]?.joining_date || "").slice(0, 10);
      if (joiningDate) {
        const joiningMonth = joiningDate.slice(0, 7);
        if (payrollMonth < joiningMonth) {
          throw new Error("Salary cannot be calculated before the staff joining month.");
        }
        if (payrollMonth === joiningMonth) {
          const joiningDay = Number(joiningDate.slice(8, 10));
          const daysInMonth = new Date(
            Number(payrollMonth.slice(0, 4)),
            Number(payrollMonth.slice(5, 7)),
            0,
          ).getDate();
          const eligibleDays = daysInMonth - joiningDay + 1;
          const requestedDays = Number(input.days_worked ?? input.daysWorked ?? eligibleDays);
          if (!Number.isInteger(requestedDays) || requestedDays < 0 || requestedDays > eligibleDays) {
            throw new Error(`Days worked cannot exceed ${eligibleDays} days for the joining month.`);
          }
          input.days_worked = requestedDays;
        }
      }
      const basicSalary = Number(input.basic_salary ?? input.basicSalary ?? staffRows[0]?.basic_salary ?? 0);
      const workingDays = Number(input.normal_working_days ?? input.normalWorkingDays ?? 26);
      const daysWorked = Number(input.days_worked ?? input.daysWorked ?? workingDays);
      const bonus = Number(input.bonus || 0);
      const allowance = Number(input.allowance || 0);
      const deduction = Number(input.deduction || 0);
      const hasCalculatedPayroll = input.net_salary != null || input.netSalary != null;
      const earnedSalary = Math.round((basicSalary / workingDays) * daysWorked * 100) / 100;
      const totalEarning = Math.round((earnedSalary + bonus + allowance) * 100) / 100;
      const tds = Math.round(totalEarning * 0.01 * 100) / 100;
      const netSalary = Math.max(0, Math.round((totalEarning - tds - deduction) * 100) / 100);
      const totalPaid = Math.max(0, Number(input.total_paid ?? input.totalPaid ?? 0));
      input.employee_id = employeeId;
      input.payroll_month = payrollMonth;
      input.basic_salary = basicSalary;
      input.normal_working_days = workingDays;
      input.days_worked = daysWorked;
      if (!hasCalculatedPayroll) {
        if (totalPaid > netSalary) throw new Error("Total paid cannot exceed the net salary.");
        input.earned_salary = earnedSalary;
        input.total_earning = totalEarning;
        input.tds = tds;
        input.net_salary = netSalary;
      }
      input.total_paid = totalPaid;
      const storedNetSalary = Number(input.net_salary ?? input.netSalary ?? netSalary);
      if (totalPaid > storedNetSalary) throw new Error("Total paid cannot exceed the net salary.");
      input.due_salary = Math.round((storedNetSalary - totalPaid) * 100) / 100;
      input.payment_status = input.payment_status || (totalPaid >= storedNetSalary ? "Paid" : totalPaid > 0 ? "Partial" : "Due");
      input.employee_name = input.employee_name || input.employeeName || "";
    }
    if (table === "StudentPayments") {
      if (!input.student_id || !input.student_name || !input.payment_date || Number(input.amount || 0) <= 0) {
        throw new Error("Student, payment amount, and payment date are required.");
      }
      const [students] = await this.pool.query(
        `SELECT id, registration_number, full_name, course_name,
          COALESCE(registration_fee, 0) AS registration_fee,
          COALESCE(training_course_fee, 0) AS training_course_fee,
          COALESCE(discount, 0) AS discount
         FROM Students
         WHERE id=? OR registration_number=? OR full_name=?
         LIMIT 1`,
        [String(input.student_id), String(input.student_id), String(input.student_name)],
      );
      if (!students[0]) throw new Error("The selected student was not found.");
      const student = students[0];
      input.student_id = student.id;
      input.student_name = student.full_name;
      input.course = input.course || student.course_name || "";
      input.course_fee = Number(
        input.course_fee ??
        Number(student.registration_fee || 0) +
        Number(student.training_course_fee || 0) -
        Number(student.discount || 0),
      );
      const [paidRows] = await this.pool.query(
        "SELECT COALESCE(SUM(amount), 0) AS total_paid FROM StudentPayments WHERE student_id = ? AND id <> ?",
        [student.id, String(input.id || input.paymentId || "")],
      );
      input.total_paid = Number(paidRows[0]?.total_paid || 0) + Number(input.amount || 0);
      input.course_fee = Math.max(0, input.course_fee);
    }
    if (table === "VendorPayments") {
      if (!input.vendor_id || !input.vendor_name || !input.payment_date || Number(input.paid_amount || 0) <= 0) {
        throw new Error("Vendor, payment amount, and payment date are required.");
      }
      const [vendors] = await this.pool.query(
        "SELECT id, name FROM Vendors WHERE id=? OR name=? LIMIT 1",
        [String(input.vendor_id), String(input.vendor_name)],
      );
      if (!vendors[0]) throw new Error("The selected vendor was not found.");
      input.vendor_id = vendors[0].id;
      input.vendor_name = vendors[0].name;
    }
    if (table === "DueReceived") {
      const receivedAmount = Number(input.received_amount || 0);
      if (!input.customer_id || !input.receipt_date || !Number.isFinite(receivedAmount) || receivedAmount <= 0) {
        throw new Error("Customer, receipt date, and received amount are required.");
      }
      const [customers] = await this.pool.query(
        "SELECT id, name, phone FROM CafeCustomers WHERE id = ? OR name = ? LIMIT 1",
        [String(input.customer_id), String(input.customer_name || "")],
      );
      if (!customers[0]) throw new Error("The selected customer was not found.");
      input.customer_id = customers[0].id;
      input.customer_name = customers[0].name;
      const [balanceRows] = await this.pool.query(`
        SELECT
          COALESCE((SELECT SUM(due_amount) FROM CafeSales WHERE customer_id = ?), 0) AS credit_due,
          COALESCE((SELECT SUM(received_amount) FROM DueReceived WHERE customer_id = ? AND id <> ?), 0) AS received_due`,
        [input.customer_id, input.customer_id, String(input.id || input.receiptId || "")],
      );
      const previousDue = Math.max(
        Number(balanceRows[0]?.credit_due || 0) -
        Number(balanceRows[0]?.received_due || 0),
        0,
      );
      if (receivedAmount > previousDue) {
        throw new Error(`Received amount cannot exceed the customer's due amount of ${previousDue.toFixed(2)}.`);
      }
      input.previous_due_amount = previousDue;
      input.received_amount = receivedAmount;
      input.remaining_due_amount = Math.max(previousDue - receivedAmount, 0);
    }
    if (table === "StaffPayments") {
      if (!input.employee_id || !input.employee_name || !input.payment_date || Number(input.paid_amount || 0) <= 0) {
        throw new Error("Staff member, payment amount, and payment date are required.");
      }
    }
    if (table === "Purchases" && input.grand_total == null && Array.isArray(input.items)) {
      input.grand_total = input.items.reduce((sum, item) => sum + Number(item.amount ?? (item.quantity || 0) * (item.unitPrice ?? item.price ?? 0)), 0);
    }
    if (table === "Purchases") {
      if (!input.vendor_id || !input.purchase_date) {
        throw new Error("Vendor and purchase date are required.");
      }
      const [vendors] = await this.pool.query(
        "SELECT id FROM Vendors WHERE id = ? OR name = ? LIMIT 1",
        [String(input.vendor_id), String(input.vendor_name || "")],
      );
      if (!vendors[0]) throw new Error("The selected vendor does not exist in the database.");
      input.vendor_id = vendors[0].id;
      input.grand_total = Number(input.grand_total || 0);
      input.paid_amount = Number(input.paid_amount || 0);
      input.due_amount = Math.max(input.grand_total - input.paid_amount, 0);
      input.payment_status = input.paid_amount >= input.grand_total ? "Paid" : input.paid_amount > 0 ? "Partial" : "Due";
    }
    if (table === "CafeMenu" && input.category_id == null && input.categoryId != null) input.category_id = input.categoryId;
    if (table === "CafeMenu" && input.category_id != null) {
      const categoryValue = String(input.category_id).trim();
      const [categories] = await this.pool.query(
        "SELECT id FROM CafeCategories WHERE id = ? OR name = ? LIMIT 1",
        [categoryValue, categoryValue],
      );
      if (!categories[0]) throw new Error("The selected café category does not exist.");
      input.category_id = categories[0].id;
    }
    if (table === "Users" && input.password) input.password_hash = hash(input.password);
    if (table === "Users" && input.role_id == null && input.role) {
      const [roles] = await this.pool.query("SELECT id FROM Roles WHERE id = ? OR name = ? LIMIT 1", [String(input.role), String(input.role).toUpperCase()]);
      if (roles[0]) input.role_id = roles[0].id;
    }
    const relationshipTables = new Set(["StudentPayments", "VendorPayments", "StaffPayments", "DueReceived", "CustomerPayments"]);
    let id = String(input.id || (table === "ReportSubmissions" ? input.submissionId :
      (relationshipTables.has(table)
      ? (input.paymentId || input.receiptId)
      : table === "CafeMenu"
        ? input.menuId
        : table === "Payroll"
          ? input.payrollId
        : input.courseId || input.studentId || input.employeeId || input.vendorId || input.purchaseId || input.billId || input.saleId || input.tableId || input.categoryId || input.userId || input.roleId)) || idFor(table.toLowerCase()));
    if (table === "Payroll" && !input.id && !input.payrollId) {
      const [payrollRows] = await this.pool.query(
        "SELECT id FROM Payroll WHERE employee_id = ? AND payroll_month = ? LIMIT 1",
        [input.employee_id, input.payroll_month],
      );
      id = String(payrollRows[0]?.id || `payroll-${input.employee_id}-${input.payroll_month}`);
    }
    if (table === "Staff" && !input.id && input.originalEmployeeId) {
      const [staffRows] = await this.pool.query(
        "SELECT id FROM Staff WHERE employee_id = ? LIMIT 1",
        [String(input.originalEmployeeId).trim()],
      );
      if (staffRows[0]) id = String(staffRows[0].id);
    }
    if (table === "Courses") {
      const hasExplicitId = Boolean(input.id || input.courseId);
      const courseName = String(input.course_name || input.courseName || "").trim();
      const duration = String(input.duration || "").trim();
      const totalFee = Number(input.total_fee ?? input.totalFee ?? 0);
      if (!courseName || !duration || !Number.isFinite(totalFee) || totalFee < 0) {
        throw new Error("Course name, duration, and a valid non-negative fee are required.");
      }
      input.course_name = courseName;
      input.duration = duration;
      input.total_fee = String(input.total_fee ?? input.totalFee);
      const [duplicates] = hasExplicitId ? [[]] : await this.pool.query(
        `SELECT id FROM Courses
         WHERE lower(trim(course_name)) = lower(trim(?))
           AND lower(trim(duration)) = lower(trim(?))
           AND CAST(total_fee AS REAL) = CAST(? AS REAL)
           AND id <> ?
         LIMIT 1`,
        [courseName, duration, totalFee, id],
      );
      if (duplicates[0]) {
        throw new Error("A course with the same name, duration, and fee already exists.");
      }
    }
    const [existing] = await this.pool.query(
      `SELECT ${table === "Students" || table === "Staff" ? "*" : "id"} FROM \`${table}\` WHERE id = ? LIMIT 1`,
      [id],
    );
    const createdAt = input.createdAt ? new Date(input.createdAt) : now();
    const updatedAt = now();
    const storedInput = { ...input };
    if (table === "Students" || table === "Staff") {
      const identifier = input.registrationNumber || input.registration_number || input.employeeId || input.employee_id || id;
      const folderColumn = table === 'Students' ? 'student_folder' : 'staff_folder';
      storedInput[folderColumn] = existing[0]?.[folderColumn] || input[folderColumn] || null;
      const files = require('./person-files');
      const previousPhoto = files.parse(existing[0]?.passport_photo, existing[0]?.passport_photo || null);
      const previousDocuments = files.parse(existing[0]?.documents, []);
      storedInput.passportPhoto = input.passportPhoto?.base64
        ? await this.storeMedia(table, id, 'photo', input.passportPhoto, identifier) : previousPhoto;
      storedInput.passport_photo = storedInput.passportPhoto ? JSON.stringify(storedInput.passportPhoto) : null;
      const documents = Array.isArray(previousDocuments) ? previousDocuments.slice() : [];
      for (const document of Array.isArray(input.documents) ? input.documents : []) {
        if (!document?.base64) continue;
        const saved = await this.storeMedia(table, id, 'document', document, identifier);
        const index = documents.findIndex(item => (item.fileName || item.name) === saved.fileName);
        if (index >= 0) documents[index] = saved; else documents.push(saved);
      }
      storedInput.documents = documents;
    }
    const dataInput = { ...storedInput };
    if (table === "Students" || table === "Staff") {
      if (dataInput.passportPhoto && typeof dataInput.passportPhoto === "object") {
        dataInput.passportPhoto = { ...dataInput.passportPhoto };
      }
      if (Array.isArray(dataInput.documents)) dataInput.documents = dataInput.documents.map((document) => ({ ...document }));
    }
    if (table === 'Students' || table === 'Staff') {
      delete dataInput.student; delete dataInput.staff; delete dataInput.passportPhoto;
      dataInput.passport_photo = storedInput.passport_photo; dataInput.documents = storedInput.documents;
    }
    const data = JSON.stringify({ ...dataInput, id, createdAt: input.createdAt || createdAt.toISOString(), updatedAt: updatedAt.toISOString() });
    const columns = COLUMNS[table] || [];
    const fieldNames = await this.tableColumns(table);
    const values = columns.map((column) => {
      let value = storedInput[column] ??  input[camel(column)];
      if (table === "CafeSales" && column === "sale_date" && value == null) value = now();
      if (column === "status") value = value || "Active";
      if ((column === "passport_photo") && value && typeof value === "object") value = JSON.stringify(value);
      if (column === "documents" || column === "items_ordered") value = value == null || value === "" ? null : JSON.stringify(value);
      if (value === "") value = null;
      return value ?? null;
    });
    if (existing.length) {
      const writable = columns.filter((column, index) =>
        !(table === "Users" && column === "password_hash" && values[index] == null),
      );
      const params = writable.map((column) => values[columns.indexOf(column)]);
      const assignments = writable.map((column) => `\`${column}\` = ?`);
      if (fieldNames.includes("updated_at") && table !== "CafeTables" && table !== "CafeCategories" && table !== "CafeMenu" && table !== "CafeCustomers" && table !== "Inventory") {
        assignments.push("updated_at = ?");
        params.push(updatedAt);
      }
      if (fieldNames.includes("data_json")) {
        assignments.push("data_json = ?");
        params.push(data);
      }
      params.push(id);
      await this.pool.query(`UPDATE \`${table}\` SET ${assignments.join(", ")} WHERE id = ?`, params);
    } else {
      const names = ["id", ...columns];
      const insertValues = [id, ...values];
      if (fieldNames.includes("created_at")) { names.push("created_at"); insertValues.push(createdAt); }
      if (fieldNames.includes("updated_at")) { names.push("updated_at"); insertValues.push(updatedAt); }
      if (fieldNames.includes("data_json")) {
        names.push("data_json");
        insertValues.push(data);
      }
      await this.pool.query(`INSERT INTO \`${table}\` (${names.map((name) => `\`${name}\``).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, insertValues);
    }
    if (table === "Purchases" && Array.isArray(input.items)) {
      await this.pool.query("DELETE FROM PurchaseItems WHERE purchase_id = ?", [id]);
      for (const item of input.items) {
        const quantity = Number(item.quantity ?? item.qty ?? 0);
        const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
        const amount = Number(item.amount ?? quantity * unitPrice);
        await this.pool.query(
          `INSERT INTO PurchaseItems
            (id, purchase_id, item_name, quantity, unit_price, amount, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            idFor("purchase-item"),
            id,
            String(item.itemName ?? item.name ?? "").trim(),
            quantity,
            unitPrice,
            amount,
            JSON.stringify(item),
          ],
        );
      }
    }
    if (table === "DueReceived") {
      await this.ensureCustomerPaymentsTable();
      await this.pool.query(`
        INSERT INTO CustomerPayments
          (id, customer_id, customer_name, payment_date, amount, payment_method,
           previous_due_amount, remaining_due_amount, remarks, created_at, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO UPDATE SET
          customer_id=excluded.customer_id, customer_name=excluded.customer_name,
          payment_date=excluded.payment_date, amount=excluded.amount,
          payment_method=excluded.payment_method,
          previous_due_amount=excluded.previous_due_amount,
          remaining_due_amount=excluded.remaining_due_amount,
          remarks=excluded.remarks, data_json=excluded.data_json`,
        [
          id, input.customer_id, input.customer_name, input.receipt_date,
          input.received_amount, input.payment_mode || "", input.previous_due_amount,
          input.remaining_due_amount, input.remarks || "", createdAt, data,
        ],
      );
      const [savedReceipt] = await this.pool.query(
        "SELECT id FROM DueReceived WHERE id = ? LIMIT 1",
        [id],
      );
      const [savedPayment] = await this.pool.query(
        "SELECT id FROM CustomerPayments WHERE id = ? LIMIT 1",
        [id],
      );
      if (!savedReceipt[0] || !savedPayment[0]) {
        throw new Error("Customer payment was not confirmed in the database.");
      }
    }
    const result = { ...storedInput, id, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
    if (table === "CreditSales" || table === "DueReceived") {
      await this.refreshCustomerLedger(input.customer_id);
    }
    if (table === "CafeSales" && Number(input.due_amount || 0) > 0 && input.customer_id) {
      await this.save("CreditSales", {
        id: `credit-${id}`,
        customer_id: input.customer_id,
        customer_name: input.customer_name || "",
        customer_phone: input.customer_phone || "",
        sale_date: input.sale_date || createdAt,
        table_no: input.table_no || "",
        total_bill: Number(input.total_bill || 0),
        paid_amount: Number(input.paid_amount || 0),
        due_amount: Number(input.due_amount || 0),
        payment_method: input.payment_method || "",
        items_ordered: input.items_ordered || "",
      });
    }
    if (table === "CafeSales" && input.customer_id) {
      await this.refreshCustomerLedger(input.customer_id);
    }
    if (table === "Purchases" || table === "VendorPayments") {
      await this.refreshVendorLedger(input.vendor_id);
    }
    if (table === "CafeCategories") {
      result.categoryId = id;
      result.categoryName = input.name || input.categoryName;
    }
    if (table === "DueReceived") {
      result.receiptId = id;
      result.paymentId = id;
      result.customerId = input.customer_id;
      result.customerName = input.customer_name;
      result.previousDueAmount = Number(input.previous_due_amount || 0);
      result.remainingDueAmount = Number(input.remaining_due_amount || 0);
      const [ledgerRows] = await this.pool.query(
        `SELECT customer_id, total_credit_amount, total_received_amount, total_due_amount
         FROM CustomerLedger
         WHERE customer_id = ?
         LIMIT 1`,
        [input.customer_id],
      );
      if (!ledgerRows[0]) {
        throw new Error("Customer payment was saved, but the customer ledger was not updated.");
      }
      result.ledger = {
        totalCredit: Number(ledgerRows[0].total_credit_amount || 0),
        totalReceived: Number(ledgerRows[0].total_received_amount || 0),
        totalDue: Number(ledgerRows[0].total_due_amount || 0),
      };
    }
    if (table === "Purchases") result.billId = id;
    if (table === "VendorPayments" || table === "StaffPayments") {
      result.paymentId = id;
      result.voucherNo = id;
      result.paymentDate = input.payment_date;
      result.paymentMethod = input.payment_method;
      result.paidAmount = Number(input.paid_amount || 0);
      result.payeeId = table === "VendorPayments" ? input.vendor_id : input.employee_id;
      result.payeeName = table === "VendorPayments" ? input.vendor_name : input.employee_name;
      result.previousDue = Number(input.previousDue ?? input.previous_due_amount ?? 0);
      result.remainingDue = Number(input.remainingDue ?? input.remaining_due_amount ?? 0);
      result.advanceAmount = Number(input.advanceAmount || 0);
      result.remarks = input.notes || input.remarks || "";
      if (table === "VendorPayments") result.panVatNo = input.panVatNo || input.pan_vat_no || "";
    }
    return result;
  }

  async tableColumns(table) {
    const [rows] = await this.pool.query(`PRAGMA table_info(\`${table}\`)`);
    return rows.map((row) => row.name);
  }

  async remove(table, payload) {
    if (table === TABLES.students) {
      const role = String(payload?.role || "").trim().toUpperCase();
      const username = String(payload?.username || "").trim().toLowerCase();
      const userId = String(payload?.userId || "").trim();
      const isAdministrator = ["ADMIN", "ADMINISTRATOR"].includes(role)
        || username === "admin"
        || userId === "USR-0001";
      if (!isAdministrator) throw new Error("Only an administrator can delete student records.");
    }
    let id = payload && (payload.id || payload.courseId || payload.studentId || payload.employeeId || payload.vendorId || payload.billId);
    if (!id) throw new Error("A record id is required.");
    if (table === TABLES.students) {
      const [studentRows] = await this.pool.query(
        "SELECT id FROM Students WHERE id = ? OR registration_number = ? LIMIT 1",
        [String(id), String(id)],
      );
      id = studentRows[0]?.id;
      if (!id) throw new Error("The selected student was not found.");
    }
    if (table === TABLES.staff) {
      const staffLookup = String(payload.employeeId || payload.id || "").trim();
      const [staffRows] = await this.pool.query(
        "SELECT id FROM Staff WHERE id = ? OR employee_id = ? LIMIT 1",
        [staffLookup, staffLookup],
      );
      id = staffRows[0]?.id;
      if (!id) throw new Error("The selected staff member was not found.");
    }
    await this.pool.transaction(async () => {
      if (table === TABLES.students) {
        await this.pool.query(
          "DELETE FROM StudentDocuments WHERE student_id = ?",
          [String(id)],
        );
        await this.pool.query(
          "DELETE FROM StudentMedia WHERE entity_table = 'Students' AND entity_id = ?",
          [String(id)],
        );
      }
      if (table === TABLES.staff) {
        // Keep payroll history, but remove the foreign-key value before deleting
        // the staff row. The original employee ID remains in data_json.
        await this.pool.query(
          "UPDATE Payroll SET employee_id = NULL WHERE employee_id = (SELECT employee_id FROM Staff WHERE id = ?)",
          [String(id)],
        );
        await this.pool.query(
          "DELETE FROM StaffDocuments WHERE staff_id = ?",
          [String(id)],
        );
        await this.pool.query(
          "DELETE FROM StudentMedia WHERE entity_table = 'Staff' AND entity_id = ?",
          [String(id)],
        );
      }
      await this.pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [String(id)]);
    });
    return { id: String(id) };
  }

  async status(table, payload) {
    const id = payload && (payload.id || payload.studentId || payload.employeeId || payload.tableId || payload.menuId || payload.customerId);
    if (!id) throw new Error("A record id is required.");
    const value = payload.status || (payload.active === false ? "Inactive" : "Active");
    await this.pool.query(`UPDATE \`${table}\` SET status = ?, data_json = JSON_SET(data_json, '$.status', ?) WHERE id = ?`, [value, value, String(id)]);
    return { id: String(id), status: value };
  }

  async authenticate(payload) {
    const [rows] = await this.pool.query("SELECT u.*, r.name AS role FROM Users u LEFT JOIN Roles r ON r.id=u.role_id WHERE u.username = ? AND u.status = 'Active' LIMIT 1", [String(payload.username || "").trim()]);
    const row = rows[0];
    if (!row || !require('./initial-import').verifyPassword(payload.password, row.password_hash)) throw new Error("Invalid username or password.");
    const profile = this.output(row);
    const [rolePermissions] = await this.pool.query(
      "SELECT p.permission_key FROM Permissions p JOIN RolePermissions rp ON rp.permission_id=p.id WHERE rp.role_id=? AND rp.allowed=1",
      [row.role_id],
    );
    const [userPermissions] = await this.pool.query(
      "SELECT p.permission_key, up.allowed FROM Permissions p JOIN UserPermissions up ON up.permission_id=p.id WHERE up.user_id=?",
      [row.id],
    );
    const permissions = new Map(rolePermissions.map((item) => [item.permission_key, true]));
    userPermissions.forEach((item) => permissions.set(item.permission_key, Boolean(item.allowed)));
    const reportsSessionToken = ""; // Local login never depends on the report server.
    return { userId: row.id, username: row.username, fullName: row.full_name, role: profile.role || "CASHIER", permissions: [...permissions].filter(([, allowed]) => allowed).map(([key]) => key), sessionToken: crypto.randomBytes(24).toString("hex"), reportsSessionToken, loginAt: new Date().toISOString() };
  }

  async payrollSummary() {
    const [rows] = await this.pool.query(`
      SELECT p.employee_id, COALESCE(s.full_name, p.employee_id) AS employee_name,
        COALESCE(SUM(p.net_salary), 0) AS total_earnings,
        COALESCE(SUM(p.total_paid), 0) + COALESCE(sp.total_paid, 0) AS total_paid,
        CASE WHEN COALESCE(SUM(p.net_salary), 0) - COALESCE(SUM(p.total_paid), 0) - COALESCE(sp.total_paid, 0) > 0
          THEN COALESCE(SUM(p.net_salary), 0) - COALESCE(SUM(p.total_paid), 0) - COALESCE(sp.total_paid, 0)
          ELSE 0 END AS total_due,
        CASE WHEN COALESCE(SUM(p.net_salary), 0) - COALESCE(SUM(p.total_paid), 0) - COALESCE(sp.total_paid, 0) > 0
          THEN COALESCE(SUM(p.net_salary), 0) - COALESCE(SUM(p.total_paid), 0) - COALESCE(sp.total_paid, 0)
          ELSE 0 END AS total_outstanding,
        0 AS total_advance
      FROM Payroll p
      LEFT JOIN Staff s ON s.employee_id = p.employee_id
      LEFT JOIN (
        SELECT employee_id, SUM(paid_amount) AS total_paid
        FROM StaffPayments
        GROUP BY employee_id
      ) sp ON sp.employee_id = p.employee_id
      GROUP BY p.employee_id, s.full_name
      ORDER BY employee_name ASC`);
    return rows.map((row) => ({
      ...row,
      "Employee ID": row.employee_id,
      "Employee Name": row.employee_name,
      "Total Earnings": Number(row.total_earnings || 0),
      "Total Paid": Number(row.total_paid || 0),
      "Total Due": Number(row.total_due || 0),
      "Total Outstanding": Number(row.total_outstanding || 0),
      "Total Advance": Number(row.total_advance || 0),
    }));
  }

  async salesSummary(operation) {
    const [rows] = await this.pool.query("SELECT * FROM CafeSales WHERE DATE(sale_date) = date('now', 'localtime')");
    const sales = rows.map((row) => this.outputRecord("CafeSales", row));
    if (operation !== "todaySummary") return sales;
    const [[{ date }]] = await this.pool.query("SELECT date('now', 'localtime') AS date");
    const sum = (select) => Math.round(rows.reduce((total, row) => total + select(row), 0) * 100) / 100;
    return {
      date, sales, transactionCount: rows.length,
      total: sum(row => Number(row.total_bill || 0)),
      cash: sum(row => String(row.payment_method).toLowerCase() === "cash" ? Number(row.paid_amount || 0) : 0),
      qr: sum(row => String(row.payment_method).toLowerCase() === "qr" ? Number(row.paid_amount || 0) : 0),
      credit: sum(row => Number(row.due_amount || 0)),
    };
  }

  async customerLedger() {
    await this.ensureCustomerLedgerTable();
    await this.refreshAllCustomerLedgers();
    const [rows] = await this.pool.query(`
      SELECT customer_id AS customerId, customer_name AS customerName,
        total_credit_amount AS totalCredit,
        total_received_amount AS totalReceived,
        total_due_amount AS totalDue,
        last_transaction_date AS lastTransactionDate
      FROM CustomerLedger
      ORDER BY customer_name ASC`);
    return rows;
  }

  async vendorLedger() {
    await this.refreshAllVendorLedgers();
    const [rows] = await this.pool.query(`
      SELECT vendor_id AS vendorId, vendor_name AS vendorName,
        total_purchased_amount AS totalPurchased,
        total_paid_amount AS totalPaid,
        total_due_amount AS totalDue,
        last_transaction_date AS lastTransactionDate
      FROM VendorLedger
      ORDER BY vendor_name ASC`);
    return rows;
  }

  async ensureVendorLedgerTable() {
    await this.pool.ready;
  }

  async refreshVendorLedger(vendorId) {
    const id = String(vendorId || "").trim();
    if (!id) return;
    await this.ensureVendorLedgerTable();
    const [rows] = await this.pool.query(`
      SELECT v.id AS vendor_id, v.name AS vendor_name,
        COALESCE(p.total_purchased_amount, 0) AS total_purchased_amount,
        COALESCE(p.total_paid_amount, 0) + COALESCE(vp.total_paid_amount, 0) AS total_paid_amount,
        MAX(
          COALESCE(p.total_purchased_amount, 0) -
          COALESCE(p.total_paid_amount, 0) -
          COALESCE(vp.total_paid_amount, 0), 0
        ) AS total_due_amount,
        CASE
          WHEN p.last_transaction_date IS NULL THEN vp.last_transaction_date
          WHEN vp.last_transaction_date IS NULL THEN p.last_transaction_date
          WHEN p.last_transaction_date >= vp.last_transaction_date THEN p.last_transaction_date
          ELSE vp.last_transaction_date
        END AS last_transaction_date
      FROM Vendors v
      LEFT JOIN (
        SELECT vendor_id, SUM(grand_total) AS total_purchased_amount,
          SUM(paid_amount) AS total_paid_amount, MAX(purchase_date) AS last_transaction_date
        FROM Purchases GROUP BY vendor_id
      ) p ON p.vendor_id = v.id
      LEFT JOIN (
        SELECT vendor_id, SUM(paid_amount) AS total_paid_amount, MAX(payment_date) AS last_transaction_date
        FROM VendorPayments GROUP BY vendor_id
      ) vp ON vp.vendor_id = v.id
      WHERE v.id = ?`, [id]);
    if (!rows[0]) return;
    await this.pool.query(`
      INSERT INTO VendorLedger
        (vendor_id, vendor_name, total_purchased_amount, total_paid_amount, total_due_amount, last_transaction_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET
        vendor_name=excluded.vendor_name,
        total_purchased_amount=excluded.total_purchased_amount,
        total_paid_amount=excluded.total_paid_amount,
        total_due_amount=excluded.total_due_amount,
        last_transaction_date=excluded.last_transaction_date,
        updated_at=excluded.updated_at`,
      [rows[0].vendor_id, rows[0].vendor_name, rows[0].total_purchased_amount, rows[0].total_paid_amount, rows[0].total_due_amount, rows[0].last_transaction_date, now()]);
  }

  async refreshAllVendorLedgers() {
    await this.ensureVendorLedgerTable();
    const [vendors] = await this.pool.query("SELECT id FROM Vendors");
    for (const vendor of vendors) await this.refreshVendorLedger(vendor.id);
  }

  async ensureCustomerLedgerTable() {
    await this.pool.ready;
  }

  async ensureCustomerPaymentsTable() {
    await this.pool.ready;
  }

  async refreshCustomerLedger(customerId) {
    const id = String(customerId || "").trim();
    if (!id) return;
    await this.ensureCustomerLedgerTable();
    await this.ensureCustomerPaymentsTable();
    const [rows] = await this.pool.query(`
      SELECT c.id AS customer_id, c.name AS customer_name,
        COALESCE(cs.total_credit_amount, 0) AS total_credit_amount,
        COALESCE(cs.total_paid_amount, 0) + COALESCE(dr.total_received_amount, 0) AS total_received_amount,
        MAX(COALESCE(cs.total_due_amount, 0) - COALESCE(dr.total_received_amount, 0), 0) AS total_due_amount,
        CASE
          WHEN cs.last_transaction_date IS NULL THEN dr.last_transaction_date
          WHEN dr.last_transaction_date IS NULL THEN cs.last_transaction_date
          WHEN cs.last_transaction_date >= dr.last_transaction_date THEN cs.last_transaction_date
          ELSE dr.last_transaction_date
        END AS last_transaction_date
      FROM CafeCustomers c
      LEFT JOIN (
        SELECT customer_id,
          SUM(total_bill) AS total_credit_amount,
          SUM(paid_amount) AS total_paid_amount,
          SUM(due_amount) AS total_due_amount,
          MAX(sale_date) AS last_transaction_date
        FROM CafeSales
        WHERE customer_id IS NOT NULL AND customer_id <> ''
        GROUP BY customer_id
      ) cs ON cs.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(received_amount) AS total_received_amount, MAX(receipt_date) AS last_transaction_date
        FROM DueReceived GROUP BY customer_id
      ) dr ON dr.customer_id = c.id
      WHERE c.id = ?`,
      [id],
    );
    if (!rows[0]) return;
    await this.pool.query(`
      INSERT INTO CustomerLedger
        (customer_id, customer_name, total_credit_amount, total_received_amount, total_due_amount, last_transaction_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET
        customer_name=excluded.customer_name,
        total_credit_amount=excluded.total_credit_amount,
        total_received_amount=excluded.total_received_amount,
        total_due_amount=excluded.total_due_amount,
        last_transaction_date=excluded.last_transaction_date,
        updated_at=excluded.updated_at`,
      [rows[0].customer_id, rows[0].customer_name, rows[0].total_credit_amount, rows[0].total_received_amount, rows[0].total_due_amount, rows[0].last_transaction_date, now()],
    );
  }

  async refreshAllCustomerLedgers() {
    await this.ensureCustomerLedgerTable();
    const [customers] = await this.pool.query("SELECT id FROM CafeCustomers");
    for (const customer of customers) await this.refreshCustomerLedger(customer.id);
  }

  async permissions() {
    const [permissions] = await this.pool.query("SELECT id, permission_key, name, description FROM Permissions ORDER BY permission_key");
    const [rolePermissions] = await this.pool.query(
      "SELECT rp.role_id AS `Role ID`, p.permission_key AS `Permission Key`, rp.allowed AS Allowed FROM RolePermissions rp JOIN Permissions p ON p.id=rp.permission_id",
    );
    const [userPermissions] = await this.pool.query(
      "SELECT up.user_id AS `User ID`, p.permission_key AS `Permission Key`, up.allowed AS Allowed FROM UserPermissions up JOIN Permissions p ON p.id=up.permission_id",
    );
    return {
      permissions: permissions.map((permission) => {
        const [module = "other", action = "view"] = String(permission.permission_key).split(".");
        return { "Permission ID": permission.id, "Permission Key": permission.permission_key, Name: permission.name, Description: permission.description, Module: module, Action: action };
      }),
      roles: await this.list(TABLES.roles),
      userPermissions: userPermissions.map((row) => ({ ...row, Allowed: Boolean(row.Allowed) })),
      rolePermissions: rolePermissions.map((row) => ({ ...row, Allowed: Boolean(row.Allowed) })),
    };
  }

  async savePermissionAssignment(payload = {}) {
    const targetType = String(payload.targetType || "").toLowerCase();
    const targetId = String(payload.targetId || "").trim();
    const permissionKey = String(payload.permissionKey || "").trim();
    if (!["role", "user"].includes(targetType) || !targetId || !permissionKey) {
      throw new Error("A valid permission target and permission key are required.");
    }
    const [permissions] = await this.pool.query("SELECT id FROM Permissions WHERE permission_key=? LIMIT 1", [permissionKey]);
    if (!permissions[0]) throw new Error(`Permission "${permissionKey}" does not exist.`);
    const allowed = payload.allowed === true || String(payload.allowed).toLowerCase() === "true" || Number(payload.allowed) === 1;
    if (targetType === "role") {
      await this.pool.query(
        "INSERT INTO RolePermissions (role_id, permission_id, allowed) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET allowed=excluded.allowed",
        [targetId, permissions[0].id, allowed ? 1 : 0],
      );
    } else {
      await this.pool.query(
        "INSERT INTO UserPermissions (user_id, permission_id, allowed) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET allowed=excluded.allowed",
        [targetId, permissions[0].id, allowed ? 1 : 0],
      );
    }
    return { targetType, targetId, permissionKey, allowed };
  }

  async authenticateReports(payload = {}) {
    const { endpoint } = await this.reportConfig();
    if (!payload.username || !payload.password) throw new Error("Enter your reporting account username and password.");
    const [localUsers] = await this.pool.query(
      "SELECT u.id FROM Users u WHERE u.username = ? AND u.status = 'Active' LIMIT 1",
      [String(payload.username).trim()],
    );
    if (localUsers[0]) {
      const localUser = await this.authenticate(payload);
      if (!Array.isArray(localUser.permissions) || !localUser.permissions.includes("reports.view")) {
        throw new Error("This account does not have permission to submit reports.");
      }
    }
    const requestBody = JSON.stringify({ action: "authenticateUser", username: payload.username, password: payload.password });
    // Login may be retried without resending a report or its attachments.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await postReportRequest(endpoint, requestBody, 60000);
        const raw = typeof response.text === "function" ? await response.text() : "";
        let body;
        try {
          body = raw ? JSON.parse(raw) : await response.json();
        } catch (_) {
          const detail = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
          throw Object.assign(
            new Error(reportHttpError(response.status, `Google reporting sign-in returned a non-JSON response${detail ? `: ${detail}` : "."} Check the deployed /exec URL.`)),
            { code: `REPORT_HTTP_${response.status || "UNKNOWN"}`, retryable: [408, 502, 503, 504].includes(response.status) },
          );
        }
        if (!response.ok) throw Object.assign(new Error(reportHttpError(response.status, body?.data?.message || body?.message)), {
          code: `REPORT_HTTP_${response.status}`, retryable: [408, 502, 503, 504].includes(response.status),
        });
        if (!body.success || !body.data?.sessionToken) {
          const message = body.data?.message || body.message || "Report sign-in failed.";
          const remoteCode = body.data?.error || body.code || body.message;
          if (/session.*(?:invalid|expired|rejected)/i.test(message) || remoteCode === 'REPORT_AUTH_REQUIRED') {
            throw Object.assign(new Error('The Google reporting endpoint rejected the login request as an expired session. Check that the configured /exec URL uses the latest Code.gs deployment; login must be allowed without an existing session.'), { code: 'REPORT_LOGIN_SESSION_REJECTED' });
          }
          throw Object.assign(new Error(message), { code: /invalid.*(?:username|password)|incorrect.*(?:username|password)/i.test(message) ? 'REPORT_AUTH_INVALID' : 'REPORT_SIGNIN_FAILED' });
        }
        if (!Array.isArray(body.data.permissions) || !body.data.permissions.includes("reports.view")) {
          throw Object.assign(new Error("This reporting account does not have permission to submit reports."), { code: 'ACCESS_DENIED' });
        }
        return { sessionToken: body.data.sessionToken, endpoint };
      } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError' || /timeout|timed out|aborted/i.test(error.message)) {
          error = Object.assign(new Error('Google reporting sign-in timed out. No reports were sent by this sign-in request. Check your connection and try again.'), { code: 'REPORT_AUTH_TIMEOUT', retryable: true });
        } else if (/fetch failed|network|offline/i.test(error.message)) {
          error = Object.assign(new Error('Unable to connect to Google reporting. Check your internet connection and try again.'), { code: 'REPORT_NETWORK', retryable: true });
        }
        if (attempt === 0 && error.retryable) continue;
        throw error;
      }
    }
  }

  async saveReportConfig(payload) {
    const endpoint = String(payload.endpoint || "").trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) {
      throw new Error("Enter a deployed Google Apps Script /exec URL.");
    }
    await this.pool.query("INSERT INTO SystemSettings (`key`, `value`, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (`key`) DO UPDATE SET `value`=excluded.`value`, updated_at=excluded.updated_at", ["reports.appsScriptUrl", endpoint]);
    if (String(payload.apiToken || "").trim()) {
      await this.pool.query("INSERT INTO SystemSettings (`key`, `value`, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (`key`) DO UPDATE SET `value`=excluded.`value`, updated_at=excluded.updated_at", ["reports.apiToken", String(payload.apiToken).trim()]);
    }
    return { endpoint };
  }

  async reportConfig() {
    const [settings] = await this.pool.query("SELECT `key`, `value` FROM SystemSettings WHERE `key` IN ('reports.appsScriptUrl','reports.apiToken')");
    const settingMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    return {
      endpoint: String(settingMap["reports.appsScriptUrl"] || process.env.REPORTS_APPS_SCRIPT_URL || DEFAULT_REPORTS_APPS_SCRIPT_URL),
      tokenConfigured: Boolean(settingMap["reports.apiToken"] || process.env.REPORTS_API_TOKEN),
      endpointConfigured: Boolean(settingMap["reports.appsScriptUrl"] || process.env.REPORTS_APPS_SCRIPT_URL || DEFAULT_REPORTS_APPS_SCRIPT_URL),
      reports: [
        { key: "student-report", name: "Student Report", table: "Students, StudentLedger, StudentPayments", dateColumn: null, sheets: ["Students", "StudentLedger", "StudentPayments"], package: ["students", "student-ledger", "student-payments"] },
        { key: "students", name: "Student Records", table: "Students", dateColumn: null, sheets: ["Students"], visible: false },
        { key: "student-ledger", name: "Student Ledger", table: "StudentLedger", dateColumn: null, sheets: ["StudentLedger"], visible: false },
        { key: "staff", name: "Staff Report", table: "Staff", dateColumn: null, sheets: ["Staff"] },
        { key: "courses", name: "Course Report", table: "Courses", dateColumn: null, sheets: ["Courses"] },
        { key: "vendor-report", name: "Vendor Report", table: "Vendors, VendorLedger", dateColumn: null, sheets: ["Vendors", "Vendor Ledger"], package: ["vendors", "vendor-ledger"] },
        { key: "vendors", name: "Vendor Records", table: "Vendors", dateColumn: null, sheets: ["Vendors"], visible: false },
        { key: "vendor-ledger", name: "Vendor Ledger", table: "VendorLedger", dateColumn: null, sheets: ["Vendor Ledger"] },
        { key: "vendor-payments", name: "Vendor Payments", table: "VendorPayments", dateColumn: "payment_date", sheets: ["VendorPayments"] },
        { key: "cafe-sales", name: "Café Report", table: "CafeSales", dateColumn: "sale_date", sheets: ["CafeSales"] },
        { key: "credit-customers", name: "Credit Customers", table: "CafeCustomers", dateColumn: null, sheets: ["CafeCustomers"] },
        { key: "credit-customer-ledger", name: "Credit Customer Ledger", table: "CustomerLedger", dateColumn: null, sheets: ["CustomerLedger"] },
        { key: "expenses", name: "Expense Report", table: "Expenses", dateColumn: "expense_date", sheets: ["Expenses"] },
        { key: "purchases", name: "Purchase Report", table: "Purchases", dateColumn: "purchase_date", sheets: ["Purchases"] },
        { key: "inventory", name: "Inventory Report", table: "Inventory", dateColumn: null, sheets: ["Inventory"] },
        { key: "payroll", name: "Payroll Report", table: "Payroll", dateColumn: null, sheets: ["Payroll"] },
        { key: "student-payments", name: "Student Payments", table: "StudentPayments", dateColumn: "payment_date", sheets: ["StudentPayments"], visible: false },
        ...[
          ["customer-payments", "Customer Payments", "CustomerPayments", "payment_date"],
          ["due-received", "Due Receipts", "DueReceived", "receipt_date"],
          ["credit-sales", "Credit Sales", "CreditSales", "sale_date"],
          ["staff-payments", "Staff Payments", "StaffPayments", "payment_date"],
          ["cafe-tables", "Cafe Tables", "CafeTables", null],
          ["cafe-menu", "Cafe Menu", "CafeMenu", null],
          ["cafe-categories", "Cafe Categories", "CafeCategories", null],
          ["cafe-daily-sales", "Cafe Closing Report", "DayClosings", "closing_date"],
          ["purchase-items", "Purchase Items", "PurchaseItems", null],
          ["inventory-transactions", "Inventory Transactions", "InventoryTransactions", null],
          ["cafe-recipes", "Cafe Recipes", "CafeRecipes", null],
          ["cafe-recipe-items", "Cafe Recipe Items", "CafeRecipeItems", null],
          ["payroll-summary", "Payroll Summary", "PayrollSummary", null],
          ["payment-out", "Payments Out", "PaymentOut", "payment_date"],
        ].map(([key, name, table, dateColumn]) => ({ key, name, table, dateColumn, sheets: [key === "cafe-daily-sales" ? "CafeDailySales" : table] })),
      ],
    };
  }

  async reportPreview(payload = {}) {
    const config = await this.reportConfig();
    const report = config.reports.find((item) => item.key === String(payload.reportKey || ""));
    if (!report || report.package) throw new Error("Select an individual report section for preview.");
    const from = String(payload.dateFrom || "1900-01-01");
    const to = String(payload.dateTo || "2999-12-31");
    this.validateReportDates(from,to);
    let query;
    let params = [];
    if (report.key === "cafe-daily-sales") {
      query = `SELECT 'cafe-closing-' || DATE(sale_date) AS id, DATE(sale_date) AS date,
        DATE(sale_date) AS display_date,
        ROUND(SUM(CASE WHEN lower(payment_method) = 'cash' THEN paid_amount ELSE 0 END), 2) AS cash_sales,
        ROUND(SUM(CASE WHEN lower(payment_method) = 'qr' THEN paid_amount ELSE 0 END), 2) AS qr_sales,
        ROUND(SUM(due_amount), 2) AS credit_sales, ROUND(SUM(total_bill), 2) AS total_sales,
        COUNT(*) AS transaction_count, 'Submitted' AS closing_status
        FROM CafeSales WHERE DATE(sale_date) BETWEEN ? AND ? GROUP BY DATE(sale_date) ORDER BY DATE(sale_date)`;
      params = [from, to];
    } else if (report.key === "payroll-summary") {
      const rows = (await this.payrollSummary()).map(row => ({ ...row, id: row.employee_id }));
      return { report, dateFrom: from, dateTo: to, rows, count: rows.length };
    } else if (report.key === "payment-out") {
      query = `SELECT vp.id, vp.vendor_id AS payee_id, v.name AS payee_name, 'Vendor' AS payee_type, vp.payment_date,
        vp.paid_amount, vp.payment_method, vp.notes AS remarks FROM VendorPayments vp
        LEFT JOIN Vendors v ON v.id = vp.vendor_id WHERE DATE(vp.payment_date) BETWEEN ? AND ?
        UNION ALL SELECT sp.id, sp.employee_id, s.full_name, 'Staff', sp.payment_date, sp.paid_amount, sp.payment_method, sp.notes
        FROM StaffPayments sp LEFT JOIN Staff s ON s.employee_id = sp.employee_id WHERE DATE(sp.payment_date) BETWEEN ? AND ?`;
      params = [from, to, from, to];
    } else if (report.key === "purchases") {
      query = `SELECT p.*, v.name AS vendor_name,
        ROUND(COALESCE(p.grand_total,0)+COALESCE(p.discount,0)-COALESCE(p.tax,0),2) AS subtotal
        FROM Purchases p LEFT JOIN Vendors v ON v.id=p.vendor_id
        WHERE DATE(p.purchase_date) BETWEEN ? AND ? ORDER BY p.purchase_date`;
      params = [from,to];
    } else if (report.key === "payroll") {
      query = `SELECT p.*, s.full_name AS employee_name FROM Payroll p
        LEFT JOIN Staff s ON s.employee_id=p.employee_id ORDER BY p.id`;
    } else if (report.key === "cafe-menu") {
      query = `SELECT m.*, c.name AS category_name FROM CafeMenu m
        LEFT JOIN CafeCategories c ON c.id=m.category_id ORDER BY m.id`;
    } else if (report.key === "inventory-transactions") {
      query = `SELECT t.*, t.inventory_id AS item_id, i.item_name, i.unit,
        t.created_at AS transaction_date FROM InventoryTransactions t
        LEFT JOIN Inventory i ON i.id=t.inventory_id ORDER BY t.id`;
    } else if (report.key === "cafe-recipe-items") {
      query = `SELECT r.*, r.inventory_id AS inventory_item_id,
        i.item_name AS inventory_item_name, i.unit FROM CafeRecipeItems r
        LEFT JOIN Inventory i ON i.id=r.inventory_id ORDER BY r.id`;
    } else if (report.key === "student-ledger") {
      query = `
        SELECT s.id AS ledger_id, s.id AS student_id,
          s.registration_number, s.full_name AS student_name,
          MAX(
            COALESCE(s.registration_fee, 0) +
            COALESCE(s.training_course_fee, 0) -
            COALESCE(s.discount, 0), 0
          ) AS total_fee_amount,
          COALESCE(p.total_paid_amount, 0) AS total_paid_amount,
          MAX(
            COALESCE(s.registration_fee, 0) +
            COALESCE(s.training_course_fee, 0) -
            COALESCE(s.discount, 0) -
            COALESCE(p.total_paid_amount, 0), 0
          ) AS total_due_amount,
          p.last_payment_date,
          datetime('now', 'localtime') AS updated_at
        FROM Students s
        LEFT JOIN (
          SELECT student_id, SUM(amount) AS total_paid_amount,
            MAX(payment_date) AS last_payment_date
          FROM StudentPayments
          WHERE DATE(payment_date) BETWEEN ? AND ?
          GROUP BY student_id
        ) p ON p.student_id = s.id
        ORDER BY s.full_name ASC`;
      params = [from, to];
    } else if (report.key === "vendor-ledger") {
      await this.refreshAllVendorLedgers();
      query = `
        SELECT l.vendor_id AS id, l.vendor_id, COALESCE(v.name,l.vendor_name) AS vendor_name,
          v.pan_vat_no, v.address, v.contact_no, v.email, v.status,
          l.total_purchased_amount, l.total_paid_amount, l.total_due_amount AS due_amount
        FROM VendorLedger l LEFT JOIN Vendors v ON v.id=l.vendor_id
        ORDER BY vendor_name ASC`;
    } else if (report.key === "credit-customer-ledger") {
      await this.refreshAllCustomerLedgers();
      query = `
        SELECT customer_id AS ledger_id, customer_id, customer_name,
          total_credit_amount, total_received_amount, total_due_amount,
          last_transaction_date, updated_at
        FROM CustomerLedger
        ORDER BY customer_name ASC`;
      params = [];
    } else if (report.key === "credit-customers") {
      query = `
        SELECT c.id AS customer_id, c.name AS customer_name, c.phone,
          c.address, c.credit_limit, c.status,
          COALESCE(cs.total_credit_amount, 0) AS total_credit_amount,
          COALESCE(cs.total_paid_amount, 0) + COALESCE(dr.total_received_amount, 0) AS total_received_amount,
          MAX(
            COALESCE(cs.total_due_amount, 0) -
            COALESCE(dr.total_received_amount, 0), 0
          ) AS total_due_amount,
          datetime('now', 'localtime') AS updated_at
        FROM CafeCustomers c
        LEFT JOIN (
          SELECT customer_id,
            SUM(total_bill) AS total_credit_amount,
            SUM(paid_amount) AS total_paid_amount,
            SUM(due_amount) AS total_due_amount
          FROM CafeSales
          WHERE customer_id IS NOT NULL AND customer_id <> ''
            AND DATE(sale_date) BETWEEN ? AND ?
          GROUP BY customer_id
        ) cs ON cs.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(received_amount) AS total_received_amount
          FROM DueReceived
          WHERE DATE(receipt_date) BETWEEN ? AND ?
          GROUP BY customer_id
        ) dr ON dr.customer_id = c.id
        ORDER BY c.name ASC`;
      params = [from, to, from, to];
    } else {
      query = report.dateColumn
        ? `SELECT * FROM \`${report.table}\` WHERE DATE(\`${report.dateColumn}\`) BETWEEN ? AND ? ORDER BY \`${report.dateColumn}\` ASC`
        : `SELECT * FROM \`${report.table}\` ORDER BY id ASC`;
      params = report.dateColumn ? [from, to] : [];
    }
    const [rows] = await this.pool.query(query, params);
    return { report, dateFrom: from, dateTo: to, rows: rows.map((row) => this.reportRow(this.outputRecord(report.table, row))), count: rows.length };
  }

  reportRow(row) {
    const banned = new Set(['passportphoto','passportsizephoto','documents','studentfolder','stafffolder','studentdrivefolder','employeedrivefolder','datajson','base64','localpath','filepath','path','passwordhash']);
    const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([key])=>!banned.has(key.toLowerCase().replace(/[^a-z0-9]/g,''))).map(([key,item])=>[key,clean(item)])) : value;
    return clean(this.output(row));
  }

  validateReportDates(from,to) {
    const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
    if (!valid(from) || !valid(to) || from > to) throw new Error('Choose valid report dates with From date on or before To date.');
  }

  async submitReport(payload = {}, onProgress = () => {}) {
    onProgress({ stage: 'preparing', detail: 'Preparing records for submission.' });
    const preview = payload.rows !== undefined ? payload : await this.reportPreview(payload);
    const configured = await this.reportConfig();
    const endpoint = String(configured.endpoint || DEFAULT_REPORTS_APPS_SCRIPT_URL).trim();
    const id = String(payload.submissionId || idFor("report"));
    const report = configured.reports.find(item => item.key === (payload.reportKey || preview.report?.key));
    if (!report || report.package) throw new Error("Unknown report section.");
    this.validateReportDates(String(preview.dateFrom || '1900-01-01'),String(preview.dateTo || '2999-12-31'));
    if (!Array.isArray(preview.rows) || preview.rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Report records are invalid. Create a new preview.');
    let reportRows = (preview.rows || []).map((row) => this.reportRow(row));
    const created = { id, report_key: report.key, report_name: report.name, date_from: preview.dateFrom, date_to: preview.dateTo, status: "Pending", rows_json: JSON.stringify(reportRows), submitted_by: payload.userId || null, submitted_at: null };
    await this.save("ReportSubmissions", created);
    await this.writeAudit(payload.userId, "SUBMIT_REPORT", report.key, id, { reportKey: report.key, dateFrom: preview.dateFrom, dateTo: preview.dateTo });
    if (!endpoint) {
      await this.pool.query("UPDATE ReportSubmissions SET status='Failed', error_message=? WHERE id=?", ["Reports endpoint is not configured. Set REPORTS_APPS_SCRIPT_URL.", id]);
      return { success: false, configured: false, submissionId: id, message: "Reports endpoint is not configured. Set REPORTS_APPS_SCRIPT_URL and retry." };
    }

    try {
      if (!payload.sessionToken) throw Object.assign(new Error("Sign in with your reporting username and password before submitting."), { code: "REPORT_AUTH_REQUIRED" });
      if (report.key === 'students' || report.key === 'staff') {
        const table = report.key === 'students' ? 'Students' : 'Staff';
        const [storedPeople] = await this.pool.query('SELECT * FROM ' + table + ' ORDER BY id');
        const peopleById = new Map(storedPeople.map(person => [String(person.id),person]));
        const people = reportRows.map(row => {
          const person = peopleById.get(String(row.id));
          if (!person) throw new Error('A previewed record no longer exists. Create a new preview before submitting.');
          return {...person,...row};
        });
        reportRows = await require('./person-files').prepareReports(this, table, people, endpoint, payload.sessionToken, onProgress);
        await this.pool.query('UPDATE ReportSubmissions SET rows_json=? WHERE id=?', [JSON.stringify(reportRows),id]);
      }
      if (report.key === "vendors") {
        reportRows = reportRows.map((row) => ({
          ...row,
          "Vendor ID": row["Vendor ID"] || row.vendorId || row.id || "",
          "Vendor Name": row["Vendor Name"] || row.vendorName || row.name || "",
        }));
        const invalidVendor = reportRows.find((row) => {
          const idValue = String(row["Vendor ID"] || "").trim();
          const name = String(row["Vendor Name"] || row.name || "").trim();
          const panVat = String(row.pan_vat_no || row["PAN/VAT No"] || "").trim();
          const contact = String(row.contact_no || row["Contact No"] || "").trim();
          const address = String(row.address || row.Address || "").trim();
          return !idValue && !(name && panVat) && !(name && contact && address);
        });
        if (invalidVendor) {
          throw Object.assign(
            new Error(`Vendor "${invalidVendor["Vendor Name"] || invalidVendor.name || "Unknown"}" is missing a Vendor ID or complete identity details (PAN/VAT, or contact and address).`),
            { code: "INVALID_VENDOR_DATA" }
          );
        }
        await this.pool.query("UPDATE ReportSubmissions SET rows_json=? WHERE id=?", [JSON.stringify(reportRows), id]);
      }
      onProgress({ stage: 'saving', detail: `Saving ${report.name} to Google Sheets.` });
      const requestBody = JSON.stringify({ action: "upsertReport", sessionToken: payload.sessionToken, submissionId: id, reportKey: report.key, reportName: report.name, dateFrom: preview.dateFrom, dateTo: preview.dateTo, rows: reportRows, userId: payload.userId || "", username: payload.username || "", role: payload.role || "" });
      let response;
      let body;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          response = await postReportRequest(endpoint, requestBody);
          const raw = typeof response.text === "function" ? await response.text() : null;
          if (raw !== null) {
            try {
              body = JSON.parse(raw);
            } catch (_) {
              throw Object.assign(
                new Error(reportHttpError(response.status, "The report endpoint returned a non-JSON response.")),
                { code: `REPORT_HTTP_${response.status || "UNKNOWN"}` },
              );
            }
          } else {
            body = await response.json();
          }
          if (response.ok || attempt === 2 || !/timeout|aborted|fetch failed|network/i.test(String(body.message || ""))) break;
        } catch (error) {
          if (attempt === 2 || !/timeout|aborted|fetch failed|network/i.test(String(error.message))) throw error;
        }
      }
      if (!response.ok) {
        throw Object.assign(new Error(reportHttpError(response.status, body?.data?.message || body?.message)), { code: `REPORT_HTTP_${response.status}` });
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('The reporting service returned an invalid response. Retry this report.');
      if (!body.success) throw Object.assign(new Error(body.data?.message || body.message || "Report submission failed."), { code: body.data?.error || body.code || (body.message === "ACCESS_DENIED" ? "ACCESS_DENIED" : undefined) });
      if (!body.data || !body.data.sheet || !Number.isInteger(body.data.rows) || body.data.rows < 0) {
        throw new Error("Google Apps Script did not confirm the destination sheet and row count. Redeploy code.gs and verify REPORTS_APPS_SCRIPT_URL.");
      }
      const normalizedSheet = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!(report.sheets || [report.table]).some(sheet => normalizedSheet(sheet) === normalizedSheet(body.data.sheet))) throw new Error('Google Sheets confirmed an unexpected destination sheet');
      const confirmedInputRows = body.data.requestedRows ?? body.data.rows;
      if (confirmedInputRows !== reportRows.length) throw new Error('Google Sheets confirmed a different row count');
      if (body.data.rows > reportRows.length || (reportRows.length > 0 && body.data.rows === 0) ||
          (body.data.verifiedRows !== undefined && body.data.verifiedRows !== body.data.rows)) {
        throw new Error('Google Sheets did not verify the submitted records');
      }
      if (report.key === 'students' || report.key === 'staff') {
        for (const row of reportRows) await this.pool.query("UPDATE StudentMedia SET upload_status='SUBMITTED_TO_SHEETS' WHERE entity_table=? AND entity_id=? AND active=1 AND drive_file_id IS NOT NULL AND file_hash=uploaded_hash", [report.key === 'students' ? 'Students' : 'Staff',row.id]);
      }
      await this.pool.query("UPDATE ReportSubmissions SET status='Submitted', remote_id=?, submitted_at=datetime('now', 'localtime'), error_message=NULL WHERE id=?", [String(body.data?.submissionId || id), id]);
      return { ...body, submissionId: id, sheet: body.data.sheet, rows: body.data.rows, sheetUrl: body.data.sheetUrl };
    } catch (error) {
      const safeMessage = reportNetworkError(error);
      await this.pool.query("UPDATE ReportSubmissions SET status='Failed', error_message=? WHERE id=?", [safeMessage, id]);
      return { success: false, submissionId: id, message: safeMessage, code: error.code };
    }
  }

  async retryReport(payload = {}, onProgress = () => {}) {
    const [rows] = await this.pool.query("SELECT * FROM ReportSubmissions WHERE id=? LIMIT 1", [String(payload.submissionId || "")]);
    if (!rows[0]) throw new Error("Submission not found.");
    let data;
    try { data = JSON.parse(rows[0].rows_json); } catch (_) { throw new Error('Saved report records could not be read. Create a new preview instead of retrying.'); }
    if (!Array.isArray(data)) throw new Error('Saved report records are invalid. Create a new preview instead of retrying.');
    return this.submitReport({ submissionId: rows[0].id, reportKey: rows[0].report_key, dateFrom: rows[0].date_from, dateTo: rows[0].date_to, rows: data, userId: payload.userId, sessionToken: payload.sessionToken }, onProgress);
  }

  async writeAudit(userId, action, entity, entityId, details) {
    if (!userId) return;
    try {
      await this.pool.query("INSERT INTO AuditLog (id,user_id,action,entity,entity_id,created_at,data_json) VALUES (?,?,?,?,?,datetime('now', 'localtime'),?)", [idFor("audit"), userId, action, entity, entityId, JSON.stringify(details || {})]);
    } catch (_) { /* audit must not make a successful submission fail */ }
  }

  async reportSubmissions(payload = {}) {
    const limit = Math.min(Math.max(Number(payload.limit || 50), 1), 200);
    const [rows] = await this.pool.query("SELECT * FROM ReportSubmissions ORDER BY submitted_at DESC, id DESC LIMIT ?", [limit]);
    return rows;
  }
}

let instance;
async function getDatabase(options) {
  if (!instance) instance = new Database(undefined, options);
  await instance.open();
  return instance;
}

async function closeDatabase() {
  if (instance) {
    await instance.pool.end();
    instance = null;
  }
}

module.exports = { Database, getDatabase, closeDatabase };
