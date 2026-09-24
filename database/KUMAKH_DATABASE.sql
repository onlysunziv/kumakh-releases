-- Derived from mysql.sql; applied transactionally by sqlite-pool.js.
CREATE TABLE IF NOT EXISTS Courses (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  course_name TEXT COLLATE NOCASE NOT NULL,
  duration TEXT COLLATE NOCASE,
  total_fee TEXT NOT NULL DEFAULT '0.00',
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_status ON Courses (status);

CREATE TABLE IF NOT EXISTS Students (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  registration_number TEXT COLLATE NOCASE UNIQUE,
  joining_date TEXT,
  full_name TEXT COLLATE NOCASE NOT NULL,
  student_contact TEXT COLLATE NOCASE,
  date_of_birth TEXT,
  gender TEXT COLLATE NOCASE,
  marital_status TEXT COLLATE NOCASE,
  address TEXT,
  parents_name TEXT COLLATE NOCASE,
  relationship TEXT COLLATE NOCASE,
  parents_contact TEXT COLLATE NOCASE,
  course_id TEXT COLLATE NOCASE,
  course_name TEXT COLLATE NOCASE,
  course_duration TEXT COLLATE NOCASE,
  registration_fee TEXT NOT NULL DEFAULT '0.00',
  training_course_fee TEXT NOT NULL DEFAULT '0.00',
  discount TEXT NOT NULL DEFAULT '0.00',
  passport_photo TEXT,
  documents TEXT,
  student_folder TEXT,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_students_course
    FOREIGN KEY (course_id) REFERENCES Courses(id)
);

CREATE INDEX IF NOT EXISTS idx_students_course_id ON Students (course_id);

CREATE INDEX IF NOT EXISTS idx_students_status ON Students (status);

CREATE INDEX IF NOT EXISTS idx_students_registration_number ON Students (registration_number);

CREATE TABLE IF NOT EXISTS StudentDocuments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  student_id TEXT COLLATE NOCASE NOT NULL,
  name TEXT COLLATE NOCASE,
  path TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_student_documents_student
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student_id ON StudentDocuments (student_id);

CREATE TABLE IF NOT EXISTS StudentMedia (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  entity_table TEXT COLLATE NOCASE NOT NULL,
  entity_id TEXT COLLATE NOCASE NOT NULL,
  media_type TEXT COLLATE NOCASE NOT NULL,
  file_name TEXT COLLATE NOCASE,
  mime_type TEXT COLLATE NOCASE,
  total_chunks INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  local_path TEXT,
  file_hash TEXT,
  uploaded_hash TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  drive_folder_id TEXT,
  upload_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_upload_date TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_student_media_entity ON StudentMedia (entity_table, entity_id);

CREATE TABLE IF NOT EXISTS StudentMediaChunks (
  media_id TEXT COLLATE NOCASE NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_data TEXT NOT NULL,
  PRIMARY KEY (media_id, chunk_index),
  CONSTRAINT fk_student_media_chunks_media
    FOREIGN KEY (media_id) REFERENCES StudentMedia(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Staff (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  employee_id TEXT COLLATE NOCASE UNIQUE,
  full_name TEXT COLLATE NOCASE NOT NULL,
  passport_photo TEXT,
  address TEXT,
  gender TEXT COLLATE NOCASE,
  blood_group TEXT COLLATE NOCASE,
  mobile_number TEXT COLLATE NOCASE,
  email TEXT COLLATE NOCASE,
  citizenship_number TEXT COLLATE NOCASE,
  personal_pan_no TEXT COLLATE NOCASE,
  marital_status TEXT COLLATE NOCASE,
  home_number TEXT COLLATE NOCASE,
  alternative_number TEXT COLLATE NOCASE,
  date_of_birth TEXT,
  father_name TEXT COLLATE NOCASE,
  mother_name TEXT COLLATE NOCASE,
  grandfather_name TEXT COLLATE NOCASE,
  grandmother_name TEXT COLLATE NOCASE,
  spouse_name TEXT COLLATE NOCASE,
  account_number TEXT COLLATE NOCASE,
  account_name TEXT COLLATE NOCASE,
  bank_name TEXT COLLATE NOCASE,
  swift_code TEXT COLLATE NOCASE,
  job_title TEXT COLLATE NOCASE,
  report_to TEXT COLLATE NOCASE,
  department TEXT COLLATE NOCASE,
  company_name TEXT COLLATE NOCASE,
  company_address TEXT,
  company_contact_no TEXT COLLATE NOCASE,
  joining_date TEXT,
  basic_salary TEXT NOT NULL DEFAULT '0.00',
  documents TEXT,
  staff_folder TEXT,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_employee_id ON Staff (employee_id);

CREATE INDEX IF NOT EXISTS idx_staff_status ON Staff (status);

CREATE INDEX IF NOT EXISTS idx_staff_department ON Staff (department);

CREATE TABLE IF NOT EXISTS StaffDocuments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  staff_id TEXT COLLATE NOCASE NOT NULL,
  name TEXT COLLATE NOCASE,
  path TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_staff_documents_staff
    FOREIGN KEY (staff_id) REFERENCES Staff(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_id ON StaffDocuments (staff_id);

CREATE TABLE IF NOT EXISTS Vendors (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE NOT NULL,
  pan_vat_no TEXT COLLATE NOCASE,
  address TEXT,
  contact_no TEXT COLLATE NOCASE,
  email TEXT COLLATE NOCASE,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_status ON Vendors (status);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON Vendors (name);

CREATE TABLE IF NOT EXISTS Expenses (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE,
  category TEXT COLLATE NOCASE,
  amount TEXT NOT NULL DEFAULT '0.00',
  expense_date TEXT,
  notes TEXT,
  payment_method TEXT COLLATE NOCASE,
  `reference` TEXT COLLATE NOCASE,
  remarks TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON Expenses (expense_date);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON Expenses (category);

CREATE TABLE IF NOT EXISTS Purchases (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  invoice_no TEXT COLLATE NOCASE,
  vendor_id TEXT COLLATE NOCASE,
  purchase_date TEXT,
  grand_total TEXT NOT NULL DEFAULT '0.00',
  paid_amount TEXT NOT NULL DEFAULT '0.00',
  due_amount TEXT NOT NULL DEFAULT '0.00',
  payment_status TEXT COLLATE NOCASE,
  payment_method TEXT COLLATE NOCASE,
  discount TEXT NOT NULL DEFAULT '0.00',
  tax TEXT NOT NULL DEFAULT '0.00',
  remarks TEXT,
  bill_file_id TEXT COLLATE NOCASE,
  bill_file_url TEXT,
  digital_bill_url TEXT,
  created_by TEXT COLLATE NOCASE,
  updated_at TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_purchases_vendor
    FOREIGN KEY (vendor_id) REFERENCES Vendors(id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id ON Purchases (vendor_id);

CREATE INDEX IF NOT EXISTS idx_purchases_date ON Purchases (purchase_date);

CREATE TABLE IF NOT EXISTS PurchaseItems (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  purchase_id TEXT COLLATE NOCASE NOT NULL,
  item_name TEXT COLLATE NOCASE,
  quantity TEXT,
  unit_price TEXT,
  amount TEXT,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_purchase_items_purchase
    FOREIGN KEY (purchase_id) REFERENCES Purchases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON PurchaseItems (purchase_id);

CREATE TABLE IF NOT EXISTS PurchasePayments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  purchase_id TEXT COLLATE NOCASE NOT NULL,
  amount TEXT,
  payment_date TEXT,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_purchase_payments_purchase
    FOREIGN KEY (purchase_id) REFERENCES Purchases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id ON PurchasePayments (purchase_id);

CREATE TABLE IF NOT EXISTS Payroll (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  employee_id TEXT COLLATE NOCASE,
  payroll_month TEXT COLLATE NOCASE,
  designation TEXT COLLATE NOCASE,
  basic_salary TEXT NOT NULL DEFAULT '0.00',
  normal_working_days TEXT NOT NULL DEFAULT '26.00',
  days_worked TEXT NOT NULL DEFAULT '0.00',
  earned_salary TEXT NOT NULL DEFAULT '0.00',
  bonus TEXT NOT NULL DEFAULT '0.00',
  allowance TEXT NOT NULL DEFAULT '0.00',
  total_earning TEXT NOT NULL DEFAULT '0.00',
  deduction TEXT NOT NULL DEFAULT '0.00',
  tds TEXT NOT NULL DEFAULT '0.00',
  net_salary TEXT NOT NULL DEFAULT '0.00',
  total_paid TEXT NOT NULL DEFAULT '0.00',
  due_salary TEXT NOT NULL DEFAULT '0.00',
  payment_status TEXT COLLATE NOCASE,
  payment_method TEXT COLLATE NOCASE,
  payment_date TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_payroll_employee
    FOREIGN KEY (employee_id) REFERENCES Staff(employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee_month ON Payroll (employee_id, payroll_month);

CREATE TABLE IF NOT EXISTS Inventory (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  item_name TEXT COLLATE NOCASE,
  quantity TEXT NOT NULL DEFAULT '0.000',
  unit TEXT COLLATE NOCASE,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_status ON Inventory (status);

CREATE TABLE IF NOT EXISTS InventoryTransactions (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  inventory_id TEXT COLLATE NOCASE,
  quantity TEXT,
  transaction_type TEXT COLLATE NOCASE,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_inventory_transactions_inventory
    FOREIGN KEY (inventory_id) REFERENCES Inventory(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id ON InventoryTransactions (inventory_id);

CREATE TABLE IF NOT EXISTS CafeCategories (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE NOT NULL,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cafe_categories_status ON CafeCategories (status);

CREATE TABLE IF NOT EXISTS CafeMenu (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE NOT NULL,
  category_id TEXT COLLATE NOCASE,
  price TEXT NOT NULL DEFAULT '0.00',
  quantity TEXT NOT NULL DEFAULT '0.000',
  unit TEXT COLLATE NOCASE,
  cost_price TEXT NOT NULL DEFAULT '0.00',
  description TEXT,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL,
  CONSTRAINT fk_cafe_menu_category
    FOREIGN KEY (category_id) REFERENCES CafeCategories(id)
);

CREATE INDEX IF NOT EXISTS idx_cafe_menu_category_id ON CafeMenu (category_id);

CREATE TABLE IF NOT EXISTS CafeTables (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  table_no TEXT COLLATE NOCASE NOT NULL UNIQUE,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS CafeCustomers (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE,
  phone TEXT COLLATE NOCASE,
  credit_limit TEXT NOT NULL DEFAULT '0.00',
  address TEXT,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cafe_customers_phone ON CafeCustomers (phone);

CREATE TABLE IF NOT EXISTS CafeSales (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  sale_date TEXT NOT NULL,
  total_bill TEXT NOT NULL DEFAULT '0.00',
  payment_status TEXT COLLATE NOCASE,
  table_no TEXT COLLATE NOCASE,
  customer_id TEXT COLLATE NOCASE,
  customer_name TEXT COLLATE NOCASE,
  customer_phone TEXT COLLATE NOCASE,
  discount_amount TEXT NOT NULL DEFAULT '0.00',
  vat_amount TEXT NOT NULL DEFAULT '0.00',
  tendered_amount TEXT NOT NULL DEFAULT '0.00',
  paid_amount TEXT NOT NULL DEFAULT '0.00',
  change_amount TEXT NOT NULL DEFAULT '0.00',
  due_amount TEXT NOT NULL DEFAULT '0.00',
  payment_method TEXT COLLATE NOCASE,
  items_ordered TEXT,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_cafe_sales_customer
    FOREIGN KEY (customer_id) REFERENCES CafeCustomers(id)
);

CREATE INDEX IF NOT EXISTS idx_cafe_sales_sale_date ON CafeSales (sale_date);

CREATE INDEX IF NOT EXISTS idx_cafe_sales_customer_id ON CafeSales (customer_id);

CREATE TABLE IF NOT EXISTS CafeSaleItems (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  sale_id TEXT COLLATE NOCASE NOT NULL,
  menu_id TEXT COLLATE NOCASE,
  quantity TEXT,
  amount TEXT,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_cafe_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES CafeSales(id) ON DELETE CASCADE,
  CONSTRAINT fk_cafe_sale_items_menu
    FOREIGN KEY (menu_id) REFERENCES CafeMenu(id)
);

CREATE INDEX IF NOT EXISTS idx_cafe_sale_items_sale_id ON CafeSaleItems (sale_id);

CREATE TABLE IF NOT EXISTS CafePayments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  sale_id TEXT COLLATE NOCASE NOT NULL,
  amount TEXT,
  method TEXT COLLATE NOCASE,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_cafe_payments_sale
    FOREIGN KEY (sale_id) REFERENCES CafeSales(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cafe_payments_sale_id ON CafePayments (sale_id);

CREATE TABLE IF NOT EXISTS CafeRecipes (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS CafeRecipeItems (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  recipe_id TEXT COLLATE NOCASE NOT NULL,
  inventory_id TEXT COLLATE NOCASE,
  quantity TEXT,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_cafe_recipe_items_recipe
    FOREIGN KEY (recipe_id) REFERENCES CafeRecipes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cafe_recipe_items_inventory
    FOREIGN KEY (inventory_id) REFERENCES Inventory(id)
);

CREATE TABLE IF NOT EXISTS Roles (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  name TEXT COLLATE NOCASE NOT NULL UNIQUE,
  description TEXT COLLATE NOCASE,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Users (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  username TEXT COLLATE NOCASE NOT NULL UNIQUE,
  password_hash TEXT COLLATE NOCASE NOT NULL,
  full_name TEXT COLLATE NOCASE,
  employee_id TEXT COLLATE NOCASE,
  role_id TEXT COLLATE NOCASE,
  status TEXT COLLATE NOCASE NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES Roles(id)
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON Users (role_id);

CREATE TABLE IF NOT EXISTS Permissions (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  permission_key TEXT COLLATE NOCASE NOT NULL UNIQUE,
  name TEXT COLLATE NOCASE,
  description TEXT COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS RolePermissions (
  role_id TEXT COLLATE NOCASE NOT NULL,
  permission_id TEXT COLLATE NOCASE NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES Permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS UserPermissions (
  user_id TEXT COLLATE NOCASE NOT NULL,
  permission_id TEXT COLLATE NOCASE NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES Permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS StudentPayments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  student_id TEXT COLLATE NOCASE,
  student_name TEXT COLLATE NOCASE,
  payment_date TEXT,
  course TEXT COLLATE NOCASE,
  course_fee TEXT NOT NULL DEFAULT '0.00',
  total_paid TEXT NOT NULL DEFAULT '0.00',
  amount TEXT NOT NULL DEFAULT '0.00',
  payment_mode TEXT COLLATE NOCASE,
  payment_type TEXT COLLATE NOCASE,
  remarks TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS VendorPayments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  vendor_id TEXT COLLATE NOCASE,
  vendor_name TEXT COLLATE NOCASE,
  payment_date TEXT,
  paid_amount TEXT NOT NULL DEFAULT '0.00',
  payment_method TEXT COLLATE NOCASE,
  notes TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor_id ON VendorPayments (vendor_id);

CREATE TABLE IF NOT EXISTS StaffPayments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  employee_id TEXT COLLATE NOCASE,
  employee_name TEXT COLLATE NOCASE,
  payment_date TEXT,
  paid_amount TEXT NOT NULL DEFAULT '0.00',
  payment_method TEXT COLLATE NOCASE,
  notes TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_payments_employee_id ON StaffPayments (employee_id);

CREATE TABLE IF NOT EXISTS CreditSales (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  customer_id TEXT COLLATE NOCASE,
  customer_name TEXT COLLATE NOCASE,
  customer_phone TEXT COLLATE NOCASE,
  sale_date TEXT,
  table_no TEXT COLLATE NOCASE,
  total_bill TEXT NOT NULL DEFAULT '0.00',
  paid_amount TEXT NOT NULL DEFAULT '0.00',
  due_amount TEXT NOT NULL DEFAULT '0.00',
  payment_method TEXT COLLATE NOCASE,
  items_ordered TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_sales_customer_id ON CreditSales (customer_id);

CREATE TABLE IF NOT EXISTS DueReceived (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  customer_id TEXT COLLATE NOCASE,
  customer_name TEXT COLLATE NOCASE,
  receipt_date TEXT,
  previous_due_amount TEXT NOT NULL DEFAULT '0.00',
  received_amount TEXT NOT NULL DEFAULT '0.00',
  remaining_due_amount TEXT NOT NULL DEFAULT '0.00',
  payment_mode TEXT COLLATE NOCASE,
  remarks TEXT,
  created_at TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS CustomerPayments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  customer_id TEXT COLLATE NOCASE NOT NULL,
  customer_name TEXT COLLATE NOCASE NOT NULL,
  payment_date TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '0.00',
  payment_method TEXT COLLATE NOCASE,
  previous_due_amount TEXT NOT NULL DEFAULT '0.00',
  remaining_due_amount TEXT NOT NULL DEFAULT '0.00',
  remarks TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON CustomerPayments (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON CustomerPayments (payment_date);

CREATE TABLE IF NOT EXISTS CustomerLedger (
  customer_id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  customer_name TEXT COLLATE NOCASE NOT NULL,
  total_credit_amount TEXT NOT NULL DEFAULT '0.00',
  total_received_amount TEXT NOT NULL DEFAULT '0.00',
  total_due_amount TEXT NOT NULL DEFAULT '0.00',
  last_transaction_date TEXT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_due ON CustomerLedger (total_due_amount);

CREATE TABLE IF NOT EXISTS VendorLedger (
  vendor_id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  vendor_name TEXT COLLATE NOCASE NOT NULL,
  total_purchased_amount TEXT NOT NULL DEFAULT '0.00',
  total_paid_amount TEXT NOT NULL DEFAULT '0.00',
  total_due_amount TEXT NOT NULL DEFAULT '0.00',
  last_transaction_date TEXT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_due ON VendorLedger (total_due_amount);

CREATE TABLE IF NOT EXISTS DayClosings (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  closing_date TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_day_closings_date ON DayClosings (closing_date);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  user_id TEXT COLLATE NOCASE,
  action TEXT COLLATE NOCASE,
  entity TEXT COLLATE NOCASE,
  entity_id TEXT COLLATE NOCASE,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  CONSTRAINT fk_audit_log_user
    FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON AuditLog (created_at);

CREATE TABLE IF NOT EXISTS SyncQueue (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  entity TEXT COLLATE NOCASE,
  entity_id TEXT COLLATE NOCASE,
  operation TEXT COLLATE NOCASE,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON SyncQueue (created_at);

CREATE TABLE IF NOT EXISTS SystemSettings (
  `key` TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  `value` TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ReportSubmissions (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  report_key TEXT COLLATE NOCASE NOT NULL,
  report_name TEXT COLLATE NOCASE NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  status TEXT COLLATE NOCASE NOT NULL,
  rows_json TEXT NOT NULL,
  remote_id TEXT COLLATE NOCASE,
  error_message TEXT,
  submitted_by TEXT COLLATE NOCASE,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_submissions_status ON ReportSubmissions (status);

CREATE INDEX IF NOT EXISTS idx_report_submissions_dates ON ReportSubmissions (date_from, date_to);

CREATE TABLE IF NOT EXISTS FileAttachments (
  id TEXT COLLATE NOCASE NOT NULL PRIMARY KEY,
  entity TEXT COLLATE NOCASE,
  entity_id TEXT COLLATE NOCASE,
  file_name TEXT COLLATE NOCASE,
  file_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_entity ON FileAttachments (entity, entity_id);
