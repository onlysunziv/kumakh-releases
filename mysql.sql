-- KUMAKH College Management System
-- MySQL 8.0+ schema and seed data
-- Run this file in MySQL to create the complete application database.

CREATE DATABASE IF NOT EXISTS kumakhpos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kumakhpos;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS Courses (
  id VARCHAR(100) PRIMARY KEY,
  course_name VARCHAR(255) NOT NULL,
  duration VARCHAR(100),
  total_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_courses_status (status)
) ENGINE=InnoDB;

-- Repair a partially imported Courses table before creating child tables.
-- MySQL requires the referenced key and foreign-key columns to have the
-- same type, length, character set, and storage engine.
ALTER TABLE Courses
  MODIFY id VARCHAR(100) NOT NULL,
  ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS Students (
  id VARCHAR(100) PRIMARY KEY,
  registration_number VARCHAR(100) UNIQUE,
  joining_date DATE,
  full_name VARCHAR(255) NOT NULL,
  student_contact VARCHAR(50),
  date_of_birth DATE,
  gender VARCHAR(30),
  marital_status VARCHAR(30),
  address TEXT,
  parents_name VARCHAR(255),
  relationship VARCHAR(100),
  parents_contact VARCHAR(50),
  course_id VARCHAR(100),
  course_name VARCHAR(255),
  course_duration VARCHAR(100),
  registration_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  training_course_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  passport_photo MEDIUMTEXT,
  documents JSON,
  student_folder TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_students_course_id (course_id),
  INDEX idx_students_status (status),
  INDEX idx_students_registration_number (registration_number),
  CONSTRAINT fk_students_course
    FOREIGN KEY (course_id) REFERENCES Courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS StudentDocuments (
  id VARCHAR(100) PRIMARY KEY,
  student_id VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  path TEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_student_documents_student_id (student_id),
  CONSTRAINT fk_student_documents_student
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS StudentMedia (
  id VARCHAR(100) PRIMARY KEY,
  entity_table VARCHAR(30) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  media_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(255),
  mime_type VARCHAR(150),
  total_chunks INT NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_student_media_entity (entity_table, entity_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS StudentMediaChunks (
  media_id VARCHAR(100) NOT NULL,
  chunk_index INT NOT NULL,
  chunk_data MEDIUMTEXT NOT NULL,
  PRIMARY KEY (media_id, chunk_index),
  CONSTRAINT fk_student_media_chunks_media
    FOREIGN KEY (media_id) REFERENCES StudentMedia(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Staff (
  id VARCHAR(100) PRIMARY KEY,
  employee_id VARCHAR(100) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  passport_photo MEDIUMTEXT,
  address TEXT,
  gender VARCHAR(30),
  blood_group VARCHAR(10),
  mobile_number VARCHAR(50),
  email VARCHAR(255),
  citizenship_number VARCHAR(100),
  personal_pan_no VARCHAR(100),
  marital_status VARCHAR(30),
  home_number VARCHAR(50),
  alternative_number VARCHAR(50),
  date_of_birth DATE,
  father_name VARCHAR(255),
  mother_name VARCHAR(255),
  grandfather_name VARCHAR(255),
  grandmother_name VARCHAR(255),
  spouse_name VARCHAR(255),
  account_number VARCHAR(100),
  account_name VARCHAR(255),
  bank_name VARCHAR(255),
  swift_code VARCHAR(50),
  job_title VARCHAR(255),
  report_to VARCHAR(255),
  department VARCHAR(255),
  company_name VARCHAR(255),
  company_address TEXT,
  company_contact_no VARCHAR(50),
  joining_date DATE,
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  documents JSON,
  staff_folder TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_staff_employee_id (employee_id),
  INDEX idx_staff_status (status),
  INDEX idx_staff_department (department)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS StaffDocuments (
  id VARCHAR(100) PRIMARY KEY,
  staff_id VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  path TEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_staff_documents_staff_id (staff_id),
  CONSTRAINT fk_staff_documents_staff
    FOREIGN KEY (staff_id) REFERENCES Staff(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Vendors (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pan_vat_no VARCHAR(100),
  address TEXT,
  contact_no VARCHAR(50),
  email VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_vendors_status (status),
  INDEX idx_vendors_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Expenses (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255),
  category VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  expense_date DATE,
  notes TEXT,
  payment_method VARCHAR(50),
  `reference` VARCHAR(255),
  remarks TEXT,
  created_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_expenses_date (expense_date),
  INDEX idx_expenses_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Purchases (
  id VARCHAR(100) PRIMARY KEY,
  invoice_no VARCHAR(100),
  vendor_id VARCHAR(100),
  purchase_date DATE,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(30),
  payment_method VARCHAR(50),
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remarks TEXT,
  bill_file_id VARCHAR(255),
  bill_file_url TEXT,
  digital_bill_url TEXT,
  created_by VARCHAR(100),
  updated_at DATETIME,
  created_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_purchases_vendor_id (vendor_id),
  INDEX idx_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_vendor
    FOREIGN KEY (vendor_id) REFERENCES Vendors(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PurchaseItems (
  id VARCHAR(100) PRIMARY KEY,
  purchase_id VARCHAR(100) NOT NULL,
  item_name VARCHAR(255),
  quantity DECIMAL(12,3),
  unit_price DECIMAL(12,2),
  amount DECIMAL(12,2),
  data_json JSON NOT NULL,
  INDEX idx_purchase_items_purchase_id (purchase_id),
  CONSTRAINT fk_purchase_items_purchase
    FOREIGN KEY (purchase_id) REFERENCES Purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS PurchasePayments (
  id VARCHAR(100) PRIMARY KEY,
  purchase_id VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2),
  payment_date DATE,
  data_json JSON NOT NULL,
  INDEX idx_purchase_payments_purchase_id (purchase_id),
  CONSTRAINT fk_purchase_payments_purchase
    FOREIGN KEY (purchase_id) REFERENCES Purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Payroll (
  id VARCHAR(100) PRIMARY KEY,
  employee_id VARCHAR(100),
  payroll_month CHAR(7),
  designation VARCHAR(255),
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  normal_working_days DECIMAL(6,2) NOT NULL DEFAULT 26.00,
  days_worked DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  earned_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bonus DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_earning DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  deduction DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tds DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(30),
  payment_method VARCHAR(50),
  payment_date DATE,
  remarks TEXT,
  created_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_payroll_employee_month (employee_id, payroll_month),
  CONSTRAINT fk_payroll_employee
    FOREIGN KEY (employee_id) REFERENCES Staff(employee_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Inventory (
  id VARCHAR(100) PRIMARY KEY,
  item_name VARCHAR(255),
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  unit VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  data_json JSON NOT NULL,
  INDEX idx_inventory_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS InventoryTransactions (
  id VARCHAR(100) PRIMARY KEY,
  inventory_id VARCHAR(100),
  quantity DECIMAL(12,3),
  transaction_type VARCHAR(50),
  created_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_inventory_transactions_inventory_id (inventory_id),
  CONSTRAINT fk_inventory_transactions_inventory
    FOREIGN KEY (inventory_id) REFERENCES Inventory(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeCategories (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  data_json JSON NOT NULL,
  INDEX idx_cafe_categories_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeMenu (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id VARCHAR(100),
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  unit VARCHAR(50),
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  data_json JSON NOT NULL,
  INDEX idx_cafe_menu_category_id (category_id),
  CONSTRAINT fk_cafe_menu_category
    FOREIGN KEY (category_id) REFERENCES CafeCategories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeTables (
  id VARCHAR(100) PRIMARY KEY,
  table_no VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeCustomers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255),
  phone VARCHAR(50),
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  data_json JSON NOT NULL,
  INDEX idx_cafe_customers_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeSales (
  id VARCHAR(100) PRIMARY KEY,
  sale_date DATETIME NOT NULL,
  total_bill DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(30),
  table_no VARCHAR(50),
  customer_id VARCHAR(100),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tendered_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  items_ordered JSON,
  data_json JSON NOT NULL,
  INDEX idx_cafe_sales_sale_date (sale_date),
  INDEX idx_cafe_sales_customer_id (customer_id),
  CONSTRAINT fk_cafe_sales_customer
    FOREIGN KEY (customer_id) REFERENCES CafeCustomers(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeSaleItems (
  id VARCHAR(100) PRIMARY KEY,
  sale_id VARCHAR(100) NOT NULL,
  menu_id VARCHAR(100),
  quantity DECIMAL(12,3),
  amount DECIMAL(12,2),
  data_json JSON NOT NULL,
  INDEX idx_cafe_sale_items_sale_id (sale_id),
  CONSTRAINT fk_cafe_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES CafeSales(id) ON DELETE CASCADE,
  CONSTRAINT fk_cafe_sale_items_menu
    FOREIGN KEY (menu_id) REFERENCES CafeMenu(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafePayments (
  id VARCHAR(100) PRIMARY KEY,
  sale_id VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2),
  method VARCHAR(50),
  data_json JSON NOT NULL,
  INDEX idx_cafe_payments_sale_id (sale_id),
  CONSTRAINT fk_cafe_payments_sale
    FOREIGN KEY (sale_id) REFERENCES CafeSales(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeRecipes (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CafeRecipeItems (
  id VARCHAR(100) PRIMARY KEY,
  recipe_id VARCHAR(100) NOT NULL,
  inventory_id VARCHAR(100),
  quantity DECIMAL(12,3),
  data_json JSON NOT NULL,
  CONSTRAINT fk_cafe_recipe_items_recipe
    FOREIGN KEY (recipe_id) REFERENCES CafeRecipes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cafe_recipe_items_inventory
    FOREIGN KEY (inventory_id) REFERENCES Inventory(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Roles (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(500),
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Users (
  id VARCHAR(100) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  full_name VARCHAR(255),
  employee_id VARCHAR(100),
  role_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_users_role_id (role_id),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES Roles(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Permissions (
  id VARCHAR(100) PRIMARY KEY,
  permission_key VARCHAR(150) NOT NULL UNIQUE,
  name VARCHAR(255),
  description VARCHAR(500),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS RolePermissions (
  role_id VARCHAR(100) NOT NULL,
  permission_id VARCHAR(100) NOT NULL,
  allowed TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES Roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES Permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS UserPermissions (
  user_id VARCHAR(100) NOT NULL,
  permission_id VARCHAR(100) NOT NULL,
  allowed TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES Permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS StudentPayments (
  id VARCHAR(100) PRIMARY KEY,
  student_id VARCHAR(100),
  student_name VARCHAR(255),
  payment_date DATE,
  course VARCHAR(255),
  course_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(50),
  payment_type VARCHAR(100),
  remarks TEXT,
  created_at DATETIME,
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS VendorPayments (
  id VARCHAR(100) PRIMARY KEY,
  vendor_id VARCHAR(100),
  vendor_name VARCHAR(255),
  payment_date DATE,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at DATETIME,
  data_json JSON NOT NULL,
  INDEX idx_vendor_payments_vendor_id (vendor_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS StaffPayments (
  id VARCHAR(100) PRIMARY KEY,
  employee_id VARCHAR(100),
  employee_name VARCHAR(255),
  payment_date DATE,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at DATETIME,
  data_json JSON NOT NULL,
  INDEX idx_staff_payments_employee_id (employee_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CreditSales (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(100),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  sale_date DATETIME,
  table_no VARCHAR(50),
  total_bill DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  items_ordered JSON,
  created_at DATETIME,
  INDEX idx_credit_sales_customer_id (customer_id),
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS DueReceived (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(100),
  customer_name VARCHAR(255),
  receipt_date DATE,
  previous_due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remaining_due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(50),
  remarks TEXT,
  created_at DATETIME,
  data_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CustomerPayments (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  previous_due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remaining_due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remarks TEXT,
  created_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_customer_payments_customer_id (customer_id),
  INDEX idx_customer_payments_date (payment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS CustomerLedger (
  customer_id VARCHAR(100) PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  total_credit_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  last_transaction_date DATETIME NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_customer_ledger_due (total_due_amount)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS VendorLedger (
  vendor_id VARCHAR(100) PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL,
  total_purchased_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  last_transaction_date DATETIME NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_vendor_ledger_due (total_due_amount)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS DayClosings (
  id VARCHAR(100) PRIMARY KEY,
  closing_date DATE NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_day_closings_date (closing_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS AuditLog (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100),
  action VARCHAR(100),
  entity VARCHAR(100),
  entity_id VARCHAR(100),
  created_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_audit_log_created_at (created_at),
  CONSTRAINT fk_audit_log_user
    FOREIGN KEY (user_id) REFERENCES Users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS SyncQueue (
  id VARCHAR(100) PRIMARY KEY,
  entity VARCHAR(100),
  entity_id VARCHAR(100),
  operation VARCHAR(50),
  payload_json JSON,
  created_at DATETIME NOT NULL,
  INDEX idx_sync_queue_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS SystemSettings (
  `key` VARCHAR(150) PRIMARY KEY,
  `value` TEXT,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB;

-- Submission history is required for retry/results in the Submit Reports module.
CREATE TABLE IF NOT EXISTS ReportSubmissions (
  id VARCHAR(100) PRIMARY KEY,
  report_key VARCHAR(100) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status VARCHAR(30) NOT NULL,
  rows_json JSON NOT NULL,
  remote_id VARCHAR(255),
  error_message TEXT,
  submitted_by VARCHAR(100),
  submitted_at DATETIME,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_report_submissions_status (status),
  INDEX idx_report_submissions_dates (date_from, date_to)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS FileAttachments (
  id VARCHAR(100) PRIMARY KEY,
  entity VARCHAR(100),
  entity_id VARCHAR(100),
  file_name VARCHAR(255),
  file_path TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  data_json JSON NOT NULL,
  INDEX idx_file_attachments_entity (entity, entity_id)
) ENGINE=InnoDB;

INSERT INTO Roles
  (id, name, description, status, created_at, updated_at, data_json)
VALUES
  ('role-admin', 'ADMIN', 'System administrator', 'Active',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
   JSON_OBJECT('name', 'ADMIN', 'role', 'ADMIN'))
ON DUPLICATE KEY UPDATE
  name = 'ADMIN',
  description = 'System administrator',
  status = 'Active',
  updated_at = CURRENT_TIMESTAMP,
  data_json = JSON_OBJECT('name', 'ADMIN', 'role', 'ADMIN');

INSERT INTO Users
  (id, username, password_hash, full_name, role_id, status,
   created_at, updated_at, data_json)
VALUES
  ('user-admin', 'kcmtadmin',
   '4281397d51c9da20cc2defb713d87bedf3f0c59a1fb5f1ba8da9a65b553b442d',
   'Administrator', 'role-admin', 'Active',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
   JSON_OBJECT('username', 'kcmtadmin', 'fullName', 'Administrator', 'role', 'ADMIN'))
ON DUPLICATE KEY UPDATE
  username = 'kcmtadmin',
  password_hash = '4281397d51c9da20cc2defb713d87bedf3f0c59a1fb5f1ba8da9a65b553b442d',
  full_name = 'Administrator',
  role_id = 'role-admin',
  status = 'Active',
  updated_at = CURRENT_TIMESTAMP,
  data_json = JSON_OBJECT('username', 'kcmtadmin', 'fullName', 'Administrator', 'role', 'ADMIN');

INSERT INTO Permissions (id, permission_key, name, description, created_at, updated_at, data_json)
VALUES ('perm-reports-view', 'reports.view', 'Submit Reports', 'Preview and submit configured reports', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, JSON_OBJECT('permissionKey','reports.view'))
ON DUPLICATE KEY UPDATE name='Submit Reports', updated_at=CURRENT_TIMESTAMP;

INSERT INTO RolePermissions (role_id, permission_id, allowed)
SELECT 'role-admin', id, 1 FROM Permissions WHERE permission_key='reports.view'
ON DUPLICATE KEY UPDATE allowed=1;

SET FOREIGN_KEY_CHECKS = 1;
