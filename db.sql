-- KUMAKH College Management System
-- SQLite schema for kumakh.db
--
-- This schema mirrors the database contract used by electron/database.js.
-- Application-specific fields that are not normalized yet are retained in
-- data_json so existing frontend payloads remain lossless.

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS Courses (
  id TEXT PRIMARY KEY,
  course_name TEXT NOT NULL,
  duration TEXT,
  total_fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS Students (
  id TEXT PRIMARY KEY,
  registration_number TEXT UNIQUE,
  joining_date TEXT,
  full_name TEXT NOT NULL,
  student_contact TEXT,
  date_of_birth TEXT,
  gender TEXT,
  marital_status TEXT,
  address TEXT,
  parents_name TEXT,
  relationship TEXT,
  parents_contact TEXT,
  course_id TEXT,
  course_name TEXT,
  course_duration TEXT,
  registration_fee REAL NOT NULL DEFAULT 0,
  training_course_fee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  passport_photo TEXT,
  documents TEXT,
  student_folder TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (course_id) REFERENCES Courses(id)
);

CREATE TABLE IF NOT EXISTS StudentDocuments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  name TEXT,
  path TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS StudentMedia (
  id TEXT PRIMARY KEY,
  entity_table TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  local_path TEXT,
  file_hash TEXT,
  uploaded_hash TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  drive_folder_id TEXT,
  upload_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_upload_date TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS StudentMediaChunks (
  media_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  chunk_data TEXT NOT NULL,
  PRIMARY KEY (media_id, chunk_index),
  FOREIGN KEY (media_id) REFERENCES StudentMedia(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Staff (
  id TEXT PRIMARY KEY,
  employee_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  passport_photo TEXT,
  address TEXT,
  gender TEXT,
  blood_group TEXT,
  mobile_number TEXT,
  email TEXT,
  citizenship_number TEXT,
  personal_pan_no TEXT,
  marital_status TEXT,
  home_number TEXT,
  alternative_number TEXT,
  date_of_birth TEXT,
  father_name TEXT,
  mother_name TEXT,
  grandfather_name TEXT,
  grandmother_name TEXT,
  spouse_name TEXT,
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT,
  swift_code TEXT,
  job_title TEXT,
  report_to TEXT,
  department TEXT,
  company_name TEXT,
  company_address TEXT,
  company_contact_no TEXT,
  joining_date TEXT,
  basic_salary REAL NOT NULL DEFAULT 0,
  documents TEXT,
  staff_folder TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS StaffDocuments (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  name TEXT,
  path TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (staff_id) REFERENCES Staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pan_vat_no TEXT,
  address TEXT,
  contact_no TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS Expenses (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  amount REAL NOT NULL DEFAULT 0,
  expense_date TEXT,
  notes TEXT,
  payment_method TEXT,
  reference TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS Purchases (
  id TEXT PRIMARY KEY,
  invoice_no TEXT,
  vendor_id TEXT,
  purchase_date TEXT,
  grand_total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  due_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT,
  payment_method TEXT,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  remarks TEXT,
  bill_file_id TEXT,
  bill_file_url TEXT,
  digital_bill_url TEXT,
  created_by TEXT,
  updated_at TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (vendor_id) REFERENCES Vendors(id)
);

CREATE TABLE IF NOT EXISTS PurchaseItems (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  item_name TEXT,
  quantity REAL,
  unit_price REAL,
  amount REAL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (purchase_id) REFERENCES Purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PurchasePayments (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  amount REAL,
  payment_date TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (purchase_id) REFERENCES Purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Payroll (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  payroll_month TEXT,
  designation TEXT,
  basic_salary REAL NOT NULL DEFAULT 0,
  normal_working_days REAL NOT NULL DEFAULT 26,
  days_worked REAL NOT NULL DEFAULT 0,
  earned_salary REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  allowance REAL NOT NULL DEFAULT 0,
  total_earning REAL NOT NULL DEFAULT 0,
  deduction REAL NOT NULL DEFAULT 0,
  tds REAL NOT NULL DEFAULT 0,
  net_salary REAL NOT NULL DEFAULT 0,
  total_paid REAL NOT NULL DEFAULT 0,
  due_salary REAL NOT NULL DEFAULT 0,
  payment_status TEXT,
  payment_method TEXT,
  payment_date TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (employee_id) REFERENCES Staff(employee_id)
);

CREATE TABLE IF NOT EXISTS Inventory (
  id TEXT PRIMARY KEY,
  item_name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS InventoryTransactions (
  id TEXT PRIMARY KEY,
  inventory_id TEXT,
  quantity REAL,
  transaction_type TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (inventory_id) REFERENCES Inventory(id)
);

CREATE TABLE IF NOT EXISTS CafeCategories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CafeMenu (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT,
  price REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT,
  cost_price REAL NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (category_id) REFERENCES CafeCategories(id)
);

CREATE TABLE IF NOT EXISTS CafeTables (
  id TEXT PRIMARY KEY,
  table_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CafeCustomers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  credit_limit REAL NOT NULL DEFAULT 0,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CafeSales (
  id TEXT PRIMARY KEY,
  sale_date TEXT NOT NULL,
  total_bill REAL NOT NULL DEFAULT 0,
  payment_status TEXT,
  table_no TEXT,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  discount_amount REAL NOT NULL DEFAULT 0,
  vat_amount REAL NOT NULL DEFAULT 0,
  tendered_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  due_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  items_ordered TEXT,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CafeSaleItems (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  menu_id TEXT,
  quantity REAL,
  amount REAL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (sale_id) REFERENCES CafeSales(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES CafeMenu(id)
);

CREATE TABLE IF NOT EXISTS CafePayments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  amount REAL,
  method TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (sale_id) REFERENCES CafeSales(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CafeRecipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CafeRecipeItems (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  inventory_id TEXT,
  quantity REAL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (recipe_id) REFERENCES CafeRecipes(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES Inventory(id)
);

CREATE TABLE IF NOT EXISTS Roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  employee_id TEXT,
  role_id TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (role_id) REFERENCES Roles(id)
);

CREATE TABLE IF NOT EXISTS Permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS RolePermissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1 CHECK (allowed IN (0, 1)),
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES Permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS UserPermissions (
  user_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1 CHECK (allowed IN (0, 1)),
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES Permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS StudentPayments (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  student_name TEXT,
  payment_date TEXT,
  course TEXT,
  course_fee REAL NOT NULL DEFAULT 0,
  total_paid REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT,
  payment_type TEXT,
  remarks TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS VendorPayments (
  id TEXT PRIMARY KEY,
  vendor_id TEXT,
  vendor_name TEXT,
  payment_date TEXT,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS VendorLedger (
  vendor_id TEXT PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  total_purchased_amount REAL NOT NULL DEFAULT 0,
  total_paid_amount REAL NOT NULL DEFAULT 0,
  total_due_amount REAL NOT NULL DEFAULT 0,
  last_transaction_date TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS StaffPayments (
  id TEXT PRIMARY KEY,
  employee_id TEXT,
  employee_name TEXT,
  payment_date TEXT,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CustomerLedger (
  customer_id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  total_credit_amount REAL NOT NULL DEFAULT 0,
  total_received_amount REAL NOT NULL DEFAULT 0,
  total_due_amount REAL NOT NULL DEFAULT 0,
  last_transaction_date TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS CreditSales (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  sale_date TEXT,
  table_no TEXT,
  total_bill REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  due_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  items_ordered TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS DueReceived (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  customer_name TEXT,
  receipt_date TEXT,
  previous_due_amount REAL NOT NULL DEFAULT 0,
  received_amount REAL NOT NULL DEFAULT 0,
  remaining_due_amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT,
  remarks TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS CustomerPayments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT,
  previous_due_amount REAL NOT NULL DEFAULT 0,
  remaining_due_amount REAL NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS DayClosings (
  id TEXT PRIMARY KEY,
  closing_date TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE TABLE IF NOT EXISTS SyncQueue (
  id TEXT PRIMARY KEY,
  entity TEXT,
  entity_id TEXT,
  operation TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS SystemSettings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS FileAttachments (
  id TEXT PRIMARY KEY,
  entity TEXT,
  entity_id TEXT,
  file_name TEXT,
  file_path TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  drive_folder_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ReportSubmissions (
  id TEXT PRIMARY KEY,
  report_key TEXT NOT NULL,
  report_name TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  status TEXT NOT NULL,
  rows_json TEXT NOT NULL DEFAULT '[]',
  remote_id TEXT,
  error_message TEXT,
  submitted_by TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_course_id
  ON Students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_status
  ON Students(status);
CREATE INDEX IF NOT EXISTS idx_students_registration_number
  ON Students(registration_number);
CREATE INDEX IF NOT EXISTS idx_staff_employee_id
  ON Staff(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_status
  ON Staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_department
  ON Staff(department);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id
  ON Purchases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id
  ON PurchaseItems(purchase_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_month
  ON Payroll(employee_id, payroll_month);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id
  ON InventoryTransactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cafe_menu_category_id
  ON CafeMenu(category_id);
CREATE INDEX IF NOT EXISTS idx_cafe_sales_sale_date
  ON CafeSales(sale_date);
CREATE INDEX IF NOT EXISTS idx_cafe_sales_customer_id
  ON CafeSales(customer_id);
CREATE INDEX IF NOT EXISTS idx_cafe_sale_items_sale_id
  ON CafeSaleItems(sale_id);
CREATE INDEX IF NOT EXISTS idx_cafe_payments_sale_id
  ON CafePayments(sale_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON AuditLog(created_at);
CREATE INDEX IF NOT EXISTS idx_file_attachments_entity
  ON FileAttachments(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id
  ON StudentDocuments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_media_entity
  ON StudentMedia(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_student_media_drive_url
  ON StudentMedia(drive_url);
CREATE INDEX IF NOT EXISTS idx_student_media_chunks_media_id
  ON StudentMediaChunks(media_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_id
  ON StaffDocuments(staff_id);
CREATE INDEX IF NOT EXISTS idx_courses_status
  ON Courses(status);
CREATE INDEX IF NOT EXISTS idx_vendors_status
  ON Vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_name
  ON Vendors(name);
CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON Expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date
  ON Purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id
  ON PurchasePayments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_cafe_sales_table_no
  ON CafeSales(table_no);
CREATE INDEX IF NOT EXISTS idx_cafe_recipe_items_recipe_id
  ON CafeRecipeItems(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cafe_recipe_items_inventory_id
  ON CafeRecipeItems(inventory_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id
  ON RolePermissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id
  ON UserPermissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_student_id
  ON StudentPayments(student_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor_id
  ON VendorPayments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_employee_id
  ON StaffPayments(employee_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_customer_id
  ON CreditSales(customer_id);
CREATE INDEX IF NOT EXISTS idx_due_received_customer_id
  ON DueReceived(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id
  ON CustomerPayments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_due
  ON CustomerLedger(total_due_amount);
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_due
  ON VendorLedger(total_due_amount);
CREATE INDEX IF NOT EXISTS idx_day_closings_date
  ON DayClosings(closing_date);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
  ON SyncQueue(created_at);
CREATE INDEX IF NOT EXISTS idx_report_submissions_status
  ON ReportSubmissions(status);
CREATE INDEX IF NOT EXISTS idx_report_submissions_dates
  ON ReportSubmissions(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_file_attachments_drive_url
  ON FileAttachments(drive_url);

-- Default account created by the Electron database initializer.
-- Password is "admin", stored as SHA-256 to match electron/database.js.
INSERT OR IGNORE INTO Roles
  (id, name, status, created_at, updated_at, data_json)
VALUES
  ('role-admin', 'ADMIN', 'Active', datetime('now'), datetime('now'),
   '{"name":"ADMIN","role":"ADMIN"}');

INSERT OR IGNORE INTO Users
  (id, username, password_hash, full_name, role_id, status,
   created_at, updated_at, data_json)
VALUES
  ('user-admin', 'admin',
   '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
   'Administrator', 'role-admin', 'Active', datetime('now'), datetime('now'),
   '{"username":"admin","fullName":"Administrator","role":"ADMIN"}');

COMMIT;
