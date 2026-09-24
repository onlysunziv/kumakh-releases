/***************************************************************
 * KUMAKH COLLEGE MANAGEMENT SYSTEM
 * PRODUCTION GOOGLE APPS SCRIPT BACKEND
 *
 * Google Sheets = initial migration / explicit reports (desktop SQLite is authoritative)
 * Google Drive  = Photos / Documents
 *
 * MODULES
 * -------------------------------------------------------------
 * 1. Students
 * 2. Staff / Employees
 * 3. Courses
 * 4. Vendors
 * 5. Expenses / Purchases
 * 6. Payroll
 * 7. Café Tables
 * 8. Café Categories
 * 9. Café Menu
 * 10. Café Sales
 * 11. Café Daily Sales
 * 12. Inventory
 * 13. Inventory Transactions
 * 14. Users
 * 15. Roles
 * 16. Audit Log
 *
 * STUDENTS / STAFF
 * -------------------------------------------------------------
 * Add
 * Edit
 * Deactivate
 * Search
 * Drive Photo
 * Drive Documents
 *
 * CAFÉ
 * -------------------------------------------------------------
 * Table Add/Edit/Disable
 * Menu Add/Edit/Disable
 * Sales
 * Cash / QR / Credit
 * Daily totals
 *
 * IMPORTANT
 * -------------------------------------------------------------
 * Historical financial records are NOT physically deleted.
 * Students / Staff / Tables / Menu use Status where possible.
 ***************************************************************/

const CAFE_SALES_HEADERS = [
  "Date",
  "Time",
  "Table No",
  "Customer ID",
  "Customer Name",
  "Customer Phone",
  "Discount Amount",
  "VAT Amount",
  "Total Bill",
  "Items Ordered",
  "Tendered Amount",
  "Paid Amount",
  "Change Amount",
  "Due Amount",
  "Payment Status",
  "Payment Method",
];

const CREDIT_SALES_HEADERS = [
  "Credit Sale ID",
  "Customer ID",
  "Customer Name",
  "Customer Phone",
  "Sale Date",
  "Table No",
  "Total Bill",
  "Paid Amount",
  "Due Amount",
  "Payment Method",
  "Items Ordered",
  "Created At",
];

const CUSTOMER_LEDGER_HEADERS = [
  "Ledger ID",
  "Customer ID",
  "Customer Name",
  "Total Credit Amount",
  "Total Received Amount",
  "Total Due Amount",
  "Last Transaction Date",
  "Updated At",
];

const DUE_RECEIVED_HEADERS = [
  "Receipt ID",
  "Customer ID",
  "Customer Name",
  "Receipt Date",
  "Previous Due Amount",
  "Received Amount",
  "Remaining Due Amount",
  "Payment Mode",
  "Remarks",
  "Created At",
];

/* ============================================================
   1. GOOGLE DRIVE CONFIGURATION
============================================================ */

/*
 * COLLEGE TEST
 * Student photos and documents
 */
const STUDENTS_FOLDER_ID = "1yF52bLWkV1_tXYoTWEodMCn5r7QBjT9m";

/*
 * COLLEGE TEST EMP
 * Employee photos and documents
 */
const STAFF_FOLDER_ID = "1Sn1a5RYZXXtLEZWa-mUnJDpAiBmt5hyA";

const PURCHASE_BILLS_FOLDER_ID = "1YBlU2GTHdpEc1lWH-OxjWxoohZInZFWp";

/* ============================================================
   2. DATABASE STRUCTURE
============================================================ */

const PRODUCTION_SHEET_NAMES = [
  "Students",
  "Staff",
  "Courses",
  "Vendors",
  "Vendor Ledger",
  "VendorPayments",
  "PaymentOut",
  "CafeSales",
  "CafeCustomers",
  "CreditSales",
  "CustomerLedger",
  "DueReceived",
  "CustomerPayments",
  "CafeTables",
  "CafeMenu",
  "CafeCategories",
  "CafeDailySales",
  "PurchaseItems",
  "InventoryTransactions",
  "CafeRecipes",
  "CafeRecipeItems",
  "Expenses",
  "Purchases",
  "Inventory",
  "Payroll",
  "PayrollSummary",
  "StaffPayments",
  "StudentPayments",
  "StudentLedger",
  "AuditLog",
  "Users",
  "Roles",
  "Permissions",
  "RolePermissions",
  "UserPermissions",
];

function getProductionDatabaseStructure_() {
  const allTables = getDatabaseStructure();
  return PRODUCTION_SHEET_NAMES.reduce(function (structure, sheetName) {
    if (!allTables[sheetName]) {
      throw new Error("Missing database schema for required sheet: " + sheetName);
    }
    structure[sheetName] = allTables[sheetName];
    return structure;
  }, {});
}

function getDatabaseStructure() {
  return {
    /* --------------------------------------------------------
       COURSES
    -------------------------------------------------------- */

    Courses: [
      "Course Name",
      "Duration",
      "Total Fee",
      "Status",
      "Created At",
      "Updated At",
    ],

    /* --------------------------------------------------------
       VENDORS
    -------------------------------------------------------- */

    Vendors: [
      "PAN/VAT No.",
      "Name",
      "Address",
      "Contact No",
      "Email",
      "Status",
      "Created At",
      "Updated At",
    ],
    "Vendor Ledger": [
      "Vendor ID",
      "Vendor Name",
      "Total Purchased Amount",
      "Total Paid Amount",
      "Due Amount",
    ],
    VendorPayments: [
      "Payment ID",
      "Vendor ID",
      "Vendor Name",
      "Amount",
      "Payment Date",
      "Payment Method",
      "Remarks",
      "Created At",
    ],
    PaymentOut: [
      "Voucher No",
      "Payment ID",
      "Payment Type",
      "Payee ID",
      "Payee Name",
      "PAN/VAT No",
      "Previous Due",
      "Paid Amount",
      "Remaining Due",
      "Advance Amount",
      "Payment Method",
      "Payment Date",
      "Remarks",
      "Created At",
    ],

    /* --------------------------------------------------------
       EXPENSES / PURCHASES
    -------------------------------------------------------- */

    ExpensesPurchases: [
      "Billing Date",
      "Bill No",
      "Vendor Name",
      "Description",
      "Amount",
      "Paid Amount",
      "Due Amount",
      "Payment Mode",
      "Status",
      "Created At",
      "Updated At",
    ],

    Expenses: [
      "Expense ID",
      "Expense Name",
      "Category",
      "Amount",
      "Expense Date",
      "Notes",
      "Created At",
    ],

    /* --------------------------------------------------------
       STUDENTS
       KEEPING YOUR EXISTING ACTUAL STRUCTURE
    -------------------------------------------------------- */

    Students: [
      "Joining Date",
      "Passport Size Photo",
      "Registration Number",
      "Full Name",
      "Date of Birth",
      "Marital Status",
      "Gender",
      "Address",
      "Parents Name",
      "Relationship",
      "Parents Contact",
      "Course",
      "Course Duration",
      "Documents",
      "Registration Fee",
      "Training/Course Fee",
      "Discount",

      /*
       * New management fields.
       * Added without removing existing fields.
       */
      "Status",
      "Student Drive Folder",
      "Created At",
      "Updated At",
    ],

    StudentPayments: [
      "Payment ID",
      "Student ID",
      "Student Name",
      "Payment Type",
      "Amount",
      "Payment Date",
      "Payment Mode",
      "Remarks",
      "Created At",
    ],

    StudentLedger: [
      "Ledger ID",
      "Student ID",
      "Registration Number",
      "Student Name",
      "Total Fee Amount",
      "Total Paid Amount",
      "Total Due Amount",
      "Last Payment Date",
      "Updated At",
    ],

    /* --------------------------------------------------------
       STAFF / EMPLOYEES
       KEEPING YOUR EXISTING STRUCTURE
    -------------------------------------------------------- */

    Staff: [
      /* PERSONAL INFORMATION */

      "Full Name",
      "Passport Size Photo",
      "Personal Address",
      "Gender",
      "Blood Group",
      "Mobile Number",
      "Email",
      "Citizenship Number",
      "Personal PAN No",
      "Marital Status",
      "Documents",
      "Home Number",
      "Alternative Number",
      "Date of Birth",

      /* FAMILY INFORMATION */

      "Father's Name",
      "Mother's Name",
      "Grandfather's Name",
      "Grandmother's Name",
      "Spouse Name",

      /* BANK INFORMATION */

      "Account Number",
      "Account Name",
      "Bank Name",
      "SWIFT Code",

      /* EMPLOYMENT INFORMATION */

      "Job Title",
      "Employee ID",
      "Report To",
      "Department",
      "Company Name",
      "Company Address",
      "Company Contact No",
      "Basic Salary",
      "Joining Date",

      /*
       * Management fields
       */

      "Status",
      "Employee Drive Folder",
      "Created At",
      "Updated At",
    ],

    /* --------------------------------------------------------
       PAYROLL
    -------------------------------------------------------- */

    Payroll: [
      "Payroll ID",
      "Employee ID",
      "Employee Name",
      "Designation",
      "Basic Salary",
      "Payroll Month",
      "Normal Working Days",
      "Days Worked",
      "Earned Salary",
      "Bonus",
      "Allowance",
      "Total Earning",
      "Deduction",
      "TDS",
      "Net Salary",
      "Total Paid",
      "Due Salary",
      "Outstanding Salary",
      "Payment Method",
      "Payment Date",
      "Remarks",
      "Created At",
    ],

    PayrollSummary: [
      "Employee ID",
      "Employee Name",
      "Total Earnings",
      "Total Paid",
      "Total Due",
      "Total Outstanding",
      "Total Advance",
      "Updated At",
    ],

    StaffPayments: [
      "Payment ID",
      "Employee ID",
      "Employee Name",
      "Amount",
      "Payment Date",
      "Payment Method",
      "Remarks",
      "Created At",
    ],

    /* ========================================================
       INVENTORY
    ======================================================== */

    Inventory: [
      "Item ID",
      "Item Code",
      "Item Name",
      "Category",
      "Unit",
      "Current Stock",
      "Reorder Level",
      "Cost Price",
      "Selling Price",
      "Supplier ID",
      "Supplier Name",
      "Status",
      "Created At",
      "Updated At",
    ],

    InventoryTransactions: [
      "Transaction ID",
      "Date",
      "Time",
      "Item ID",
      "Item Name",
      "Transaction Type",
      "Quantity",
      "Unit",
      "Rate",
      "Amount",
      "Reference",
      "Remarks",
      "Created At",
    ],

    /* ========================================================
       PURCHASES
    ======================================================== */

    Purchases: [
      "Purchase ID",
      "Date",
      "Vendor ID",
      "Vendor Name",
      "Invoice Number",
      "Subtotal",
      "Discount",
      "Tax",
      "Total Amount",
      "Paid Amount",
      "Due Amount",
      "Payment Method",
      "Payment Status",
      "Remarks",
      "Created At",
      "Updated At",
      "Bill File ID",
      "Bill File Name",
      "Bill File URL",
      "Bill QR URL",
    ],

    PurchaseItems: [
      "Purchase Item ID",
      "Purchase ID",
      "Item ID",
      "Item Name",
      "Quantity",
      "Unit",
      "Rate",
      "Amount",
      "Bill File ID",
      "Bill File URL",
      "Bill QR URL",
      "Created At",
    ],

    /* ========================================================
       CAFÉ CATEGORIES
    ======================================================== */

    CafeCategories: [
      "Category ID",
      "Category Name",
      "Description",
      "Status",
      "Created At",
      "Updated At",
    ],

    /* ========================================================
       CAFÉ MENU
    ======================================================== */

    CafeMenu: [
      "Item ID",
      "Item Name",
      "Category ID",
      "Category Name",
      "Selling Price",
      "Cost Price",
      "Quantity",
      "Unit",
      "Available",
      "Image URL",
      "Description",
      "Created At",
      "Updated At",
    ],

    /* ========================================================
       CAFÉ TABLES
    ======================================================== */

    CafeTables: [
      "Table No",
      "Table Name",
      "Capacity",
      "Status",
      "Created At",
      "Updated At",
    ],

    /* ========================================================
       CAFÉ SALES
       INTENTIONALLY SIMPLE
    ======================================================== */

    CafeSales: [
      "Date",
      "Time",
      "Table No",
      "Customer ID",
      "Customer Name",
      "Customer Phone",
      "Discount Amount",
      "VAT Amount",
      "Total Bill",
      "Items Ordered",
      "Tendered Amount",
      "Paid Amount",
      "Change Amount",
      "Due Amount",
      "Payment Status",
      "Payment Method",
    ],

    CafeCustomers: [
      "Customer ID",
      "Customer Name",
      "Phone Number",
      "Address",
      "Credit Limit",
      "Total Credit Amount",
      "Total Received Amount",
      "Total Due Amount",
      "Status",
      "Created At",
      "Updated At",
    ],

    CreditSales: [
      "Credit Sale ID",
      "Customer ID",
      "Customer Name",
      "Customer Phone",
      "Sale Date",
      "Table No",
      "Total Bill",
      "Paid Amount",
      "Due Amount",
      "Payment Method",
      "Items Ordered",
      "Created At",
    ],

    CustomerLedger: [
      "Ledger ID",
      "Customer ID",
      "Customer Name",
      "Total Credit Amount",
      "Total Received Amount",
      "Total Due Amount",
      "Last Transaction Date",
      "Updated At",
    ],

    CustomerPayments: [
      "Payment ID", "Customer ID", "Customer Name", "Payment Date", "Amount",
      "Payment Method", "Previous Due Amount", "Remaining Due Amount", "Remarks", "Created At",
    ],
    DueReceived: [
      "Receipt ID",
      "Customer ID",
      "Customer Name",
      "Receipt Date",
      "Previous Due Amount",
      "Received Amount",
      "Remaining Due Amount",
      "Payment Mode",
      "Remarks",
      "Created At",
    ],

    /* ========================================================
       CAFÉ DAILY SALES
    ======================================================== */

    CafeDailySales: [
      "Date",
      "Display Date",
      "Cash Sales",
      "QR Sales",
      "Credit Sales",
      "Total Sales",
      "Transaction",
      "Closing Status",
      "Submitted At",
    ],

    /* ========================================================
       CAFÉ RECIPES
    ======================================================== */

    CafeRecipes: [
      "Recipe ID",
      "Menu Item ID",
      "Menu Item Name",
      "Created At",
      "Updated At",
    ],

    CafeRecipeItems: [
      "Recipe Item ID",
      "Recipe ID",
      "Inventory Item ID",
      "Inventory Item Name",
      "Quantity",
      "Unit",
      "Created At",
    ],

    /* ========================================================
       SYSTEM USERS
    ======================================================== */

    Users: [
      "User ID",
      "Username",
      "Full Name",
      "Employee ID",
      "Role",
      "Password Hash",
      "Status",
      "Last Login",
      "Created At",
      "Updated At",
    ],

    /* ========================================================
       ROLES
    ======================================================== */

    Roles: [
      "Role ID",
      "Role Name",
      "Description",
      "Status",
      "Created At",
      "Updated At",
    ],

    Permissions: [
      "Permission Key",
      "Module",
      "Action",
      "Description",
      "Status",
    ],

    RolePermissions: [
      "Role ID",
      "Permission Key",
      "Allowed",
      "Updated At",
    ],

    UserPermissions: [
      "User ID",
      "Permission Key",
      "Allowed",
      "Updated At",
    ],

    /* ========================================================
       AUDIT LOG
    ======================================================== */

    AuditLog: [
      "Log ID",
      "Date",
      "Time",
      "User ID",
      "Username",
      "Role",
      "Action",
      "Module",
      "Record ID",
      "Description",
      "Created At",
    ],
  };
}

/* ============================================================
   3. INITIALIZE DATABASE
============================================================ */

function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const database = getProductionDatabaseStructure_();

  Object.keys(database).forEach(function (sheetName) {
    const requiredColumns = database[sheetName];

    let sheet = ss.getSheetByName(sheetName);

    /*
     * CREATE SHEET
     */

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    /*
     * EMPTY SHEET
     */

    if (sheet.getLastRow() === 0) {
      sheet
        .getRange(1, 1, 1, requiredColumns.length)
        .setValues([requiredColumns]);
    } else {
      /*
       * EXISTING SHEET
       *
       * ADD MISSING COLUMNS ONLY.
       *
       * EXISTING DATA IS NEVER DELETED.
       */
      let existingHeaders = sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0];

      requiredColumns.forEach(function (requiredColumn) {
        const exists = existingHeaders.some(function (existingColumn) {
          return (
            normalizeHeader(existingColumn) === normalizeHeader(requiredColumn)
          );
        });

        if (!exists) {
          const newColumn = sheet.getLastColumn() + 1;

          sheet.getRange(1, newColumn).setValue(requiredColumn);

          existingHeaders.push(requiredColumn);
        }
      });
    }

    /*
     * FORMAT
     */

    formatSheet_(sheet);
    if (sheetName === "Payroll") {
      formatPayrollSheet_(sheet);
    } else if (sheetName === "PayrollSummary") {
      formatPayrollSummarySheet_(sheet);
    }
  });

  ensurePermissionSheets_();
  SpreadsheetApp.flush();
  installCafeDailyClosingTrigger();

  return {
    success: true,

    message: "College database initialized successfully.",

    tables: Object.keys(database),
  };
}

/**
 * Deletes spreadsheet tabs that are not part of the production database.
 *
 * Kept report and ledger tabs:
 * Students, Staff, Courses, Vendors, Vendor Ledger, VendorPayments,
 * CafeSales, CafeCustomers, CreditSales, CustomerLedger, DueReceived,
 * Expenses, Purchases, Inventory, Payroll, StudentPayments, AuditLog.
 *
 * Kept system tabs:
 * Users, Roles, Permissions, RolePermissions, UserPermissions.
 *
 * Run this function manually once from the Apps Script editor after
 * confirming that the current spreadsheet is the correct database.
 */
function deleteUnwantedTables() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const keep = new Set(PRODUCTION_SHEET_NAMES);
  if (!spreadsheet.getSheetByName(PRODUCTION_SHEET_NAMES[0])) {
    spreadsheet.insertSheet(PRODUCTION_SHEET_NAMES[0]);
  }
  const sheets = spreadsheet.getSheets();
  const unwanted = sheets.filter(function (sheet) {
    return !keep.has(sheet.getName());
  });

  if (!unwanted.length) {
    return {
      success: true,
      message: "No unwanted tables found.",
      deletedTables: [],
    };
  }

  /**
   * Creates a clean production database in the current spreadsheet.
   *
   * This is intentionally destructive: it removes non-production tabs and
   * clears records from every kept tab while preserving the required headers.
   * Run manually with true only after selecting the correct spreadsheet:
   *
   *   createFreshDatabase(true)
   */
  function createFreshDatabase(confirmReset) {
    if (confirmReset !== true) {
      throw new Error("Pass true to createFreshDatabase(true) to confirm the reset.");
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const keep = new Set(PRODUCTION_SHEET_NAMES);
    if (!spreadsheet.getSheetByName(PRODUCTION_SHEET_NAMES[0])) {
      spreadsheet.insertSheet(PRODUCTION_SHEET_NAMES[0]);
    }

    spreadsheet.getSheets().forEach(function (sheet) {
      if (!keep.has(sheet.getName())) spreadsheet.deleteSheet(sheet);
    });

    const database = getProductionDatabaseStructure_();
    Object.keys(database).forEach(function (sheetName) {
      const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
      const columns = database[sheetName];
      sheet.clearContents();
      sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
      formatSheet_(sheet);
      if (sheetName === "Payroll") formatPayrollSheet_(sheet);
    });

    ensurePermissionSheets_();
    const usersSheet = getUsersSheet_();
    const userHeaders = getDatabaseStructure().Users;
    createInitialUsers_(usersSheet, userHeaders, userColumnIndexes_(userHeaders));
    SpreadsheetApp.flush();

    return {
      success: true,
      message: "Fresh production Google Sheets database created.",
      tables: PRODUCTION_SHEET_NAMES,
    };
  }

  if (sheets.length - unwanted.length < 1) {
    throw new Error("At least one production table must remain.");
  }

  unwanted.forEach(function (sheet) {
    spreadsheet.deleteSheet(sheet);
  });
  SpreadsheetApp.flush();

  return {
    success: true,
    message: "Unwanted tables deleted.",
    deletedTables: unwanted.map(function (sheet) {
      return sheet.getName();
    }),
  };
}

/**
 * Deletes all records while preserving every sheet's header row and
 * formatting. System and permission sheets are preserved completely.
 *
 * Run this function manually from the Apps Script editor when a clean data
 * set is required. It does not delete sheets, columns, headers, or formatting.
 */
function clearAllDataKeepHeaders() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const protectedSheets = new Set(["SystemUsers", "Permissions"]);

  spreadsheet.getSheets().forEach(function (sheet) {
    if (protectedSheets.has(sheet.getName())) return;

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    // Keep row 1 as the column-header row.
    if (lastRow > 1 && lastColumn > 0) {
      sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
    }
  });

  SpreadsheetApp.flush();
  console.log("All table data cleared; headers and formatting preserved.");
  return {
    success: true,
    message: "All table data cleared; headers and formatting preserved.",
  };
}

/* ============================================================
   4. FORMAT SHEET
============================================================ */

function formatSheet_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn <= 0) {
    return;
  }

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, lastColumn).setFontWeight("bold");

  try {
    if (sheet.getFilter()) {
      sheet.getFilter().remove();
    }

    sheet
      .getRange(1, 1, Math.max(sheet.getLastRow(), 1), lastColumn)
      .createFilter();
  } catch (error) {
    console.log("Filter skipped: " + error.message);
  }
}

function formatReportSheet_(sheet) {
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastColumn <= 0) return;

  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground("#1f4e78")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);

  var largeReport = lastRow > 100;
  if (lastRow > 1 && !largeReport) {
  sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .setVerticalAlignment("top")
    .setWrap(true);
  sheet.autoResizeRows(2, lastRow - 1);
  }

  if (!largeReport) {
  sheet.autoResizeColumns(1, lastColumn);
  for (let column = 1; column <= lastColumn; column++) {
    const width = sheet.getColumnWidth(column);
    sheet.setColumnWidth(column, Math.max(110, Math.min(width, 260)));
  }
  }

  const headers = headerRange.getValues()[0];
  const rowCount = Math.max(lastRow - 1, 1);
  headers.forEach(function (header, index) {
    const key = normalizeHeaderKey(header);
    let numberFormat = "";
    if (
      [
        "amount",
        "totalamount",
        "paidamount",
        "dueamount",
        "discount",
        "discountamount",
        "registrationfee",
        "trainingcoursefee",
        "basicsalary",
        "earnedsalary",
        "bonus",
        "allowance",
        "totalearning",
        "deduction",
        "tds",
        "netsalary",
        "totalpaid",
        "duesalary",
        "outstandingsalary",
        "subtotal",
        "tax",
        "currentstock",
        "reorderlevel",
        "costprice",
        "sellingprice",
        "quantity",
        "rate",
      ].indexOf(key) !== -1
    ) {
      numberFormat = "#,##0.00";
    } else if (/(date|at)$/.test(key)) {
      numberFormat = key === "createdat" || key === "updatedat"
        ? "yyyy-mm-dd hh:mm:ss"
        : "yyyy-mm-dd";
    }
    if (numberFormat) {
      safeSetNumberFormat_(
        sheet.getRange(2, index + 1, rowCount, 1),
        numberFormat,
        header,
      );
    }
  });
}

function safeSetNumberFormat_(range, format, columnName) {
  if (!range || typeof range.setNumberFormat !== "function" || !format) {
    return false;
  }

  /*
   * Google Sheets table columns own their number format. Do not call
   * setNumberFormat() for the Payroll fields that are table-typed.
   */
  if (isKnownTypedColumn_(columnName)) {
    console.log(
      "[KUMAKH] Number format not applied to typed column. Column = " +
        (columnName || "Unknown") +
        ", Format = " +
        format,
    );
    return false;
  }

  try {
    range.setNumberFormat(format);
    return true;
  } catch (error) {
    if (!isTypedColumnFormatError_(error)) {
      throw error;
    }

    const message = getErrorMessage_(error);
    console.log(
      "[KUMAKH] Number format skipped for typed column. Column = " +
        (columnName || "Unknown") +
        ", Format = " +
        format +
        ", Reason = " +
        message,
    );
    return false;
  }
}

function isKnownTypedColumn_(columnName) {
  return [
    "Basic Salary",
    "Earned Salary",
    "Bonus",
    "Allowance",
    "Total Earning",
    "Deduction",
    "TDS",
    "Net Salary",
    "Total Paid",
    "Due Salary",
    "Outstanding Salary",
    "Normal Working Days",
    "Days Worked",
    "Payroll Month",
    "Payment Date",
    "Created At",
    "Total Earnings",
    "Total Due",
    "Total Outstanding",
    "Updated At",
  ].some(function (typedColumn) {
    return normalizeHeader(typedColumn) === normalizeHeader(columnName);
  });
}

function safeSetNumberFormats_(range, formats, columnName) {
  if (!range || typeof range.setNumberFormats !== "function" || !formats) {
    return false;
  }

  if (isKnownTypedColumn_(columnName)) {
    console.log(
      "[KUMAKH] Number formats not applied to typed column. Column = " +
        (columnName || "Unknown"),
    );
    return false;
  }

  try {
    range.setNumberFormats(formats);
    return true;
  } catch (error) {
    if (!isTypedColumnFormatError_(error)) {
      throw error;
    }

    const message = getErrorMessage_(error);
    console.log(
      "[KUMAKH] Number formats skipped for typed column. Column = " +
        (columnName || "Unknown") +
        ", Reason = " +
        message,
    );
    return false;
  }
}

function getErrorMessage_(error) {
  return String((error && error.message) || error || "");
}

function isTypedColumnFormatError_(error) {
  const message = getErrorMessage_(error);
  return (
    /typed column/i.test(message) &&
    /number format|format of cells/i.test(message)
  );
}

function formatPayrollSheet_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowCount = Math.max(sheet.getLastRow() - 1, 1);
  headers.forEach(function (header, index) {
    const key = normalizeHeaderKey(header);
    let format = "";
    if (
      [
        "basicsalary",
        "earnedsalary",
        "bonus",
        "allowance",
        "totalearning",
        "deduction",
        "tds",
        "netsalary",
        "totalpaid",
        "duesalary",
        "outstandingsalary",
      ].indexOf(key) !== -1
    )
      format = "#,##0.00";
    else if (["normalworkingdays", "daysworked"].indexOf(key) !== -1)
      format = "0";
    else if (key === "payrollmonth") format = "@";
    else if (key === "paymentdate") format = "yyyy-mm-dd";
    else if (key === "createdat") format = "yyyy-mm-dd hh:mm:ss";
    if (!format) return;
    safeSetNumberFormat_(
      sheet.getRange(2, index + 1, rowCount, 1),
      format,
      header,
    );
  });
}

function formatPayrollSummarySheet_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowCount = Math.max(sheet.getLastRow() - 1, 1);
  headers.forEach(function (header, index) {
    const key = normalizeHeaderKey(header);
    let format = "";
    if (
      ["totalearnings", "totalpaid", "totaldue", "totaloutstanding"].indexOf(
        key,
      ) !== -1
    )
      format = "#,##0.00";
    else if (key === "updatedat") format = "yyyy-mm-dd hh:mm:ss";
    if (!format) return;
    safeSetNumberFormat_(
      sheet.getRange(2, index + 1, rowCount, 1),
      format,
      header,
    );
  });
}

/* ============================================================
   5. HEADER NORMALIZATION
============================================================ */

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeHeaderKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function recordField_(record, names) {
  const wanted = names.map(function (name) {
    return normalizeHeaderKey(name);
  });
  const key = Object.keys(record || {}).find(function (name) {
    return wanted.indexOf(normalizeHeaderKey(name)) !== -1;
  });
  return key === undefined ? "" : record[key];
}

/* ============================================================
   6. FIND COLUMN
============================================================ */

function findColumn(headers, names) {
  const normalized = headers.map(function (header) {
    return normalizeHeader(header);
  });

  for (let i = 0; i < names.length; i++) {
    const index = normalized.indexOf(normalizeHeader(names[i]));

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

/* ============================================================
   7. JSON RESPONSE
============================================================ */

function jsonResponse(success, message, data) {
  const response = {
    success: success,
    message: message,
    data: data !== undefined ? data : null,
  };
  if (data && data.error) response.error = data.error;
  return ContentService.createTextOutput(
    JSON.stringify(response),
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   8. GET SHEET DATA AS OBJECTS
============================================================ */

function getSheetObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = findSheetCaseInsensitive_(sheetName);

  if (!sheet) {
    throw new Error(sheetName + " sheet not found.");
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];

  return values
    .slice(1)
    .map(function (row, rowIndex) {
      const object = {
        _row: rowIndex + 2,
      };

      headers.forEach(function (header, index) {
        object[header] = row[index];
      });

      return object;
    })
    .filter(function (object) {
      return Object.keys(object).some(function (key) {
        return key !== "_row" && object[key] !== "";
      });
    });
}

function getOrCreateSheetObjects_(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = findSheetCaseInsensitive_(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return getSheetObjects_(sheetName);
}

function saveExpense(request) {
  const payload = request && typeof request === "object" ? request : {};
  const expenseName = String(
    payload.expenseName || payload.description || "",
  ).trim();
  const category = String(payload.category || "").trim();
  const amount = Number(payload.amount);
  const expenseDate = String(
    payload.expenseDate || new Date().toISOString().slice(0, 10),
  ).trim();
  if (!expenseName) throw new Error("Expense description is required.");
  if (!category) throw new Error("Expense category is required.");
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error("Expense amount must be a valid number.");
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Expenses");
  if (!sheet)
    throw new Error(
      "Expenses sheet is not available. Initialize the database first.",
    );
  const headers = sheet.getDataRange().getValues()[0].map(String);
  const record = {
    expenseId: "EXP-" + String(Date.now()).slice(-8),
    expenseName: expenseName,
    category: category,
    amount: Math.round(amount * 100) / 100,
    expenseDate: expenseDate,
    notes: String(payload.notes || "").trim(),
    createdAt: new Date().toISOString(),
  };
  sheet.appendRow(
    headers.map(function (header) {
      const key = normalizeHeaderKey(header);
      if (key === "expenseid") return record.expenseId;
      if (key === "expensename" || key === "description")
        return record.expenseName;
      if (key === "category") return record.category;
      if (key === "amount") return record.amount;
      if (key === "expensedate" || key === "date") return record.expenseDate;
      if (key === "notes" || key === "remarks") return record.notes;
      if (key === "createdat") return record.createdAt;
      return "";
    }),
  );
  return jsonResponse(true, "Expense saved successfully.", record);
}

/* ============================================================
   9. DRIVE FILE
============================================================ */

function saveBase64File(folder, fileData, fallbackName) {
  if (!fileData) {
    throw new Error("File data is missing.");
  }

  const fileName =
    fileData.name || fileData.fileName || fallbackName || "Document";

  const mimeType =
    fileData.mimeType || fileData.mime || "application/octet-stream";

  let base64 = fileData.data || fileData.base64 || "";

  if (base64.indexOf(",") !== -1) {
    base64 = base64.split(",")[1];
  }

  if (!base64) {
    throw new Error("Empty file data.");
  }

  const bytes = Utilities.base64Decode(base64);

  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  const file = folder.createFile(blob);

  return {
    id: file.getId(),

    name: file.getName(),

    url: file.getUrl(),

    downloadUrl: "https://drive.google.com/uc?export=view&id=" + file.getId(),

    mimeType: file.getMimeType(),

    size: file.getSize(),
  };
}

/* ============================================================
   10. STUDENT DRIVE FOLDER
============================================================ */

function getStudentsDriveFolder() {
  if (!STUDENTS_FOLDER_ID) {
    throw new Error("STUDENTS_FOLDER_ID is not configured.");
  }

  return DriveApp.getFolderById(STUDENTS_FOLDER_ID);
}

/* ============================================================
   11. STAFF DRIVE FOLDER
============================================================ */

function getStaffDriveFolder() {
  if (!STAFF_FOLDER_ID) {
    throw new Error("STAFF_FOLDER_ID is not configured.");
  }

  return DriveApp.getFolderById(STAFF_FOLDER_ID);
}

/* ============================================================
   12. CREATE CHILD DRIVE FOLDER
============================================================ */

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(name);
}

/* ============================================================
   13. STUDENT FOLDER
============================================================ */

function createStudentFolder(registrationNumber, studentName) {
  const parent = getStudentsDriveFolder();

  const folderName =
    String(registrationNumber || "").trim() +
    " - " +
    String(studentName || "").trim();

  return getOrCreateChildFolder_(parent, folderName);
}

/* ============================================================
   14. STAFF FOLDER
============================================================ */

function createStaffFolder(employeeId, staffName) {
  const parent = getStaffDriveFolder();

  const folderName =
    String(employeeId || "").trim() + " - " + String(staffName || "").trim();

  return getOrCreateChildFolder_(parent, folderName);
}

/* ============================================================
   15. SAVE STUDENT
============================================================ */

function saveStudent(request) {
  try {
    request = request || {};

    const student =
      request.student && typeof request.student === "object"
        ? request.student
        : request;

    const registrationNumber = String(
      student.registrationNumber || student["Registration Number"] || "",
    ).trim();

    const fullName = String(
      student.fullName || student.studentName || student["Full Name"] || "",
    ).trim();

    if (!registrationNumber) {
      return jsonResponse(false, "Registration Number is required.");
    }

    if (!fullName) {
      return jsonResponse(false, "Student name is required.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheet = findSheetCaseInsensitive_("Students");

    if (!sheet) {
      throw new Error("Students sheet not found. Run initializeDatabase().");
    }

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    const regColumn = findColumn(headers, ["Registration Number"]);

    if (regColumn === -1) {
      throw new Error("Registration Number column not found.");
    }

    /*
     * FIND EXISTING STUDENT
     */

    let rowNumber = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][regColumn] || "").trim() === registrationNumber) {
        rowNumber = i + 1;

        break;
      }
    }

    /*
     * DRIVE FOLDER
     */

    const folder = createStudentFolder(registrationNumber, fullName);

    /*
     * PHOTO
     */

    let photoResult = null;

    const photo =
      request.passportPhoto || student.passportPhoto || student.photo || null;

    if (photo) {
      photoResult = saveBase64File(folder, photo, "Passport Photo");
    }

    /*
     * DOCUMENTS
     */

    const documents = Array.isArray(request.documents)
      ? request.documents
      : Array.isArray(student.documents)
        ? student.documents
        : [];

    const documentResults = [];

    documents.forEach(function (file) {
      if (!file) {
        return;
      }

      documentResults.push(saveBase64File(folder, file, "Document"));
    });

    /*
     * CREATE ROW
     */

    if (rowNumber === -1) {
      const newRow = new Array(headers.length).fill("");

      headers.forEach(function (header, index) {
        const key = normalizeHeader(header);

        let value = "";

        switch (key) {
          case "joining date":
            value = student.joiningDate || "";

            break;

          case "registration number":
            value = registrationNumber;

            break;

          case "full name":
            value = fullName;

            break;

          case "date of birth":
            value = student.dateOfBirth || "";

            break;

          case "marital status":
            value = student.maritalStatus || "";

            break;

          case "gender":
            value = student.gender || "";

            break;

          case "address":
            value = student.address || "";

            break;

          case "parents name":
            value = student.parentsName || "";

            break;

          case "relationship":
            value = student.relationship || "";

            break;

          case "parents contact":
            value = student.parentsContact || "";

            break;

          case "course":
            value = student.course || "";

            break;

          case "course duration":
            value = student.courseDuration || "";

            break;

          case "registration fee":
            value = student.registrationFee || "";

            break;

          case "training/course fee":
            value = student.trainingCourseFee || "";

            break;

          case "discount":
            value = student.discount || "";

            break;

          case "status":
            value = student.status || "Active";

            break;

          case "student drive folder":
            value = folder.getUrl();

            break;

          case "created at":
            value = new Date();

            break;

          case "updated at":
            value = new Date();

            break;
        }

        newRow[index] = value;
      });

      /*
       * PHOTO URL
       */

      const photoColumn = findColumn(headers, [
        "Passport Size Photo",
        "Passport Photo",
      ]);

      if (photoResult && photoColumn !== -1) {
        newRow[photoColumn] = photoResult.url;
      }

      /*
       * DOCUMENT URLS
       */

      const documentsColumn = findColumn(headers, ["Documents"]);

      if (documentResults.length && documentsColumn !== -1) {
        newRow[documentsColumn] = documentResults
          .map(function (file) {
            return file.url;
          })
          .join("\n");
      }

      sheet.appendRow(newRow);

      rowNumber = sheet.getLastRow();
    } else {
      /*
       * UPDATE EXISTING STUDENT
       */
      headers.forEach(function (header, index) {
        const key = normalizeHeader(header);

        let value;
        let update = false;

        switch (key) {
          case "joining date":
            value = student.joiningDate;
            update = true;
            break;

          case "full name":
            value = fullName;
            update = true;
            break;

          case "date of birth":
            value = student.dateOfBirth;
            update = true;
            break;

          case "marital status":
            value = student.maritalStatus;
            update = true;
            break;

          case "gender":
            value = student.gender;
            update = true;
            break;

          case "address":
            value = student.address;
            update = true;
            break;

          case "parents name":
            value = student.parentsName;
            update = true;
            break;

          case "relationship":
            value = student.relationship;
            update = true;
            break;

          case "parents contact":
            value = student.parentsContact;
            update = true;
            break;

          case "course":
            value = student.course;
            update = true;
            break;

          case "course duration":
            value = student.courseDuration;
            update = true;
            break;

          case "registration fee":
            value = student.registrationFee;
            update = true;
            break;

          case "training/course fee":
            value = student.trainingCourseFee;
            update = true;
            break;

          case "discount":
            value = student.discount;
            update = true;
            break;

          case "status":
            value = student.status;
            update = true;
            break;

          case "updated at":
            value = new Date();
            update = true;
            break;
        }

        if (update && value !== undefined) {
          sheet.getRange(rowNumber, index + 1).setValue(value);
        }
      });

      /*
       * UPDATE PHOTO
       */

      const photoColumn = findColumn(headers, [
        "Passport Size Photo",
        "Passport Photo",
      ]);

      if (photoResult && photoColumn !== -1) {
        sheet.getRange(rowNumber, photoColumn + 1).setValue(photoResult.url);
      }

      /*
       * UPDATE DOCUMENTS
       */

      const documentsColumn = findColumn(headers, ["Documents"]);

      if (documentResults.length && documentsColumn !== -1) {
        sheet.getRange(rowNumber, documentsColumn + 1).setValue(
          documentResults
            .map(function (file) {
              return file.url;
            })
            .join("\n"),
        );
      }
    }

    return jsonResponse(true, "Student saved successfully.", {
      registrationNumber: registrationNumber,

      fullName: fullName,

      row: rowNumber,

      driveFolder: folder.getUrl(),

      photo: photoResult,

      documents: documentResults,
    });
  } catch (error) {
    return jsonResponse(false, "Student save error: " + error.message);
  }
}

/* ============================================================
   16. SAVE STAFF
============================================================ */

function saveStaff(request) {
  try {
    request = request || {};

    const staff =
      request.staff && typeof request.staff === "object"
        ? request.staff
        : request;

    const employeeId = String(
      staff.employeeId || staff.employeeID || staff["Employee ID"] || "",
    ).trim();
    const originalEmployeeId = String(
      request.originalEmployeeId ||
        staff.originalEmployeeId ||
        staff.originalEmployeeID ||
        "",
    ).trim();

    const fullName = String(
      staff.fullName || staff.name || staff["Full Name"] || "",
    ).trim();

    if (!employeeId) {
      return jsonResponse(false, "Employee ID is required.");
    }

    if (!fullName) {
      return jsonResponse(false, "Staff full name is required.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheet = findSheetCaseInsensitive_("Staff");

    if (!sheet) {
      throw new Error("Staff sheet not found. Run initializeDatabase().");
    }

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    const employeeColumn = findColumn(headers, ["Employee ID"]);

    if (employeeColumn === -1) {
      throw new Error("Employee ID column not found.");
    }

    let rowNumber = -1;

    const lookupEmployeeId = originalEmployeeId || employeeId;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][employeeColumn] || "").trim() === lookupEmployeeId) {
        rowNumber = i + 1;

        break;
      }
    }

    /*
     * DRIVE FOLDER
     */

    const folder = createStaffFolder(employeeId, fullName);

    /*
     * PHOTO
     */

    const photo =
      request.passportPhoto || staff.passportPhoto || staff.photo || null;

    let photoResult = null;

    if (photo) {
      photoResult = saveBase64File(folder, photo, "Passport Photo");
    }

    /*
     * DOCUMENTS
     */

    const documents = Array.isArray(request.documents)
      ? request.documents
      : Array.isArray(staff.documents)
        ? staff.documents
        : [];

    const documentResults = [];

    documents.forEach(function (file) {
      if (!file) {
        return;
      }

      documentResults.push(saveBase64File(folder, file, "Document"));
    });

    /*
     * CREATE
     */

    if (rowNumber === -1) {
      const newRow = new Array(headers.length).fill("");

      headers.forEach(function (header, index) {
        const key = normalizeHeader(header);

        let value = "";

        switch (key) {
          case "full name":
            value = fullName;
            break;

          case "personal address":
            value = staff.personalAddress || staff.address || "";
            break;

          case "gender":
            value = staff.gender || "";
            break;

          case "blood group":
            value = staff.bloodGroup || staff["Blood Group"] || "";
            break;

          case "mobile number":
            value = staff.mobileNumber || staff.mobile || staff.phone || "";
            break;

          case "email":
            value = staff.email || "";
            break;

          case "citizenship number":
            value = staff.citizenshipNumber || staff.citizenshipNo || "";
            break;

          case "personal pan no":
            value = staff.personalPanNo || staff.panNo || "";
            break;

          case "marital status":
            value = staff.maritalStatus || "";
            break;

          case "home number":
            value = staff.homeNumber || "";
            break;

          case "alternative number":
            value = staff.alternativeNumber || "";
            break;

          case "date of birth":
            value = staff.dateOfBirth || staff.dob || "";
            break;

          case "father's name":
            value = staff.fatherName || "";
            break;

          case "mother's name":
            value = staff.motherName || "";
            break;

          case "grandfather's name":
            value = staff.grandfatherName || "";
            break;

          case "grandmother's name":
            value = staff.grandmotherName || "";
            break;

          case "spouse name":
            value = staff.spouseName || "";
            break;

          case "account number":
            value = staff.accountNumber || "";
            break;

          case "account name":
            value = staff.accountName || "";
            break;

          case "bank name":
            value = staff.bankName || staff.bank || "";
            break;

          case "swift code":
            value = staff.swiftCode || staff.swift || "";
            break;

          case "job title":
            value = staff.jobTitle || staff.position || "";
            break;

          case "employee id":
            value = employeeId;
            break;

          case "report to":
            value = staff.reportTo || staff.reportingTo || "";
            break;

          case "department":
            value = staff.department || "";
            break;

          case "company name":
            value = staff.companyName || "";
            break;

          case "company address":
            value = staff.companyAddress || "";
            break;

          case "company contact no":
            value =
              staff.companyContactNo ||
              staff.companyContact ||
              staff.companyPhone ||
              "";
            break;

          case "basic salary":
            value = staff.basicSalary || "";
            break;

          case "joining date":
            value = staff.joiningDate || "";
            break;

          case "status":
            value = staff.status || "Working";
            break;

          case "employee drive folder":
            value = folder.getUrl();
            break;

          case "created at":
            value = new Date();
            break;

          case "updated at":
            value = new Date();
            break;
        }

        newRow[index] = value;
      });

      const photoColumn = findColumn(headers, [
        "Passport Size Photo",
        "Passport Photo",
      ]);

      if (photoResult && photoColumn !== -1) {
        newRow[photoColumn] = photoResult.url;
      }

      const documentsColumn = findColumn(headers, ["Documents"]);

      if (documentResults.length && documentsColumn !== -1) {
        newRow[documentsColumn] = documentResults
          .map(function (file) {
            return file.url;
          })
          .join("\n");
      }

      sheet.appendRow(newRow);

      rowNumber = sheet.getLastRow();
    } else {
      /*
       * UPDATE
       */
      headers.forEach(function (header, index) {
        const key = normalizeHeader(header);

        let value;
        let update = false;

        switch (key) {
          case "full name":
            value = fullName;
            update = true;
            break;

          case "personal address":
            value = staff.personalAddress || staff.address || "";
            update = true;
            break;

          case "gender":
            value = staff.gender || "";
            update = true;
            break;

          case "blood group":
            value = staff.bloodGroup || staff["Blood Group"] || "";
            update = true;
            break;

          case "mobile number":
            value = staff.mobileNumber || staff.mobile || staff.phone || "";
            update = true;
            break;

          case "email":
            value = staff.email || "";
            update = true;
            break;

          case "citizenship number":
            value = staff.citizenshipNumber || staff.citizenshipNo || "";
            update = true;
            break;

          case "personal pan no":
            value = staff.personalPanNo || staff.panNo || "";
            update = true;
            break;

          case "marital status":
            value = staff.maritalStatus || "";
            update = true;
            break;

          case "home number":
            value = staff.homeNumber || "";
            update = true;
            break;

          case "alternative number":
            value = staff.alternativeNumber || "";
            update = true;
            break;

          case "date of birth":
            value = staff.dateOfBirth || "";
            update = true;
            break;

          case "father's name":
            value = staff.fatherName || "";
            update = true;
            break;

          case "mother's name":
            value = staff.motherName || "";
            update = true;
            break;

          case "grandfather's name":
            value = staff.grandfatherName || "";
            update = true;
            break;

          case "grandmother's name":
            value = staff.grandmotherName || "";
            update = true;
            break;

          case "spouse name":
            value = staff.spouseName || "";
            update = true;
            break;

          case "account number":
            value = staff.accountNumber || "";
            update = true;
            break;

          case "account name":
            value = staff.accountName || "";
            update = true;
            break;

          case "bank name":
            value = staff.bankName || "";
            update = true;
            break;

          case "swift code":
            value = staff.swiftCode || "";
            update = true;
            break;

          case "job title":
            value = staff.jobTitle || "";
            update = true;
            break;

          case "employee id":
            value = employeeId;
            update = true;
            break;

          case "report to":
            value = staff.reportTo || "";
            update = true;
            break;

          case "department":
            value = staff.department || "";
            update = true;
            break;

          case "company name":
            value = staff.companyName || "";
            update = true;
            break;

          case "company address":
            value = staff.companyAddress || "";
            update = true;
            break;

          case "company contact no":
            value = staff.companyContactNo || "";
            update = true;
            break;

          case "basic salary":
            value = staff.basicSalary || "";
            update = true;
            break;

          case "joining date":
            value = staff.joiningDate || "";
            update = true;
            break;

          case "status":
            value = staff.status || "Active";
            update = true;
            break;

          case "updated at":
            value = new Date();
            update = true;
            break;
        }

        if (update && value !== undefined) {
          sheet.getRange(rowNumber, index + 1).setValue(value);
        }
      });

      const photoColumn = findColumn(headers, [
        "Passport Size Photo",
        "Passport Photo",
      ]);

      if (photoResult && photoColumn !== -1) {
        sheet.getRange(rowNumber, photoColumn + 1).setValue(photoResult.url);
      }

      const documentsColumn = findColumn(headers, ["Documents"]);

      if (documentResults.length && documentsColumn !== -1) {
        sheet.getRange(rowNumber, documentsColumn + 1).setValue(
          documentResults
            .map(function (file) {
              return file.url;
            })
            .join("\n"),
        );
      }
    }

    return jsonResponse(true, "Staff saved successfully.", {
      employeeId: employeeId,

      fullName: fullName,

      row: rowNumber,

      driveFolder: folder.getUrl(),

      photo: photoResult,

      documents: documentResults,
    });
  } catch (error) {
    return jsonResponse(false, "Staff save error: " + error.message);
  }
}

/* ============================================================
   17. GENERIC GET
============================================================ */

function getTable(tableName) {
  try {
    return jsonResponse(
      true,
      tableName + " loaded successfully.",
      getSheetObjects_(tableName),
    );
  } catch (error) {
    return jsonResponse(false, error.message);
  }
}

/* ============================================================
   17A. AUTHENTICATION / SYSTEM USERS
============================================================ */

function getUsersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Users");
  const headers = getDatabaseStructure().Users;
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function hashUserPassword_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password || ""),
    Utilities.Charset.UTF_8,
  );
  return bytes
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ("0" + value.toString(16)).slice(-2);
    })
    .join("");
}

function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hashUserPasswordSecure_(password) {
  const salt = Utilities.getUuid().replace(/-/g, "");
  return salt + "$" + hashUserPassword_(salt + String(password || ""));
}

function verifyUserPassword_(password, storedHash) {
  const stored = String(storedHash || "");
  if (stored.indexOf("$") !== -1) {
    const parts = stored.split("$");
    return (
      parts.length === 2 &&
      hashUserPassword_(parts[0] + String(password || "")) === parts[1]
    );
  }
  return hashUserPassword_(password) === stored.toLowerCase();
}

function permissionDefinitions_() {
  return [
    ["dashboard.view", "dashboard", "view", "View dashboard"],
    ["students.view", "students", "view", "View students"],
    ["students.add", "students", "add", "Add students"],
    ["students.modify", "students", "modify", "Modify students"],
    ["students.delete", "students", "delete", "Delete students"],
    ["staff.view", "staff", "view", "View staff"],
    ["staff.add", "staff", "add", "Add staff"],
    ["staff.modify", "staff", "modify", "Modify staff"],
    ["staff.delete", "staff", "delete", "Delete staff"],
    ["courses.view", "courses", "view", "View courses"],
    ["courses.add", "courses", "add", "Add courses"],
    ["courses.modify", "courses", "modify", "Modify courses"],
    ["courses.delete", "courses", "delete", "Delete courses"],
    ["vendors.view", "vendors", "view", "View vendors"],
    ["vendors.add", "vendors", "add", "Add vendors"],
    ["vendors.modify", "vendors", "modify", "Modify vendors"],
    ["vendors.delete", "vendors", "delete", "Delete vendors"],
    ["purchases.view", "purchases", "view", "View purchases"],
    ["purchases.add", "purchases", "add", "Add purchases"],
    ["purchases.modify", "purchases", "modify", "Modify purchases"],
    ["purchases.delete", "purchases", "delete", "Delete purchases"],
    ["expenses.view", "expenses", "view", "View expenses"],
    ["expenses.add", "expenses", "add", "Add expenses"],
    ["expenses.modify", "expenses", "modify", "Modify expenses"],
    ["expenses.delete", "expenses", "delete", "Delete expenses"],
    ["payroll.view", "payroll", "view", "View payroll"],
    ["payroll.add", "payroll", "add", "Add payroll"],
    ["payroll.modify", "payroll", "modify", "Modify payroll"],
    ["payroll.delete", "payroll", "delete", "Delete payroll"],
    ["cafe.view", "cafe", "view", "View cafe"],
    ["cafe.add", "cafe", "add", "Add cafe records"],
    ["cafe.modify", "cafe", "modify", "Modify cafe records"],
    ["cafe.delete", "cafe", "delete", "Delete cafe records"],
    ["users.view", "users", "view", "View users"],
    ["users.add", "users", "add", "Add users"],
    ["users.modify", "users", "modify", "Modify users"],
    ["users.delete", "users", "delete", "Delete users"],
    ["settings.view", "settings", "view", "View settings"],
    ["settings.modify", "settings", "modify", "Modify settings"],
    ["payments.view", "payments", "view", "View payments"],
    ["payments.add", "payments", "add", "Add payments"],
    ["paymentout.view", "paymentout", "view", "View payment out"],
    ["paymentout.add", "paymentout", "add", "Add payment out"],
    ["reports.view", "reports", "view", "Submit reports to Google Sheets"],
  ];
}

function ensurePermissionSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const structures = getDatabaseStructure();
  let rolesSheet = ss.getSheetByName("Roles");
  if (!rolesSheet) {
    rolesSheet = ss.insertSheet("Roles");
    rolesSheet
      .getRange(1, 1, 1, structures.Roles.length)
      .setValues([structures.Roles]);
  } else if (rolesSheet.getLastRow() === 0) {
    rolesSheet
      .getRange(1, 1, 1, structures.Roles.length)
      .setValues([structures.Roles]);
  }
  ["Permissions", "RolePermissions", "UserPermissions"].forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    const headers = structures[name];
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const existing = sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0];
      headers.forEach(function (header) {
        if (
          !existing.some(function (value) {
            return normalizeHeader(value) === normalizeHeader(header);
          })
        ) {
          sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
          existing.push(header);
        }
      });
    }
  });

  const permissionSheet = ss.getSheetByName("Permissions");
  const permissionDefinitions = permissionDefinitions_();
  const existingPermissionKeys = {};
  getSheetObjects_("Permissions").forEach(function (row) {
    existingPermissionKeys[String(row["Permission Key"] || "").trim()] = true;
  });
  const missingPermissionRows = permissionDefinitions
    .filter(function (item) {
      return !existingPermissionKeys[item[0]];
    })
    .map(function (item) {
      return [item[0], item[1], item[2], item[3], "Active"];
    });
  if (missingPermissionRows.length) {
    permissionSheet
      .getRange(permissionSheet.getLastRow() + 1, 1, missingPermissionRows.length, missingPermissionRows[0].length)
      .setValues(missingPermissionRows);
  }

  if (rolesSheet.getLastRow() <= 1) {
    const now = new Date();
    rolesSheet.getRange(2, 1, 2, 6).setValues([
      ["ROLE-ADMIN", "ADMIN", "Unrestricted administrator", "Active", now, now],
      ["ROLE-CASHIER", "CASHIER", "Default cashier access", "Active", now, now],
    ]);
  }

  const roleRecords = getSheetObjects_("Roles");
  const roleByName = {};
  roleRecords.forEach(function (role) {
    roleByName[String(role["Role Name"] || "").toUpperCase()] = role;
  });
  const rolePermissionsSheet = ss.getSheetByName("RolePermissions");
  const existingKeys = {};
  getSheetObjects_("RolePermissions").forEach(function (row) {
    existingKeys[
      String(row["Role ID"] || "") + "|" + String(row["Permission Key"] || "")
    ] = true;
  });
  const cashierDefaults = [
    "dashboard.view",
    "students.view",
    "students.add",
    "courses.view",
    "vendors.view",
    "vendors.add",
    "purchases.view",
    "purchases.add",
    "expenses.view",
    "expenses.add",
    "payments.view",
    "payments.add",
    "paymentout.view",
    "paymentout.add",
    "cafe.view",
    "cafe.add",
    "reports.view",
  ];
  const now = new Date();
  const rowsToAdd = [];
  if (roleByName.CASHIER) {
    cashierDefaults.forEach(function (key) {
      const composite = roleByName.CASHIER["Role ID"] + "|" + key;
      if (!existingKeys[composite]) {
        rowsToAdd.push([roleByName.CASHIER["Role ID"], key, true, now]);
      }
    });
  }
  if (rowsToAdd.length) {
    rolePermissionsSheet
      .getRange(rolePermissionsSheet.getLastRow() + 1, 1, rowsToAdd.length, 4)
      .setValues(rowsToAdd);
  }
}

function sessionUser_(request) {
  const token = String((request && request.sessionToken) || "").trim();
  if (!token) return null;
  const stored = PropertiesService.getScriptProperties().getProperty(
    "KCMT_SESSION_" + token,
  );
  if (!stored) return null;
  let session;
  try {
    session = JSON.parse(stored);
  } catch (error) {
    return null;
  }
  if (!session.userId || Date.now() - Number(session.issuedAt || 0) > 86400000) {
    return null;
  }
  const user = getSheetObjects_("Users").find(function (record) {
    return String(record["User ID"] || "") === String(session.userId);
  });
  if (!user || String(user.Status || "Active").toLowerCase() !== "active") {
    return null;
  }
  return user;
}

function permissionsForUser_(user) {
  ensurePermissionSheets_();
  const definitions = permissionDefinitions_();
  const allKeys = definitions.map(function (item) {
    return item[0];
  });
  const role = String(user.Role || "").toUpperCase();
  const userId = String(user["User ID"] || "").trim();
  const username = String(user.Username || "").trim().toLowerCase();
  if (
    role === "ADMIN" ||
    role === "ADMINISTRATOR" ||
    userId === "USR-0001" ||
    username === "admin"
  ) {
    return allKeys;
  }
  const roleRecord = getSheetObjects_("Roles").find(function (record) {
    return String(record["Role Name"] || "").toUpperCase() === role;
  });
  if (
    roleRecord &&
    String(roleRecord.Status || "Active").toLowerCase() !== "active"
  ) {
    return [];
  }
  const permissions = {};
  if (roleRecord) {
    getSheetObjects_("RolePermissions").forEach(function (record) {
      if (
        String(record["Role ID"] || "") === String(roleRecord["Role ID"] || "")
      ) {
        permissions[String(record["Permission Key"] || "")] =
          String(record.Allowed).toLowerCase() === "true";
      }
    });
  }
  getSheetObjects_("UserPermissions").forEach(function (record) {
    if (String(record["User ID"] || "") === String(user["User ID"] || "")) {
      permissions[String(record["Permission Key"] || "")] =
        String(record.Allowed).toLowerCase() === "true";
    }
  });
  return allKeys.filter(function (key) {
    return permissions[key] === true;
  });
}

function apiPermissionForAction_(action) {
  const map = {
    getstudents: "students.view",
    getstudentpayments: "payments.view",
    savestudent: "students.add",
    registerstudent: "students.add",
    addstudent: "students.add",
    updatestudent: "students.modify",
    deletestudent: "students.delete",
    deactivatestudent: "students.delete",
    updatestudentstatus: "students.modify",
    getstaff: "staff.view",
    getemployees: "staff.view",
    getstaffbyemployeeid: "staff.view",
    savestaff: "staff.add",
    saveemployee: "staff.add",
    updatestaff: "staff.modify",
    deletestaff: "staff.delete",
    deactivatestaff: "staff.delete",
    deactivateemployee: "staff.delete",
    updatestaffstatus: "staff.modify",
    getcourses: "courses.view",
    savecourse: "courses.add",
    updatecourse: "courses.modify",
    deletecourse: "courses.delete",
    getvendors: "vendors.view",
    savevendor: "vendors.add",
    updatevendor: "vendors.modify",
    deletevendor: "vendors.delete",
    deactivatevendor: "vendors.delete",
    savepurchase: "purchases.add",
    uploadpurchasebill: "purchases.add",
    retrypurchasebillupload: "purchases.modify",
    getpurchasebills: "purchases.view",
    getpurchaseitems: "purchases.view",
    getpurchaseitemsuggestions: "purchases.view",
    searchpurchaseitems: "purchases.view",
    savevendorpayment: "vendors.modify",
    saveexpense: "expenses.add",
    getexpensespurchases: "expenses.view",
    getpayroll: "payroll.view",
    getpayrollsummary: "payroll.view",
    savepayroll: "payroll.add",
    createpayroll: "payroll.add",
    savestaffpayment: "payroll.modify",
    savestudentpayment: "payments.add",
    saveduereceived: "payments.add",
    getusersadmin: "users.view",
    getsystemusers: "users.view",
    saveuser: "users.add",
    savesystemuser: "users.add",
    getcafetables: "cafe.view",
    gettables: "cafe.view",
    getcafecategories: "cafe.view",
    getcategoriess: "cafe.view",
    getcafemenu: "cafe.view",
    getmenu: "cafe.view",
    getcafesales: "cafe.view",
    getsales: "cafe.view",
    getcafetodaysummary: "cafe.view",
    getcafedailysummary: "cafe.view",
    getcafedailysales: "cafe.view",
    savecafecategory: "cafe.add",
    savecategory: "cafe.add",
    savecafecustomer: "cafe.add",
    savecreditcustomer: "cafe.add",
    disablecafecustomer: "cafe.delete",
    deactivatecafecustomer: "cafe.delete",
    getcafecustomers: "cafe.view",
    getcreditcustomers: "cafe.view",
    getcustomerledger: "cafe.view",
    getcreditsales: "cafe.view",
    getduereceived: "cafe.view",
    getcustomerpayments: "cafe.view",
    getinventory: "cafe.view",
    getcafeinventory: "cafe.view",
    savecafetables: "cafe.add",
    savecafetable: "cafe.add",
    savetables: "cafe.add",
    savecafemenu: "cafe.add",
    savecafeitem: "cafe.add",
    savemenu: "cafe.add",
    savecafesale: "cafe.add",
    savecafetransaction: "cafe.add",
    submitcafedailyclosingreport: "cafe.modify",
    submitcafeclosingreport: "cafe.modify",
    submitclosingreport: "cafe.modify",
    savesale: "cafe.add",
    saveinventoryitem: "cafe.modify",
    saveinventory: "cafe.modify",
    addinventorytransaction: "cafe.modify",
    stocktransaction: "cafe.modify",
    getdatabase: "settings.view",
    initializedatabase: "settings.modify",
    upsertreport: "reports.view",
    uploadpersonfile: "reports.view",
  };
  return map[action] || null;
}

function authorizeRequest_(request, action) {
  if (action === "authenticateuser" || action === "login") return null;
  if (action === "upsertreport") {
    if (!sessionUser_(request)) return jsonResponse(false, "Report authentication required.", {
      error: "REPORT_AUTH_REQUIRED",
      message: "Sign in with your reporting username and password before submitting.",
    });
  }
  const user = sessionUser_(request);
  if (!user) return jsonResponse(false, "ACCESS_DENIED", {
    error: "ACCESS_DENIED",
    message: "Your session is invalid or expired.",
  });
  const permission = apiPermissionForAction_(action);
  const userPermissions = permissionsForUser_(user);
  const allowed =
    action === "saveuser" ||
    action === "savesystemuser"
      ? userPermissions.indexOf("users.add") !== -1 ||
        userPermissions.indexOf("users.modify") !== -1
      : permission
        ? userPermissions.indexOf(permission) !== -1
        : true;
  if (permission && !allowed) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to perform this action.",
    });
  }
  return null;
}

  /* Receives canonical SQLite report rows and upserts them into the existing
   * sheet/header contract. No new CafeDailySales table or sheet is created. */
  function vendorReportIdentity_(headers, values) {
    var normalize = function (value) { return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " "); };
    var field = function (aliases) {
      var index = headers.findIndex(function (header) { return aliases.indexOf(String(header).toLowerCase().replace(/[^a-z0-9]/g, "")) !== -1; });
      return index < 0 ? "" : normalize(values[index]);
    };
    var name = field(["name", "vendorname"]);
    var pan = field(["panvatno", "panvat", "panno", "pan", "vatno"]).replace(/[^a-z0-9]/g, "");
    if (name && pan) return "vendor:" + JSON.stringify([pan, name]);
    var contact = field(["contactno", "contactnumber", "phone"]).replace(/[^0-9+]/g, "");
    var address = field(["address"]);
    if (name && contact && address) return "vendor:" + JSON.stringify([name, contact, address]);
    var id = field(["vendorid", "recordid", "id"]);
    return id ? "id:" + id : "";
  }

  // Accept current link-only exports and legacy document metadata, but write
  // only Drive URLs to the Documents cell. No JSON or local file details.
  function reportDocumentLinks_(value) {
    var links = [];
    var add = function (url) {
      url = String(url || '').trim();
      if (/^https:\/\/drive\.google\.com\/[^\s<>"'\\]+$/i.test(url) && links.indexOf(url) === -1) links.push(url);
    };
    var collect = function (item) {
      if (Array.isArray(item)) { item.forEach(collect); return; }
      if (!item) return;
      if (typeof item === 'object') {
        var url = item.url || item.driveUrl || item.downloadUrl || item.fileUrl;
        if (url) { add(url); return; }
        var id = String(item.driveFileId || item.fileId || item.id || '');
        if (/^[A-Za-z0-9_-]+$/.test(id)) add('https://drive.google.com/file/d/' + id + '/view');
        return;
      }
      if (typeof item !== 'string') return;
      try { var parsed = JSON.parse(item); collect(parsed); return; } catch (_) {}
      item.split(/\r?\n/).forEach(add);
    };
    collect(value);
    return links.join('\n');
  }

  function reportPayrollMonth_(value, spreadsheet) {
    if (Object.prototype.toString.call(value) === '[object Date]') {
      if (isNaN(value.getTime())) return '';
      // Cell dates belong to the spreadsheet timezone, which can differ from
      // the script timezone (and UTC) at the start of a month.
      var timezone = spreadsheet.getSpreadsheetTimeZone ? spreadsheet.getSpreadsheetTimeZone() : 'Etc/UTC';
      return Utilities.formatDate(value,timezone,'yyyy-MM');
    }
    var text = String(value == null ? '' : value).trim();
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : '';
  }

  function reportLiteralTextColumn_(header) {
    var key = String(header).toLowerCase().replace(/[^a-z0-9]/g,'');
    return /phone|contact/.test(key) || [
      'payrollmonth','month','homenumber','mobilenumber','alternativenumber',
      'accountnumber','citizenshipnumber','personalpanno','panvatno','panno','vatno',
      'registrationnumber','invoicenumber','voucherno','tableno',
      'recordid','vendorid','employeeid','staffid','studentid','customerid',
      'payrollid','paymentid','receiptid','purchaseid','purchaseitemid','ledgerid',
      'itemid','inventoryitemid','menuitemid','categoryid','recipeid','recipeitemid','transactionid'
    ].indexOf(key) !== -1;
  }

  // Repair only supplied text cells that Sheets parsed as dates or numbers.
  // Rich Text writes an explicit string without changing table column types.
  // Group neighbouring cells to avoid an API call for each individual record.
  function restoreReportLiteralText_(sheet, headers, written, saved) {
    var repaired = false;
    headers.forEach(function(header,column) {
      if (!reportLiteralTextColumn_(header)) return;
      var monthColumn = String(header).toLowerCase().replace(/[^a-z0-9]/g,'') === 'payrollmonth';
      var cells = written.filter(function(entry) {
        var expected = entry.values[column];
        var actual = saved[entry.row-2];
        if (monthColumn && actual) {
          var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
          var expectedMonth = reportPayrollMonth_(expected,spreadsheet);
          if (expectedMonth && expectedMonth === reportPayrollMonth_(actual[column],spreadsheet)) return false;
        }
        return actual && entry.supplied[column] &&
          String(expected == null ? '' : expected) !== String(actual[column] == null ? '' : actual[column]);
      }).sort(function(left,right) { return left.row-right.row; });
      var start = 0;
      while (start < cells.length) {
        var end = start+1;
        while (end < cells.length && cells[end].row === cells[end-1].row+1) end++;
        var textValues = cells.slice(start,end).map(function(entry) {
          var value = entry.values[column];
          return [SpreadsheetApp.newRichTextValue().setText(String(value == null ? '' : value)).build()];
        });
        var textRange = sheet.getRange(cells[start].row,column+1,textValues.length,1);
        // An existing number/date format can keep coercing the replacement.
        // Set text format before rewriting the original string (not the
        // already-coerced saved value). Table-owned formats may forbid this.
        try { textRange.setNumberFormat('@'); }
        catch (error) {
          if (!/typed column/i.test(String(error && error.message || error))) throw error;
        }
        textRange.setRichTextValues(textValues);
        repaired = true;
        start = end;
      }
    });
    return repaired;
  }

  // Can also be run once from the Apps Script editor after updating this file.
  function removeDuplicateVendors() {
    return upsertReport_({ reportKey: "vendors", rows: [], submissionId: "vendor-cleanup" });
  }

  function upsertReport_(request) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try { return upsertReportLocked_(request); }
    finally { lock.releaseLock(); }
  }

  function upsertReportLocked_(request) {
    if (!request || !Array.isArray(request.rows) || request.rows.some(function(row) { return !row || typeof row !== 'object' || Array.isArray(row); })) {
      return jsonResponse(false,'Report records must be an array of records. Create a new preview.');
    }
    var sheets = { students: "Students", staff: "Staff", courses: "Courses",
      vendors: "Vendors", inventory: "Inventory",
      "cafe-sales": "CafeSales", expenses: "Expenses", purchases: "Purchases",
      payroll: "Payroll", "student-payments": "StudentPayments",
      "student-ledger": "StudentLedger", "vendor-payments": "VendorPayments" };
    sheets["vendor-ledger"] = "Vendor Ledger";
    sheets["credit-customers"] = "CafeCustomers";
    sheets["credit-customer-ledger"] = "CustomerLedger";
    Object.assign(sheets, {
      "customer-payments": "CustomerPayments", "due-received": "DueReceived",
      "credit-sales": "CreditSales", "staff-payments": "StaffPayments",
      "cafe-tables": "CafeTables", "cafe-menu": "CafeMenu", "cafe-categories": "CafeCategories",
      "cafe-daily-sales": "CafeDailySales", "purchase-items": "PurchaseItems",
      "inventory-transactions": "InventoryTransactions", "cafe-recipes": "CafeRecipes",
      "cafe-recipe-items": "CafeRecipeItems", "payroll-summary": "PayrollSummary", "payment-out": "PaymentOut"
    });
    var key = String(request.reportKey || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (key === "studentpayment" || key === "studentpayments") key = "student-payments";
    if (key === "studentledger") key = "student-ledger";
    var sheetName = sheets[key];
    if (!sheetName) return jsonResponse(false, "Unknown report.");
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet && spreadsheet.getSheets) {
      var matchingSheets = spreadsheet.getSheets().filter(function(item) { return item.getName().trim().toLowerCase().replace(/[\s_-]+/g,'') === sheetName.toLowerCase().replace(/[\s_-]+/g,''); });
      if (matchingSheets.length > 1) throw new Error('Ambiguous report sheet: '+sheetName);
      sheet = matchingSheets[0];
    }
    if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet((key === 'students' || key === 'staff') ? sheetName.toLowerCase() : sheetName);
    var actualSheetName = sheet.getName ? sheet.getName() : sheetName;
    if (!sheet.getLastRow()) {
      var requiredHeaders = getDatabaseStructure()[sheetName];
      if (!requiredHeaders) return jsonResponse(false, "Missing schema: " + sheetName);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var normalize = function (value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
    // Vendor ID must survive even when the legacy vendor sheet has no ID column.
    var idColumn = headers.findIndex(function(header) { return normalize(header)==='recordid'; });
    if (idColumn < 0) {
      headers.push("Record ID");
      sheet.getRange(1, headers.length, 1, 1).setValues([["Record ID"]]);
      idColumn = headers.length-1;
    }
    if (key === 'vendor-ledger') {
      ['Vendor ID','PAN/VAT No.','Address','Contact No','Email','Status'].forEach(function(header) {
        if (!headers.some(function(existing) { return normalize(existing)===normalize(header); })) {
          headers.push(header);
          sheet.getRange(1,headers.length,1,1).setValues([[header]]);
        }
      });
    }
    if (!Array.isArray(request.rows)) return jsonResponse(false, "Report rows must be an array.");
    var rows = request.rows;
    var suppliedCells = [];
    var values = rows.map(function (row) {
      var supplied = [];
      var mapped = headers.map(function (header,index) {
        var wanted = normalize(header);
        if (wanted === "recordid") { var id=row.id || row.ledger_id || row.ledgerId || row["Vendor ID"] || row.vendor_id || row.employee_id || row.customer_id || ""; supplied[index]=Boolean(id); return id; }
        var found = Object.keys(row).find(function (name) { return normalize(name) === wanted; });
        if (found === undefined) found = Object.keys(row).find(function (name) {
          var candidate = normalize(name);
          var aliases = {
            panvatno: ["panvatno", "panno", "pan"],
            name: ["vendorname", "name"],
            vendorname: ["name"], vendorid: ["id"], recipeid: ["id"], recipeitemid: ["id"], payrollid: ["id"],
            personaladdress: ["address"], fathersname: ["fathername"], mothersname: ["mothername"],
            grandfathersname: ["grandfathername"], grandmothersname: ["grandmothername"],
            purchased: ["totalpurchasedamount"], totalpurchased: ["totalpurchasedamount"],
            inventoryitemid: ["inventoryid"],
            contactno: ["contactnumber", "contactno"],
            paymentid: ["id", "paymentid"],
            purchaseid: ["id", "purchaseid"],
            receiptid: ["id", "receiptid"],
            vendorpaymentid: ["id", "paymentid"],
            staffpaymentid: ["id", "paymentid"],
            amount: ["amount", "paidamount"],
            paymentdate: ["paymentdate", "date"],
            paymentmethod: ["paymentmethod", "method"],
            remarks: ["remarks", "notes"],
            customerid: ["id"],
            customername: ["name"],
            ledgerid: ["id"],
            recordid: ["id", "ledgerid", "customerid", "employeeid"],
            creditsaleid: ["id"], categoryid: ["id"], itemid: ["id"],
            purchaseitemid: ["id"], transactionid: ["id"], expenseid: ["id"],
            categoryname: ["name"], itemname: ["name"], expensename: ["name"],
            phonenumber: ["phone"], currentstock: ["quantity"],
            sellingprice: ["price"], available: ["status"], rate: ["unitprice"],
            invoicenumber: ["invoiceno"], totalamount: ["grandtotal"],
            passportsizephoto: ["passportphoto"], studentdrivefolder: ["studentfolder"], employeedrivefolder: ["stafffolder"],
            passportphoto: ["passportsizephoto"], employeedocuments: ["documents", "documentsuploaded"], documentsuploaded: ["documents"],
            employeefolder: ["stafffolder"], employeedrivefolderid: ["stafffolder"],
            course: ["coursename"], date: ["saledate", "purchasedate", "closingdate", "transactiondate"],
            cashsales: ["cash"], qrsales: ["qr"], creditsales: ["credit"],
            totalsales: ["total"], transaction: ["transactioncount"],
            paymenttype: ["payeetype"], paidamount: ["amount", "totalpaidamount"],
            voucherno: ["id"], payeename: ["vendorname", "employeename"],
          };
          // A row's primary ID must never populate an unrelated foreign ID.
          if (candidate === 'id') {
            var primaryHeaders = {
              vendors:['vendorid'], 'vendor-ledger':['vendorid'], payroll:['payrollid'],
              purchases:['purchaseid'], 'purchase-items':['purchaseitemid'],
              inventory:['itemid'], 'inventory-transactions':['transactionid'],
              'cafe-menu':['itemid'], 'cafe-categories':['categoryid'],
              'credit-customers':['customerid'], 'credit-sales':['creditsaleid'],
              'cafe-recipes':['recipeid'], 'cafe-recipe-items':['recipeitemid'],
              expenses:['expenseid'], 'student-ledger':['ledgerid'], 'credit-customer-ledger':['ledgerid'],
              'student-payments':['paymentid'], 'vendor-payments':['paymentid','vendorpaymentid'],
              'staff-payments':['paymentid','staffpaymentid'], 'customer-payments':['paymentid'],
              'due-received':['receiptid'], 'payment-out':['paymentid','voucherno']
            };
            return (primaryHeaders[key] || []).indexOf(wanted) !== -1;
          }
          if (wanted === 'categoryname' && candidate === 'name' && key !== 'cafe-categories') return false;
          return candidate === wanted ||
            (aliases[wanted] && aliases[wanted].indexOf(candidate) !== -1) ||
            (wanted === "date" && (candidate === "saledate" || candidate === "expensedate" || candidate === "paymentdate" || candidate === "joiningdate"));
        });
        var value = found === undefined ? "" : row[found];
        supplied[index] = found !== undefined;
        if (wanted === "documents") return reportDocumentLinks_(value);
        if (value && typeof value === "object") value = JSON.stringify(value, null, 2);
        var headerKey = normalize(header);
        if (value !== "" && value !== null && value !== undefined &&
            /date|createdat|updatedat|lastlogin/.test(headerKey)) {
          var parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) value = parsedDate;
        }
        return value === null || value === undefined ? "" : value;
      });
      suppliedCells.push(supplied);
      return mapped;
    });
    var appendValues = [];
    var columnValue = function (value, names) {
      var index = headers.findIndex(function (header) {
        return names.indexOf(normalize(header)) !== -1;
      });
      return index >= 0 ? String(value[index] == null ? "" : value[index]).trim() : "";
    };
    var identityFor = function (value) {
      if (key === "vendors" || key === "vendor-ledger") {
        var vendorRecordId = String(value[idColumn] || columnValue(value,['vendorid']) || "").trim();
        return vendorRecordId ? "id:"+vendorRecordId : vendorReportIdentity_(headers, value);
      }
      if (key === "students") {
        var registration = columnValue(value, ["registrationnumber"]);
        if (registration) return "student:" + registration.toLowerCase();
      }
      if (key === "staff") {
        var staffEmployeeId = columnValue(value, ["employeeid", "staffid"]);
        if (staffEmployeeId) return "staff:" + staffEmployeeId.toLowerCase();
      }
      var recordId = idColumn >= 0 ? String(value[idColumn] || "").trim() : "";
      if (recordId) return "id:" + recordId;
      var employeeId = columnValue(value, ["employeeid", "staffid"]);
      var payrollMonth = columnValue(value, ["payrollmonth", "month"]);
      var studentId = columnValue(value, ["studentid", "registrationnumber"]);
      var customerId = columnValue(value, ["customerid"]);
      var paymentDate = columnValue(value, ["paymentdate", "date"]);
      var amount = columnValue(value, ["amount", "paidamount", "totalamount"]);
      if (key === "payroll" && employeeId && payrollMonth) {
        return "payroll:" + employeeId + "|" + payrollMonth;
      }
      if (key === "payroll-summary" && employeeId) {
        return "payroll-summary:" + employeeId;
      }
      if (key === "student-payments" && studentId && paymentDate && amount) {
        return "student-payment:" + studentId + "|" + paymentDate + "|" + amount;
      }
      if (key === "customer-payments" && customerId && paymentDate && amount) {
        return "customer-payment:" + customerId + "|" + paymentDate + "|" + amount;
      }
      if (key === "due-received" && customerId && paymentDate && amount) {
        return "due-received:" + customerId + "|" + paymentDate + "|" + amount;
      }
      if (key === "purchases") {
        var purchaseIdentity = [
          value[headers.findIndex(function (header) { return normalize(header) === "date"; })],
          value[headers.findIndex(function (header) { return normalize(header) === "vendorid"; })],
          value[headers.findIndex(function (header) { return normalize(header) === "invoicenumber"; })],
          value[headers.findIndex(function (header) { return normalize(header) === "totalamount"; })],
        ].map(function (item) { return String(item == null ? "" : item).trim(); }).join("|");
        if (purchaseIdentity.replace(/\|/g, "")) return "purchase:" + purchaseIdentity;
      }
      return "";
    };
    if (key === "vendors" && values.some(function (value) { return !identityFor(value); })) {
      return jsonResponse(false, "Each vendor needs PAN/VAT and name, or name, contact and address, or a Vendor ID.");
    }
    var duplicatesRemoved = 0;
    var dedupeReports = [
      "vendors", "purchases", "payroll", "payroll-summary",
      "student-payments", "customer-payments", "due-received"
    ];
    if (dedupeReports.indexOf(key) !== -1 && sheet.getLastRow() > 1) {
      var existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
      var seenExisting = {};
      var duplicateRows = [];
      existingRows.forEach(function (existingValue, existingIndex) {
        var identity = identityFor(existingValue);
        if (!identity) return;
        if (seenExisting[identity]) duplicateRows.push(existingIndex + 2);
        else seenExisting[identity] = true;
      });
      if (duplicateRows.length) {
        sheet.copyTo(SpreadsheetApp.getActiveSpreadsheet()).setName(sheetName + " backup " + Utilities.getUuid().slice(0, 8));
      }
      duplicatesRemoved = duplicateRows.length;
      duplicateRows.sort(function (left, right) { return right - left; }).forEach(function (rowNumber) {
        sheet.deleteRow(rowNumber);
      });
    }
    var knownRows = {};
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().forEach(function (value, index) {
        var identity = identityFor(value);
        if (identity) knownRows[identity] = index + 2;
        // Match old rows once by their business identity, then persist the local ID.
        if ((key === 'vendors' || key === 'vendor-ledger') && !value[idColumn]) {
          var legacyIdentity=vendorReportIdentity_(headers,value);
          if(legacyIdentity)knownRows[legacyIdentity]=index+2;
        }
      });
    }
    var validatedValues = [];
    var validatedSupplied = [];
    var payloadRowsByIdentity = {};
    values.forEach(function (value,index) {
      var identity = identityFor(value);
      if (!identity) {
        validatedValues.push(value);
        validatedSupplied.push(suppliedCells[index]);
        return;
      }
      if (payloadRowsByIdentity[identity] !== undefined) {
        validatedValues[payloadRowsByIdentity[identity]] = value;
        validatedSupplied[payloadRowsByIdentity[identity]] = suppliedCells[index];
      } else {
        payloadRowsByIdentity[identity] = validatedValues.length;
        validatedValues.push(value);
        validatedSupplied.push(suppliedCells[index]);
      }
    });
    var written = [];
    validatedValues.forEach(function (value,index) {
      var existingRow = -1;
      var identity = identityFor(value);
      if (identity && knownRows[identity]) existingRow = knownRows[identity];
      if (existingRow < 0 && (key === 'vendors' || key === 'vendor-ledger')) {
        var legacyIdentity=vendorReportIdentity_(headers,value);
        if (legacyIdentity && knownRows[legacyIdentity]) {
          existingRow = knownRows[legacyIdentity];
          delete knownRows[legacyIdentity];
          knownRows[identity] = existingRow;
        }
      }
      if (existingRow > sheet.getLastRow()) {
        appendValues[existingRow - sheet.getLastRow() - 1] = value;
      } else if (existingRow > 0) {
        var range=sheet.getRange(existingRow,1,1,headers.length);
        var previous=range.getValues()[0];
        var formulas=range.getFormulas ? range.getFormulas()[0] : [];
        value=value.map(function(cell,column) { return validatedSupplied[index][column] ? cell : formulas[column] || previous[column]; });
        range.setValues([value]);
      }
      else if (identity) {
        appendValues.push(value);
        knownRows[identity] = sheet.getLastRow() + appendValues.length;
      } else appendValues.push(value);
      var rowNumber=existingRow>0 ? existingRow : sheet.getLastRow()+appendValues.length;
      written.push({row:rowNumber,values:value,supplied:validatedSupplied[index]});
    });
    if (appendValues.length) sheet.getRange(sheet.getLastRow() + 1, 1, appendValues.length, headers.length).setValues(appendValues);
    formatSheet_(sheet);
    formatReportSheet_(sheet);
    SpreadsheetApp.flush();
    if (written.length) {
      var saved=sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
      if (restoreReportLiteralText_(sheet,headers,written,saved)) {
        SpreadsheetApp.flush();
        saved=sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
      }
      var comparable=function(value, header) {
        if (value === null || value === undefined || value === "") return "";
        if (normalize(header) === 'payrollmonth') {
          var month = reportPayrollMonth_(value,spreadsheet);
          return month || 'invalid-month:'+Object.prototype.toString.call(value)+':'+String(value);
        }
        if (Object.prototype.toString.call(value)==='[object Date]') {
          var headerKey = normalize(header);
          var format = /date|birth|joining/.test(headerKey) && !/created|updated|submitted|transaction/.test(headerKey)
            ? "yyyy-MM-dd"
            : "yyyy-MM-dd HH:mm:ss";
          var timezone = typeof Session !== "undefined" && Session.getScriptTimeZone
            ? Session.getScriptTimeZone()
            : "Etc/UTC";
          return Utilities.formatDate
            ? Utilities.formatDate(value, timezone, format)
            : String(value.getTime());
        }
        var key = normalize(header);
        var numeric = /(?:amount|fee|salary|price|stock|quantity|balance)$/.test(key) ||
          ['subtotal','totalbill','discount','tax','tds','bonus','allowance','deduction','rate','totalearning','totalearnings',
           'totalpaid','totaldue','totaloutstanding','totaladvance','normalworkingdays','daysworked','creditlimit',
           'capacity','reorderlevel','cashsales','qrsales','creditsales','totalsales','transaction','purchased','paid','due','previousdue','remainingdue'].indexOf(key) !== -1;
        // SQLite decimals arrive as strings; Sheets can return the same amount
        // as a number. Keep identifiers and phone numbers as exact text.
        if (numeric && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value)) && isFinite(Number(value))) return String(Number(value));
        return String(value);
      };
      written.forEach(function(entry) {
        var actual=saved[entry.row-2];
        var mismatch = actual ? entry.values.findIndex(function(value,column) {
          return entry.supplied[column] && comparable(value, headers[column])!==comparable(actual[column], headers[column]);
        }) : -1;
        if (!actual || mismatch >= 0) {
          var diagnostic = '';
          if (actual && normalize(headers[mismatch]) === 'payrollmonth') {
            diagnostic = ' [REPORT-MONTH-3: expected '+(reportPayrollMonth_(entry.values[mismatch],spreadsheet) || 'invalid month')+
              '; read '+(reportPayrollMonth_(actual[mismatch],spreadsheet) || 'invalid month')+
              '; type '+Object.prototype.toString.call(actual[mismatch]).slice(8,-1)+']';
          } else if (actual && reportLiteralTextColumn_(headers[mismatch])) {
            var expectedText = String(entry.values[mismatch] == null ? '' : entry.values[mismatch]);
            var savedText = String(actual[mismatch] == null ? '' : actual[mismatch]);
            diagnostic = ' [REPORT-TEXT-4: expected '+expectedText.length+' characters; read '+savedText.length+
              '; type '+Object.prototype.toString.call(actual[mismatch]).slice(8,-1)+
              '. Set the '+headers[mismatch]+' column type to Text in '+actualSheetName+' and retry.]';
          }
          throw new Error('Sheet write verification failed for '+actualSheetName+' row '+entry.row+(mismatch >= 0 ? ', column '+headers[mismatch] : '')+diagnostic);
        }
      });
    }
    writeAuditLog_(request, "SUBMIT_REPORT", key, String(request.submissionId || ""), validatedValues.length + " unique rows upserted to " + sheetName);
    var sheetUrl=spreadsheet.getUrl && sheet.getSheetId ? spreadsheet.getUrl().replace(/#.*$/,'')+'#gid='+sheet.getSheetId() : '';
    return jsonResponse(true, "Report submitted without duplicate records.", { submissionId: String(request.submissionId || Utilities.getUuid()), rows: validatedValues.length, requestedRows: rows.length, verifiedRows: written.length, sheet: actualSheetName, sheetUrl: sheetUrl, duplicatesRemoved: duplicatesRemoved });
  }

  function writeAuditLog_(request, action, entity, recordId, description) {
    writeAuditLog(request.userId || "", request.username || "", request.role || "", action, "Reports", recordId, description);
  }
function userColumnIndexes_(headers) {
  const indexes = {};
  headers.forEach(function (header, index) {
    indexes[String(header).trim()] = index;
  });
  return indexes;
}

function createInitialUsers_(sheet, headers, indexes) {
  const now = new Date();
  const records = [
    {
      username: "admin",
      fullName: "Admin User",
      role: "ADMIN",
      password: "admin123",
    },
    {
      username: "kcmtadmin",
      fullName: "KCMT Administrator",
      role: "ADMIN",
      password: "adminkcmt",
    },
    {
      username: "cashier",
      fullName: "Cashier User",
      role: "CASHIER",
      password: "cashier123",
    },
  ];
  const existingRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    : [];
  const existingUsernames = existingRows.map(function (row) {
    return String(row[indexes.Username] || "").trim().toLowerCase();
  });
  let nextUserNumber = existingRows.reduce(function (highest, row) {
    const match = String(row[indexes["User ID"]] || "").match(/^USR-(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  records.forEach(function (record) {
    if (existingUsernames.indexOf(record.username.toLowerCase()) !== -1) return;
    const row = new Array(headers.length).fill("");
    row[indexes["User ID"]] = "USR-" + String(nextUserNumber++).padStart(4, "0");
    row[indexes.Username] = record.username;
    row[indexes["Full Name"]] = record.fullName;
    row[indexes.Role] = record.role;
    row[indexes["Password Hash"]] = hashUserPasswordSecure_(record.password);
    row[indexes.Status] = "Active";
    row[indexes["Created At"]] = now;
    row[indexes["Updated At"]] = now;
    sheet.appendRow(row);
    existingUsernames.push(record.username.toLowerCase());
  });
}

function authenticateUser(request) {
  const username = String((request && request.username) || "").trim();
  const password = String((request && request.password) || "");
  if (!username || !password) {
    return jsonResponse(false, "Username and password are required.");
  }

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const indexes = userColumnIndexes_(headers);
  createInitialUsers_(sheet, headers, indexes);
  const records = getSheetObjects_("Users");
  const user = records.find(function (record) {
    return (
      String(record.Username || "").trim().toLowerCase() === username.toLowerCase() &&
      verifyUserPassword_(password, record["Password Hash"]) &&
      String(record.Status || "Active").trim().toLowerCase() === "active"
    );
  });
  if (!user) return jsonResponse(false, "Invalid username or password.");

  const now = new Date();
  ensurePermissionSheets_();
  if (String(user["Password Hash"] || "").indexOf("$") === -1) {
    sheet
      .getRange(Number(user._row), indexes["Password Hash"] + 1)
      .setValue(hashUserPasswordSecure_(password));
  }
  if (indexes["Last Login"] !== undefined) {
    sheet.getRange(Number(user._row), indexes["Last Login"] + 1).setValue(now);
  }
  const sessionToken = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty(
    "KCMT_SESSION_" + sessionToken,
    JSON.stringify({
      userId: String(user["User ID"] || ""),
      issuedAt: Date.now(),
    }),
  );
  return jsonResponse(true, "Login successful.", {
    userId: String(user["User ID"] || ""),
    username: String(user.Username || ""),
    fullName: String(user["Full Name"] || user.Username || ""),
    role: String(user.Role || "CASHIER").toUpperCase(),
    permissions: permissionsForUser_(user),
    sessionToken: sessionToken,
    loginAt: now.toISOString(),
  });
}

function getUsersForAdmin(request) {
  const user = sessionUser_(request);
  if (!user || permissionsForUser_(user).indexOf("users.view") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to view users.",
    });
  }
  getUsersSheet_();
  const records = getSheetObjects_("Users").map(function (record) {
    return {
      _row: record._row,
      userId: record["User ID"] || "",
      username: record.Username || "",
      fullName: record["Full Name"] || "",
      employeeId: record["Employee ID"] || "",
      role: record.Role || "",
      status: record.Status || "",
      lastLogin: record["Last Login"] || "",
      permissions: permissionsForUser_(record),
    };
  });
  return jsonResponse(true, "Users loaded successfully.", records);
}

function saveSystemUser(request) {
  const payload = request || {};
  const actor = sessionUser_(payload);
  if (!actor) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to modify users.",
    });
  }
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const role = String(payload.role || "").trim().toUpperCase();
  ensurePermissionSheets_();
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
    return jsonResponse(false, "Username must be 3-50 characters and use letters, numbers, ., _ or -.");
  }
  const roleExists = getSheetObjects_("Roles").some(function (record) {
    return String(record["Role Name"] || "").trim().toUpperCase() === role &&
      String(record.Status || "Active").toLowerCase() === "active";
  });
  if (!roleExists && role !== "ADMIN" && role !== "CASHIER") {
    return jsonResponse(false, "The selected role does not exist or is inactive.");
  }
  if (password && password.length < 6) {
    return jsonResponse(false, "Password must contain at least 6 characters.");
  }

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const indexes = userColumnIndexes_(headers);
  const rows = values.slice(1);
  let rowNumber = -1;
  rows.forEach(function (row, index) {
    if (
      (payload.userId &&
      String(row[indexes["User ID"]] || "") === String(payload.userId)) ||
      (!payload.userId &&
      String(row[indexes.Username] || "").trim().toLowerCase() ===
      username.toLowerCase())
    ) {
      rowNumber = index + 2;
    }
  });
  if (rowNumber < 0 && !password) {
    return jsonResponse(false, "A password is required when creating a user.");
  }
  const isUpdate = rowNumber > 0;
  const actorPermissions = permissionsForUser_(actor);
  if (
    actorPermissions.indexOf(isUpdate ? "users.modify" : "users.add") === -1
  ) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to modify users.",
    });
  }
  const now = new Date();
  const row = rowNumber > 0
    ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]
    : new Array(headers.length).fill("");
  if (rowNumber < 0) {
    rowNumber = sheet.getLastRow() + 1;
    row[indexes["User ID"]] =
      "USR-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    row[indexes["Created At"]] = now;
  }
  const protectedAdmin =
    String(row[indexes["User ID"]] || "") === "USR-0001" ||
    String(row[indexes.Username] || "").trim().toLowerCase() === "admin";
  if (
    protectedAdmin &&
    (role !== "ADMIN" ||
      String(payload.status || "Active").toLowerCase() === "inactive")
  ) {
    return jsonResponse(false, "The primary administrator cannot be demoted or disabled.");
  }
  // A signed-in administrator changing their own password must prove knowledge
  // of the current one. Other user-management updates keep their existing
  // permission-based authorization flow.
  if (
    password &&
    String(row[indexes["User ID"]] || "") === String(actor["User ID"] || "")
  ) {
    const currentPassword = String(payload.currentPassword || "");
    if (!currentPassword || !verifyUserPassword_(currentPassword, row[indexes["Password Hash"]])) {
      return jsonResponse(false, "Your current password is incorrect.");
    }
  }
  row[indexes.Username] = username;
  row[indexes["Full Name"]] = String(payload.fullName || username).trim();
  row[indexes["Employee ID"]] = String(payload.employeeId || "").trim();
  row[indexes.Role] = role;
  row[indexes.Status] = String(payload.status || "Active").toLowerCase() === "inactive"
    ? "Inactive"
    : "Active";
  if (password) row[indexes["Password Hash"]] = hashUserPasswordSecure_(password);
  row[indexes["Updated At"]] = now;
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  writeAuditLog(
    actor["User ID"],
    actor.Username,
    actor.Role,
    isUpdate ? "User updated" : "User created",
    "Users",
    row[indexes["User ID"]],
    username,
  );
  return jsonResponse(true, isUpdate
    ? "User updated successfully."
    : "User created successfully.");
}

function deleteSystemUser(request) {
  const actor = sessionUser_(request);
  if (!actor || permissionsForUser_(actor).indexOf("users.delete") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to delete users.",
    });
  }
  const targetId = String((request && request.userId) || "").trim();
  const targetUsername = String((request && request.username) || "").trim().toLowerCase();
  const records = getSheetObjects_("Users");
  const target = records.find(function (record) {
    return (
      (targetId && String(record["User ID"] || "") === targetId) ||
      (targetUsername &&
        String(record.Username || "").trim().toLowerCase() === targetUsername)
    );
  });
  if (!target) return jsonResponse(false, "User not found.");
  if (
    String(target["User ID"] || "") === "USR-0001" ||
    String(target.Username || "").trim().toLowerCase() === "admin"
  ) {
    return jsonResponse(false, "The primary administrator cannot be deleted.");
  }
  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("Users")
    .deleteRow(Number(target._row));
  writeAuditLog(
    actor["User ID"],
    actor.Username,
    actor.Role,
    "User deleted",
    "Users",
    target["User ID"],
    target.Username,
  );
  return jsonResponse(true, "User deleted successfully.");
}

function getRolesForAdmin(request) {
  const actor = sessionUser_(request);
  if (!actor || permissionsForUser_(actor).indexOf("users.view") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to view roles.",
    });
  }
  ensurePermissionSheets_();
  return jsonResponse(true, "Roles loaded successfully.", getSheetObjects_("Roles"));
}

function saveSystemRole(request) {
  const payload = request || {};
  const actor = sessionUser_(payload);
  if (!actor || permissionsForUser_(actor).indexOf("users.modify") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to modify roles.",
    });
  }
  ensurePermissionSheets_();
  const name = String(payload.roleName || "").trim().toUpperCase();
  if (!/^[A-Z0-9 _-]{2,50}$/.test(name)) {
    return jsonResponse(false, "Role name is invalid.");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Roles");
  const headers = sheet.getDataRange().getValues()[0];
  const indexes = userColumnIndexes_(headers);
  const records = getSheetObjects_("Roles");
  let rowNumber = -1;
  records.forEach(function (record) {
    if (String(record["Role ID"] || "") === String(payload.roleId || "")) {
      rowNumber = Number(record._row);
    }
  });
  const existing = records.find(function (record) {
    return (
      String(record["Role Name"] || "").toUpperCase() === name &&
      Number(record._row) !== rowNumber
    );
  });
  if (existing) return jsonResponse(false, "Role name already exists.");
  if (rowNumber < 0) {
    rowNumber = sheet.getLastRow() + 1;
    const row = new Array(headers.length).fill("");
    row[indexes["Role ID"]] = "ROLE-" + Utilities.getUuid().slice(0, 8).toUpperCase();
    row[indexes["Role Name"]] = name;
    row[indexes.Description] = String(payload.description || "").trim();
    row[indexes.Status] = "Active";
    row[indexes["Created At"]] = new Date();
    row[indexes["Updated At"]] = new Date();
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  } else {
    const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    if (String(row[indexes["Role Name"]] || "").toUpperCase() === "ADMIN") {
      return jsonResponse(false, "The primary administrator role cannot be changed.");
    }
    row[indexes["Role Name"]] = name;
    row[indexes.Description] = String(payload.description || "").trim();
    row[indexes.Status] = String(payload.status || "Active").toLowerCase() === "inactive"
      ? "Inactive"
      : "Active";
    row[indexes["Updated At"]] = new Date();
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  }
  writeAuditLog(
    actor["User ID"],
    actor.Username,
    actor.Role,
    "Role saved",
    "Roles",
    payload.roleId || "",
    name,
  );
  return jsonResponse(true, "Role saved successfully.");
}

function deleteSystemRole(request) {
  const actor = sessionUser_(request);
  if (!actor || permissionsForUser_(actor).indexOf("users.delete") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to delete roles.",
    });
  }
  const roleId = String((request && request.roleId) || "").trim();
  const role = getSheetObjects_("Roles").find(function (record) {
    return String(record["Role ID"] || "") === roleId;
  });
  if (!role) return jsonResponse(false, "Role not found.");
  if (String(role["Role Name"] || "").toUpperCase() === "ADMIN") {
    return jsonResponse(false, "The primary administrator role cannot be deleted.");
  }
  const users = getSheetObjects_("Users").filter(function (record) {
    return String(record.Role || "").toUpperCase() ===
      String(role["Role Name"] || "").toUpperCase();
  });
  if (users.length) return jsonResponse(false, "Role is assigned to existing users.");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Roles");
  sheet.deleteRow(Number(role._row));
  writeAuditLog(
    actor["User ID"],
    actor.Username,
    actor.Role,
    "Role deleted",
    "Roles",
    roleId,
    role["Role Name"],
  );
  return jsonResponse(true, "Role deleted successfully.");
}

function getPermissionMatrix(request) {
  const actor = sessionUser_(request);
  if (!actor || permissionsForUser_(actor).indexOf("users.view") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to view permissions.",
    });
  }
  ensurePermissionSheets_();
  return jsonResponse(true, "Permissions loaded successfully.", {
    permissions: getSheetObjects_("Permissions"),
    rolePermissions: getSheetObjects_("RolePermissions"),
    userPermissions: getSheetObjects_("UserPermissions"),
  });
}

function savePermissionAssignments(request) {
  const actor = sessionUser_(request);
  if (!actor || permissionsForUser_(actor).indexOf("users.modify") === -1) {
    return jsonResponse(false, "ACCESS_DENIED", {
      error: "ACCESS_DENIED",
      message: "You do not have permission to modify permissions.",
    });
  }
  ensurePermissionSheets_();
  const payload = request || {};
  const allowed = payload.allowed === true || String(payload.allowed).toLowerCase() === "true";
  const permissionKey = String(payload.permissionKey || "").trim();
  if (!permissionKey) return jsonResponse(false, "Permission key is required.");
  if (
    permissionDefinitions_().every(function (item) {
      return item[0] !== permissionKey;
    })
  ) {
    return jsonResponse(false, "Permission key is invalid.");
  }
  const targetType = String(payload.targetType || "role").toLowerCase();
  const targetId = String(payload.targetId || "").trim();
  if (targetType === "role") {
    const protectedRole = getSheetObjects_("Roles").find(function (record) {
      return String(record["Role ID"] || "") === targetId;
    });
    if (
      protectedRole &&
      String(protectedRole["Role Name"] || "").toUpperCase() === "ADMIN"
    ) {
      return jsonResponse(false, "The primary administrator permissions cannot be changed.");
    }
  }
  if (targetType === "user" && targetId === "USR-0001") {
    return jsonResponse(false, "The primary administrator permissions cannot be changed.");
  }
  const sheetName = targetType === "user" ? "UserPermissions" : "RolePermissions";
  const targetColumn = targetType === "user" ? "User ID" : "Role ID";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const indexes = userColumnIndexes_(headers);
  let rowNumber = -1;
  values.slice(1).forEach(function (row, index) {
    if (
      String(row[indexes[targetColumn]] || "") === targetId &&
      String(row[indexes["Permission Key"]] || "") === permissionKey
    ) {
      rowNumber = index + 2;
    }
  });
  if (rowNumber < 0) {
    const row = new Array(headers.length).fill("");
    row[indexes[targetColumn]] = targetId;
    row[indexes["Permission Key"]] = permissionKey;
    row[indexes.Allowed] = allowed;
    row[indexes["Updated At"]] = new Date();
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowNumber, indexes.Allowed + 1).setValue(allowed);
    sheet.getRange(rowNumber, indexes["Updated At"] + 1).setValue(new Date());
  }
  writeAuditLog(
    actor["User ID"],
    actor.Username,
    actor.Role,
    "Permission changed",
    targetType === "user" ? "UserPermissions" : "RolePermissions",
    targetId,
    permissionKey + "=" + allowed,
  );
  return jsonResponse(true, "Permission saved successfully.");
}

/* ============================================================
   18. STUDENTS
============================================================ */

function getStudents() {
  return getTable("Students");
}

/* ============================================================
   19. STAFF
============================================================ */

function getStaff() {
  return getTable("Staff");
}

/* ============================================================
   20. COURSES
============================================================ */

function getCourses() {
  return getTable("Courses");
}

function saveCourse_(request) {
  request = request || {};

  var courseName = String(
    request.courseName || request["Course Name"] || request.name || "",
  ).trim();

  var duration = String(
    request.duration || request["Duration"] || request.courseDuration || "",
  ).trim();

  var totalFee =
    request.totalFee !== undefined ? request.totalFee : request["Total Fee"];

  if (!courseName) {
    throw new Error("Course name is required.");
  }

  if (!duration) {
    throw new Error("Course duration is required.");
  }

  if (
    totalFee === undefined ||
    totalFee === null ||
    String(totalFee).trim() === "" ||
    isNaN(Number(totalFee)) ||
    Number(totalFee) < 0
  ) {
    throw new Error("Total fee must be a valid non-negative number.");
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Courses");
  if (!sheet) {
    throw new Error("Courses sheet not found.");
  }

  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var requestedRow = Number(request.row || request._row || 0);
  var rowNumber =
    requestedRow >= 2 && requestedRow <= sheet.getLastRow() ? requestedRow : 0;
  var nameColumn = -1;
  var durationColumn = -1;
  var feeColumn = -1;
  var statusColumn = -1;
  var createdAtColumn = -1;
  var updatedAtColumn = -1;

  headers.forEach(function (header, index) {
    var key = String(header || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (key === "coursename" || key === "name") nameColumn = index;
    if (key === "duration" || key === "courseduration") durationColumn = index;
    if (key === "totalfee" || key === "coursefee") feeColumn = index;
    if (key === "status") statusColumn = index;
    if (key === "createdat") createdAtColumn = index;
    if (key === "updatedat") updatedAtColumn = index;
  });

  if (nameColumn === -1 || durationColumn === -1 || feeColumn === -1) {
    throw new Error(
      "Courses sheet must contain Course Name, Duration, and Total Fee columns.",
    );
  }

  var row;
  var now = new Date();
  if (rowNumber) {
    row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  } else {
    row = new Array(lastColumn).fill("");
  }

  row[nameColumn] = courseName;
  row[durationColumn] = duration;
  row[feeColumn] = Number(totalFee);
  if (statusColumn !== -1 && !row[statusColumn]) row[statusColumn] = "Active";
  if (statusColumn !== -1 && request.status) {
    if (["Active", "Off"].indexOf(String(request.status)) === -1)
      throw new Error("Course status must be Active or Off.");
    row[statusColumn] = String(request.status);
  }
  if (createdAtColumn !== -1 && !row[createdAtColumn])
    row[createdAtColumn] = now;
  if (updatedAtColumn !== -1) row[updatedAtColumn] = now;

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    rowNumber = sheet.getLastRow();
  }

  SpreadsheetApp.flush();
  return {
    success: true,
    message:
      rowNumber === sheet.getLastRow() && !requestedRow
        ? "Course added successfully."
        : "Course updated successfully.",
    data: {
      row: rowNumber,
      courseName: courseName,
      duration: duration,
      totalFee: Number(totalFee),
    },
  };
}

function deleteCourse_(request) {
  request = request || {};
  var rowNumber = Number(request.row || request._row || 0);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Courses");

  if (!sheet) {
    throw new Error("Courses sheet not found.");
  }

  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error("A valid course row is required.");
  }

  sheet.deleteRow(rowNumber);
  SpreadsheetApp.flush();
  return {
    success: true,
    message: "Course deleted successfully.",
    data: { row: rowNumber },
  };
}

/* ============================================================
   21. VENDORS
============================================================ */

function getVendorLedgerRecord_(spreadsheet, vendorName) {
  const ledger = getVendorLedgerSheet_(spreadsheet);
  const values = ledger.getDataRange().getValues();
  if (!values.length) return null;
  const headers = values[0] || [];
  const nameIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "vendorname";
  });
  if (nameIndex < 0) return null;
  const targetName = String(vendorName || "")
    .trim()
    .toLowerCase();
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i] || [];
    const rowName = String(row[nameIndex] || "")
      .trim()
      .toLowerCase();
    if (rowName === targetName) return row;
  }
  return null;
}

function getVendorLedgerRecordById_(spreadsheet, vendorId) {
  const ledger = getVendorLedgerSheet_(spreadsheet);
  const values = ledger.getDataRange().getValues();
  if (!values.length) return null;
  const headers = values[0] || [];
  const idIndex = headers.findIndex(function (header) {
    return ["vendorid", "id"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  if (idIndex < 0) return null;
  const targetId = String(vendorId || "")
    .trim()
    .toLowerCase();
  for (let i = 1; i < values.length; i += 1) {
    if (
      String(values[i][idIndex] || "")
        .trim()
        .toLowerCase() === targetId
    )
      return values[i];
  }
  return null;
}

function getVendors() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  syncAllVendorLedgerTotals_(spreadsheet);
  const ledger = getVendorLedgerSheet_(spreadsheet);
  const ledgerValues = ledger.getDataRange().getValues();
  const ledgerHeaders = ledgerValues[0] || [];

  if (ledgerHeaders.length) {
    const findLedgerColumn = function (names) {
      return ledgerHeaders.findIndex(function (header) {
        return names.indexOf(normalizeHeaderKey(header)) !== -1;
      });
    };
    const idIndex = findLedgerColumn(["vendorid", "id"]);
    const nameIndex = findLedgerColumn(["vendorname", "name"]);
    const panIndex = findLedgerColumn(["panvatno", "panno", "vatno"]);
    const addressIndex = findLedgerColumn(["address"]);
    const contactIndex = findLedgerColumn([
      "contactno",
      "contactnumber",
      "phone",
      "contact",
    ]);
    const statusIndex = findLedgerColumn(["status"]);
    const openingBalanceIndex = findLedgerColumn(["openingbalance", "opening"]);

    const totals = getVendorPurchaseTotals_();
    const data = ledgerValues
      .slice(1)
      .filter(function (row) {
        return String(row[nameIndex] || "").trim();
      })
      .map(function (row) {
        const name = String(row[nameIndex] || "").trim();
        const vendorKey = name.toLowerCase();
        const summary = totals[vendorKey] || {
          totalPurchases: 0,
          totalPaid: 0,
          totalDue: 0,
        };

        return {
          "Vendor ID": idIndex >= 0 ? row[idIndex] || "" : "",
          "PAN/VAT No": row[panIndex] || "",
          "Vendor Name": name,
          Address: row[addressIndex] || "",
          "Contact No": row[contactIndex] || "",
          "Opening Balance": row[openingBalanceIndex] || 0,
          Status: row[statusIndex] || "Active",
          totalPurchases: summary.totalPurchases,
          totalPaid: summary.totalPaid,
          totalDue: Number(row[openingBalanceIndex] || 0) + summary.totalDue,
          Purchased: summary.totalPurchases,
          "Paid Amount": summary.totalPaid,
          "Due Amount":
            Number(row[openingBalanceIndex] || 0) + summary.totalDue,
        };
      });

    return jsonResponse(true, "Vendor ledger loaded.", data);
  }

  return jsonResponse(true, "Vendor ledger loaded.", []);
}

/* ============================================================
   22. CAFÉ TABLES
============================================================ */

/*
 * ADD / EDIT TABLE
 *
 * Request:
 *
 * {
 *   tableNo: "T-01",
 *   tableName: "Window Table",
 *   capacity: 4,
 *   status: "Active"
 * }
 */

function saveCafeTable(request) {
  try {
    request = request || {};

    const tableNo = String(request.tableNo || request["Table No"] || "").trim();

    const tableName = String(
      request.tableName || request["Table Name"] || "",
    ).trim();

    const capacity = Number(request.capacity || request["Capacity"] || 0);

    if (!tableNo) {
      return jsonResponse(false, "Table No is required.");
    }

    if (!tableName) {
      return jsonResponse(false, "Table Name is required.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const sheet = ss.getSheetByName("CafeTables");

    if (!sheet) {
      throw new Error("CafeTables sheet not found.");
    }

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    const tableColumn = findColumn(headers, ["Table No"]);

    let row = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][tableColumn] || "").trim() === tableNo) {
        row = i + 1;

        break;
      }
    }

    const record = {
      "Table No": tableNo,

      "Table Name": tableName,

      Capacity: capacity > 0 ? capacity : 1,

      Status: request.status || "Active",

      "Updated At": new Date(),
    };

    /*
     * NEW
     */

    if (row === -1) {
      record["Created At"] = new Date();

      const values = headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      });

      sheet.appendRow(values);

      return jsonResponse(true, "Café table added successfully.", record);
    }

    /*
     * UPDATE
     */

    headers.forEach(function (header, index) {
      if (record[header] !== undefined) {
        sheet.getRange(row, index + 1).setValue(record[header]);
      }
    });

    return jsonResponse(true, "Café table updated successfully.", record);
  } catch (error) {
    return jsonResponse(false, "Café table error: " + error.message);
  }
}

/* ============================================================
   23. GET CAFÉ TABLES
============================================================ */

function getCafeTables() {
  const response = getTable("CafeTables");
  if (!response || !response.success || !Array.isArray(response.data)) {
    return response;
  }
  response.data = response.data.map(function (table) {
    const tableNo = table["Table No"] || table.tableNo || table.table_no || "";
    const tableName =
      table["Table Name"] || table.tableName || table.table_name || tableNo;
    const capacity = table.Capacity || table.capacity || 1;
    return Object.assign({}, table, {
      "Table No": tableNo,
      tableNo: tableNo,
      "Table Name": tableName,
      tableName: tableName,
      Capacity: capacity,
      capacity: capacity,
    });
  });
  return response;
}

/* ============================================================
   24. DISABLE CAFÉ TABLE
============================================================ */

function disableCafeTable(tableNo) {
  return setStatusByKey_("CafeTables", "Table No", tableNo, "Disabled");
}

/* ============================================================
   25. CAFÉ CATEGORIES
============================================================ */

function saveCafeCategory(request) {
  try {
    request = request || {};

    const name = String(
      request.categoryName || request["Category Name"] || "",
    ).trim();

    if (!name) {
      return jsonResponse(false, "Category Name is required.");
    }

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CafeCategories");

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    const nameColumn = findColumn(headers, ["Category Name"]);

    let row = -1;

    for (let i = 1; i < data.length; i++) {
      if (
        String(data[i][nameColumn] || "")
          .trim()
          .toLowerCase() === name.toLowerCase()
      ) {
        row = i + 1;

        break;
      }
    }

    const categoryId =
      request.categoryId ||
      "CAT-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    const requestedCategoryId = String(request.categoryId || "").trim();
    const duplicateCategory = data.slice(1).some(function (row) {
      const sameName =
        String(row[nameColumn] || "").trim().toLowerCase() ===
        name.toLowerCase();
      const existingId = String(row[headers.indexOf("Category ID")] || "").trim();
      return sameName && existingId !== requestedCategoryId;
    });
    if (duplicateCategory) {
      return jsonResponse(false, "Category already exists.");
    }

    const record = {
      "Category ID": categoryId,

      "Category Name": name,

      Description: request.description || "",

      Status: request.status || "Active",

      "Created At": new Date(),

      "Updated At": new Date(),
    };

    if (row === -1) {
      sheet.appendRow(
        headers.map(function (header) {
          return record[header] !== undefined ? record[header] : "";
        }),
      );
    } else {
      headers.forEach(function (header, index) {
        if (record[header] !== undefined) {
          sheet.getRange(row, index + 1).setValue(record[header]);
        }
      });
    }

    return jsonResponse(true, "Café category saved successfully.", record);
  } catch (error) {
    return jsonResponse(false, error.message);
  }
}

/* ============================================================
   26. GET CAFÉ CATEGORIES
============================================================ */

function getCafeCategories() {
  return getTable("CafeCategories");
}

/* ============================================================
   27. CAFÉ MENU
============================================================ */

function saveCafeMenu(request) {
  try {
    request = request || {};

    const itemName = String(
      request.itemName || request["Item Name"] || "",
    ).trim();

    if (!itemName) {
      return jsonResponse(false, "Item Name is required.");
    }

    const sellingPrice = Number(
      request.sellingPrice || request["Selling Price"] || 0,
    );

    if (isNaN(sellingPrice) || sellingPrice < 0) {
      return jsonResponse(
        false,
        "Selling Price must be a valid positive number.",
      );
    }

    const costPrice = Number(
      request.costPrice || request["Cost Price"] || 0,
    );
    const quantity = Number(request.quantity || request.Quantity || 0);
    const unit = String(request.unit || request.Unit || "").trim();
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      return jsonResponse(false, "Cost Price must be a valid non-negative number.");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return jsonResponse(false, "Quantity must be greater than zero.");
    }
    if (!unit) {
      return jsonResponse(false, "Unit is required.");
    }

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CafeMenu");

    let data = sheet.getDataRange().getValues();

    let headers = data[0];
    ["Cost Price", "Quantity", "Unit"].forEach(function (header) {
      if (!headers.some(function (existing) {
        return String(existing).trim().toLowerCase() === header.toLowerCase();
      })) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      }
    });
    data = sheet.getDataRange().getValues();
    headers = data[0];

    const itemColumn = findColumn(headers, ["Item ID"]);

    let row = -1;

    const itemId = String(request.itemId || "").trim();

    /*
     * If Item ID supplied,
     * update by Item ID.
     *
     * Otherwise create new.
     */

    if (itemId) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][itemColumn] || "").trim() === itemId) {
          row = i + 1;

          break;
        }
      }
    }

    const finalItemId =
      itemId || "ITEM-" + Utilities.getUuid().substring(0, 8).toUpperCase();

    const record = {
      "Item ID": finalItemId,

      "Item Name": itemName,

      "Category ID": request.categoryId || "",

      "Category Name": request.categoryName || "",

      "Selling Price": sellingPrice,

      "Cost Price": costPrice,

      Quantity: quantity,

      Unit: unit,

      Available: request.available !== undefined ? request.available : "Yes",

      "Image URL": request.imageUrl || "",

      Description: request.description || "",

      "Updated At": new Date(),
    };

    if (row === -1) {
      record["Created At"] = new Date();

      sheet.appendRow(
        headers.map(function (header) {
          return record[header] !== undefined ? record[header] : "";
        }),
      );
    } else {
      headers.forEach(function (header, index) {
        if (record[header] !== undefined) {
          sheet.getRange(row, index + 1).setValue(record[header]);
        }
      });
    }

    return jsonResponse(true, "Café menu item saved successfully.", record);
  } catch (error) {
    return jsonResponse(false, "Café menu error: " + error.message);
  }
}

/* ============================================================
   28. GET CAFÉ MENU
============================================================ */

function getCafeMenu() {
  return getTable("CafeMenu");
}

/* ============================================================
   29. DISABLE CAFÉ MENU ITEM
============================================================ */

function disableCafeMenuItem(itemId) {
  return setStatusByKey_("CafeMenu", "Item ID", itemId, "No", "Available");
}

/* ============================================================
   30. CAFÉ SALE
============================================================ */

/*
 * IMPORTANT:
 *
 * CafeSales remains:
 *
 * Date
 * Time
 * Table No
 * Total Bill
 * Items Ordered
 * Paid Amount
 * Payment Method
 *
 * No:
 * Sale ID
 * Customer ID
 * Customer Name
 * Cashier
 * Shift
 */

function saveCafeSale(request) {
  try {
    request = request || {};

    const tableNo = String(request.tableNo || request["Table No"] || "").trim();

    const customerId = String(
      request.customerId || request["Customer ID"] || "",
    ).trim();
    const customerName = String(
      request.customerName || request["Customer Name"] || "",
    ).trim();
    const customerPhone = String(
      request.customerPhone || request["Customer Phone"] || "",
    ).trim();

    const itemsOrdered = String(
      request.itemsOrdered || request["Items Ordered"] || "",
    ).trim();

    const totalBill = Number(request.totalBill || request["Total Bill"] || 0);

    const discountAmount = Number(
      request.discountAmount || request["Discount Amount"] || 0,
    );
    const vatAmount = Number(request.vatAmount || request["VAT Amount"] || 0);

    let tenderedAmount = Number(
      request.tenderedAmount || request["Tendered Amount"] || 0,
    );
    let paidAmount = Number(
      request.paidAmount || request["Paid Amount"] || 0,
    );

    let paymentMethod = String(
      request.paymentMethod || request["Payment Method"] || "",
    ).trim();

    if (!tableNo) {
      return jsonResponse(false, "Table No is required.");
    }

    if (!itemsOrdered) {
      return jsonResponse(false, "Items Ordered is required.");
    }

    if (!isFinite(totalBill) || totalBill < 0) {
      return jsonResponse(false, "Invalid Total Bill.");
    }

    if (!isFinite(discountAmount) || discountAmount < 0) {
      return jsonResponse(false, "Invalid Discount Amount.");
    }
    if (!isFinite(vatAmount) || vatAmount < 0) {
      return jsonResponse(false, "Invalid VAT Amount.");
    }

    if (!isFinite(tenderedAmount) || tenderedAmount < 0) {
      return jsonResponse(false, "Invalid Tendered Amount.");
    }
    if (!isFinite(paidAmount) || paidAmount < 0) {
      return jsonResponse(false, "Invalid Paid Amount.");
    }

    // Customer type and payment method are deliberately evaluated here, at
    // the save boundary.  The browser calculation is only a convenience;
    // this prevents an incomplete walk-in payment from becoming a sale when
    // the request is submitted by another client.
    const allowedPayments = ["cash", "qr", "credit"];

    if (allowedPayments.indexOf(paymentMethod.toLowerCase()) === -1) {
      return jsonResponse(
        false,
        "Payment Method must be Cash, QR or Credit.",
      );
    }

    const method = paymentMethod.toLowerCase();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let creditCustomer = null;
    if (customerId) {
      const customerRows = getSheetObjects_("CafeCustomers");
      creditCustomer = customerRows.find(
        (row) => String(row["Customer ID"] || "").trim() === customerId,
      );
      if (!creditCustomer) {
        return jsonResponse(false, "Selected credit customer was not found.");
      }
    }
    const isCreditCustomer = Boolean(creditCustomer);
    if (method === "credit" && !isCreditCustomer) {
      return jsonResponse(false, "Credit payment requires a registered credit customer.");
    }
    if (!isCreditCustomer && method !== "cash" && method !== "qr") {
      return jsonResponse(false, "Walk-in customers may pay only by Cash or QR.");
    }
    if (!isCreditCustomer && tenderedAmount < totalBill) {
      return jsonResponse(
        false,
        "Full payment is required for walk-in customers.\nPlease collect the remaining Rs. " +
          roundMoney(totalBill - tenderedAmount).toFixed(2) + ".",
      );
    }
    if (method === "qr" && tenderedAmount > totalBill) {
      return jsonResponse(false, "QR payment cannot exceed the total bill.");
    }
    if (method === "credit") {
      tenderedAmount = 0;
      paidAmount = 0;
    } else {
      paidAmount = Math.min(tenderedAmount, totalBill);
    }
    const changeAmount = method === "cash"
      ? Math.max(tenderedAmount - totalBill, 0)
      : 0;
    const dueAmount = Math.max(totalBill - paidAmount, 0);
    const paymentStatus = method === "credit"
      ? "CREDIT"
      : dueAmount > 0
        ? "PARTIAL"
        : "PAID";

    const sheet = ss.getSheetByName("CafeSales");

    if (!sheet) {
      return jsonResponse(
        false,
        "CafeSales sheet not found. Run initializeDatabase first.",
      );
    }

    if (customerId && dueAmount > 0) {
      const ledger = JSON.parse(getCustomerLedger().getContent()).data || [];
      const ledgerRecord = ledger.find(
        (row) => String(row["Customer ID"] || "").trim() === customerId,
      );
      const outstanding = Number(
        (ledgerRecord && ledgerRecord["Total Due Amount"]) || 0,
      );
      const creditLimit = Number(creditCustomer["Credit Limit"] || 0);
      const newOutstanding = outstanding + dueAmount;
      if (creditLimit > 0 && newOutstanding > creditLimit) {
        return jsonResponse(
          false,
          "This sale exceeds the customer's credit limit.",
        );
      }
    }

    const now = new Date();

    const timezone = Session.getScriptTimeZone();

    const date = Utilities.formatDate(now, timezone, "yyyy-MM-dd");

    const time = Utilities.formatDate(now, timezone, "HH:mm:ss");

    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf("Receipt ID") === -1) {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue("Receipt ID");
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    if (headers.indexOf("Discount Amount") === -1) {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue("Discount Amount");
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    if (headers.indexOf("VAT Amount") === -1) {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue("VAT Amount");
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
    ["Tendered Amount", "Change Amount", "Due Amount", "Payment Status"].forEach(
      function (header) {
        if (headers.indexOf(header) === -1) {
          sheet.insertColumnAfter(headers.length);
          sheet.getRange(1, headers.length + 1).setValue(header);
          headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        }
      },
    );

    const record = {
      "Receipt ID": "CR-" + Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase(),
      Date: date,

      Time: time,

      "Table No": tableNo,
      "Customer ID": customerId,
      "Customer Name": customerName,
      "Customer Phone": customerPhone,
      "Discount Amount": roundMoney(discountAmount),
      "VAT Amount": roundMoney(vatAmount),

      "Total Bill": roundMoney(totalBill),

      "Items Ordered": itemsOrdered,

      "Tendered Amount": roundMoney(tenderedAmount),

      "Paid Amount": roundMoney(paidAmount),

      "Change Amount": roundMoney(changeAmount),

      "Due Amount": roundMoney(dueAmount),

      "Payment Status": paymentStatus,

      "Payment Method": paymentMethod.toUpperCase(),
    };

    sheet.appendRow(
      headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      }),
    );
    record.receiptId = record["Receipt ID"];

    if (customerId && dueAmount > 0) {
      const creditSalesSheet = ss.getSheetByName("CreditSales");
      if (creditSalesSheet) {
        const creditHeaders = creditSalesSheet
          .getRange(1, 1, 1, creditSalesSheet.getLastColumn())
          .getValues()[0];
        const creditRecord = {
          "Credit Sale ID": "CS-" + new Date().getTime(),
          "Customer ID": customerId,
          "Customer Name": customerName,
          "Customer Phone": customerPhone,
          "Sale Date": date,
          "Table No": tableNo,
          "Total Bill": roundMoney(totalBill),
          "Paid Amount": roundMoney(paidAmount),
          "Due Amount": roundMoney(dueAmount),
          "Payment Method": paymentMethod.toUpperCase(),
          "Items Ordered": itemsOrdered,
          "Created At": now,
        };
        creditSalesSheet.appendRow(
          creditHeaders.map(function (header) {
            return creditRecord[header] !== undefined
              ? creditRecord[header]
              : "";
          }),
        );
      }
    }
    if (customerId) {
      refreshCustomerLedger_();
    }

    /*
     * OPTIONAL INVENTORY DEDUCTION
     *
     * This version does NOT attempt to parse
     * free-text items automatically.
     *
     * Inventory can be connected through
     * CafeRecipes later.
     */

    return jsonResponse(true, "Café sale saved successfully.", record);
  } catch (error) {
    return jsonResponse(false, "Café sale error: " + error.message);
  }
}

function getCafeCustomers() {
  return getTable("CafeCustomers");
}

function refreshCustomerLedger_() {
  const customers = getSheetObjects_("CafeCustomers");
  // Only credit-bearing transactions belong in the customer ledger.
  const sales = getOrCreateSheetObjects_("CreditSales", CREDIT_SALES_HEADERS);
  const receipts = getOrCreateSheetObjects_("DueReceived", DUE_RECEIVED_HEADERS);
  const customerById = {};
  customers.forEach(function (customer) {
    const customerId = String(
      recordField_(customer, ["Customer ID", "customerId", "id"]),
    ).trim();
    if (customerId) customerById[customerId] = customer;
  });
  sales.forEach(function (sale) {
    const customerId = String(
      recordField_(sale, ["Customer ID", "customerId", "id"]),
    ).trim();
    if (customerId && !customerById[customerId]) {
      customerById[customerId] = {
        "Customer ID": customerId,
        "Customer Name": recordField_(sale, ["Customer Name", "customerName", "name"]) || "",
      };
    }
  });
  const ledger = Object.keys(customerById).map(function (customerId) {
    const customer = customerById[customerId];
    const customerSales = sales.filter(function (sale) {
      return String(
        recordField_(sale, ["Customer ID", "customerId", "id"]),
      ).trim() === customerId;
    });
    const customerReceipts = receipts.filter(function (receipt) {
      return String(
        recordField_(receipt, ["Customer ID", "customerId", "id"]),
      ).trim() === customerId;
    });
    const totalCreditAmount = customerSales.reduce(function (total, sale) {
      return total + Number(recordField_(sale, ["Total Bill", "totalBill"]) || 0);
    }, 0);
    const totalReceivedAmount =
      customerSales.reduce(function (total, sale) {
        return total + Number(recordField_(sale, ["Paid Amount", "paidAmount"]) || 0);
      }, 0) +
      customerReceipts.reduce(function (total, receipt) {
        return total + Number(recordField_(receipt, ["Received Amount", "receivedAmount"]) || 0);
      }, 0);
    const saleDueAmount = customerSales.reduce(function (total, sale) {
      return total + Number(recordField_(sale, ["Due Amount", "dueAmount"]) || 0);
    }, 0);
    const totalDueAmount = Math.max(
      0,
      saleDueAmount -
        customerReceipts.reduce(function (total, receipt) {
          return total + Number(recordField_(receipt, ["Received Amount", "receivedAmount"]) || 0);
        }, 0),
    );
    const dates = customerSales
      .concat(customerReceipts)
      .map(function (record) {
        return String(
          recordField_(record, ["Sale Date", "saleDate", "Receipt Date", "receiptDate"]) || "",
        ).trim();
      })
      .filter(Boolean)
      .sort();
    return {
      "Ledger ID": "LEDGER-" + customerId,
      "Customer ID": customerId,
      "Customer Name": recordField_(customer, ["Customer Name", "customerName", "name"]) || "",
      "Total Credit Amount": totalCreditAmount,
      "Total Received Amount": totalReceivedAmount,
      "Total Due Amount": totalDueAmount,
      "Last Transaction Date": dates.length ? dates[dates.length - 1] : "",
      "Updated At": new Date(),
    };
  });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet =
    ss.getSheetByName("CustomerLedger") || ss.insertSheet("CustomerLedger");
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet
      .getRange(1, 1, 1, CUSTOMER_LEDGER_HEADERS.length)
      .setValues([CUSTOMER_LEDGER_HEADERS]);
  }
  let headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  CUSTOMER_LEDGER_HEADERS.forEach(function (requiredHeader) {
    const exists = headers.some(function (header) {
      return normalizeHeader(header) === normalizeHeader(requiredHeader);
    });
    if (!exists) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(requiredHeader);
      headers = sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0];
    }
  });
  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
      .clearContent();
  }
  if (ledger.length) {
    sheet.getRange(2, 1, ledger.length, headers.length).setValues(
      ledger.map(function (record) {
        return headers.map(function (header) {
          const key = String(header || "").trim();
          return record[key] === undefined ? "" : record[key];
        });
      }),
    );
  }
  return jsonResponse(true, "Customer ledger loaded successfully.", ledger);
}

function getCustomerLedger() {
  // Rebuild before reading so existing credit sales are reflected even when
  // the ledger sheet was created before the credit-sale flow was deployed.
  return refreshCustomerLedger_();
}

function getCreditSales() {
  return getTable("CreditSales");
}

function getDueReceived() {
  return getTable("DueReceived");
}

function saveDueReceived(request) {
  request = request || {};
  const customerId = String(request.customerId || "").trim();
  const receivedAmount = Number(request.receivedAmount || request.amount || 0);
  if (!customerId) return jsonResponse(false, "Customer is required.");
  if (!isFinite(receivedAmount) || receivedAmount <= 0)
    return jsonResponse(false, "Received amount must be greater than zero.");

  const customers = getSheetObjects_("CafeCustomers");
  const customer = customers.find(function (record) {
    return String(
      recordField_(record, ["Customer ID", "customerId", "id"]),
    ).trim() === customerId;
  });
  if (!customer) return jsonResponse(false, "Customer was not found.");

  const ledgerResponse = getCustomerLedger();
  const ledger = JSON.parse(ledgerResponse.getContent()).data || [];
  const current = ledger.find(function (record) {
    return String(
      recordField_(record, ["Customer ID", "customerId", "id"]),
    ).trim() === customerId;
  });
  const previousDue = Number((current && current["Total Due Amount"]) || 0);
  if (receivedAmount > previousDue)
    return jsonResponse(
      false,
      "Received amount cannot exceed the customer due amount.",
    );

  const receiptDate = String(
    request.receiptDate ||
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      ),
  );
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet =
    spreadsheet.getSheetByName("DueReceived") ||
    spreadsheet.insertSheet("DueReceived");
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet
      .getRange(1, 1, 1, DUE_RECEIVED_HEADERS.length)
      .setValues([DUE_RECEIVED_HEADERS]);
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const record = {
    "Receipt ID":
      String(request.receiptId || request.paymentId || "").trim() ||
      "DR-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase(),
    "Customer ID": customerId,
    "Customer Name": recordField_(customer, ["Customer Name", "customerName", "name"]) || "",
    "Receipt Date": receiptDate,
    "Previous Due Amount": previousDue,
    "Received Amount": receivedAmount,
    "Remaining Due Amount": previousDue - receivedAmount,
    "Payment Mode": String(request.paymentMode || "Cash"),
    Remarks: String(request.remarks || ""),
    "Created At": new Date(),
  };
  sheet.appendRow(
    headers.map(function (header) {
      return record[header] === undefined ? "" : record[header];
    }),
  );
  refreshCustomerLedger_();

  const paymentResult = upsertReport_({
    reportKey: "customer-payments",
    rows: [{
      id: record["Receipt ID"], customer_id: customerId,
      customer_name: record["Customer Name"], payment_date: receiptDate,
      amount: receivedAmount, payment_method: record["Payment Mode"],
      previous_due_amount: previousDue, remaining_due_amount: previousDue - receivedAmount,
      remarks: record.Remarks, created_at: record["Created At"],
    }],
  });
  const paymentConfirmation = JSON.parse(paymentResult.getContent());
  if (!paymentConfirmation.success) {
    return jsonResponse(true, "Due receipt saved; customer payment export needs retry.", record);
  }
  return jsonResponse(true, "Due receipt and customer payment saved successfully.", record);
}

function saveCafeCustomer(request) {
  request = request || {};
  const name = String(
    request.customerName || request["Customer Name"] || "",
  ).trim();
  const phone = String(
    request.phoneNumber || request["Phone Number"] || "",
  ).trim();
  const address = String(request.address || request.Address || "").trim();
  const creditLimit = Number(
    request.creditLimit || request["Credit Limit"] || 0,
  );
  if (!name) return jsonResponse(false, "Customer name is required.");
  if (!phone) return jsonResponse(false, "Phone number is required.");
  if (isNaN(creditLimit) || creditLimit < 0)
    return jsonResponse(false, "Invalid credit limit.");

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CafeCustomers");
  if (!sheet) return jsonResponse(false, "CafeCustomers sheet not found.");
  const now = new Date();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const requestedId = String(
    request.customerId || request["Customer ID"] || "",
  ).trim();
  const customerId =
    requestedId ||
    "CC-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
  const rows = sheet.getDataRange().getValues();
  const idIndex = headers.indexOf("Customer ID");
  const existingIndex = rows.findIndex(
    (row, index) => index > 0 && String(row[idIndex]).trim() === customerId,
  );
  const existing = existingIndex > 0 ? rows[existingIndex] : null;
  const record = {
    "Customer ID": customerId,
    "Customer Name": name,
    "Phone Number": phone,
    Address: address,
    "Credit Limit": roundMoney(creditLimit),
    Status: "Active",
    "Created At": now,
    "Updated At": now,
  };
  const output = headers.map((header) => {
    if (header === "Created At" && existing)
      return existing[headers.indexOf(header)];
    return record[header] !== undefined ? record[header] : "";
  });
  if (existingIndex > 0) {
    sheet.getRange(existingIndex + 1, 1, 1, headers.length).setValues([output]);
  } else {
    sheet.appendRow(output);
  }
  refreshCustomerLedger_();
  return jsonResponse(
    true,
    existing
      ? "Credit customer updated successfully."
      : "Credit customer saved successfully.",
    record,
  );
}

function disableCafeCustomer(customerId) {
  return setStatusByKey_(
    "CafeCustomers",
    "Customer ID",
    customerId,
    "Inactive",
  );
}

/* ============================================================
   31. GET CAFÉ SALES
============================================================ */

function getCafeSales() {
  return getTable("CafeSales");
}

/* ============================================================
   33. GET DAILY CAFÉ SALES
============================================================ */

function getCafeDailySales() {
  return getTable("CafeDailySales");
}

function submitCafeDailyClosingReport(request) {
  request = request || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("CafeDailySales");
  if (!sheet)
    return jsonResponse(
      false,
      "CafeDailySales sheet not found. Run initializeDatabase first.",
    );

  const timezone = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
  const date = String(request.date || today).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse(
      false,
      "Closing report date must use YYYY-MM-DD format.",
    );
  }
  if (date !== today) {
    return jsonResponse(
      false,
      "Closing report can only be submitted for today's date.",
    );
  }
  const salesSheet = ss.getSheetByName("CafeSales");
  if (!salesSheet) return jsonResponse(false, "CafeSales sheet not found.");
  const sales = getSheetObjects_("CafeSales");
  const submittedAt = new Date();
  let cash = 0;
  let qr = 0;
  let credit = 0;
  let transactionCount = 0;
  sales.forEach((sale) => {
    if (formatDateValue_(sale["Date"]) !== date) return;
    const amount = Number(sale["Total Bill"] || 0);
    if (isNaN(amount) || amount < 0) return;
    const method = String(sale["Payment Method"] || "")
      .trim()
      .toLowerCase();
    if (method === "qr") {
      qr += amount;
    } else if (method === "credit") {
      credit += amount;
    } else if (method === "cash") {
      cash += amount;
    } else {
      return;
    }
    transactionCount += 1;
  });

  let headers = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0];
  ["Display Date", "Closing Status", "Submitted At"].forEach((header) => {
    if (headers.indexOf(header) === -1) {
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue(header);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
  });

  const values = sheet.getDataRange().getValues();
  const dateIndex = headers.indexOf("Date");
  const statusIndex = headers.indexOf("Closing Status");
  const existingIndex = values.findIndex(
    (row, index) => index > 0 && formatDateValue_(row[dateIndex]) === date,
  );
  if (
    existingIndex > 0 &&
    String(values[existingIndex][statusIndex] || "").toLowerCase() ===
      "submitted"
  ) {
    return jsonResponse(
      false,
      "The closing report for this date has already been submitted.",
    );
  }

  const record = {
    Date: date,
    "Display Date": Utilities.formatDate(new Date(), timezone, "MMMM-d"),
    "Cash Sales": roundMoney(cash),
    "QR Sales": roundMoney(qr),
    "Credit Sales": roundMoney(credit),
    "Total Sales": roundMoney(cash + qr + credit),
    Transaction: transactionCount,
    "Closing Status": "Submitted",
    "Submitted At": submittedAt,
  };
  const output = headers.map((header) =>
    record[header] !== undefined ? record[header] : "",
  );
  if (existingIndex > 0) {
    sheet.getRange(existingIndex + 1, 1, 1, headers.length).setValues([output]);
  } else {
    sheet.appendRow(output);
  }
  return jsonResponse(true, "Closing report submitted successfully.", record);
}

function autoSubmitCafeDailyClosingReport() {
  return submitCafeDailyClosingReport({ automatic: true });
}

function installCafeDailyClosingTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "autoSubmitCafeDailyClosingReport") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("autoSubmitCafeDailyClosingReport")
    .timeBased()
    .atHour(20)
    .everyDays(1)
    .create();
  return jsonResponse(true, "Daily cafe closing trigger installed for 8:00 PM.");
}

/* ============================================================
   34. CAFÉ TODAY SUMMARY
============================================================ */

function getCafeTodaySummary() {
  try {
    const timezone = Session.getScriptTimeZone();

    const today = Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");

    const records = getSheetObjects_("CafeSales");

    let cash = 0;

    let qr = 0;

    let credit = 0;

    let total = 0;

    let count = 0;

    records.forEach(function (record) {
      const date = formatDateValue_(record["Date"]);

      if (date !== today) {
        return;
      }

      const amount = Number(record["Total Bill"] || 0);

      total += amount;

      count++;

      const method = String(record["Payment Method"] || "").toLowerCase();

      if (method === "cash") {
        cash += amount;
      } else if (method === "qr") {
        qr += amount;
      } else if (method === "credit") {
        credit += amount;
      }
    });

    return jsonResponse(true, "Café daily summary loaded.", {
      date: today,

      cash: roundMoney(cash),

      qr: roundMoney(qr),

      credit: roundMoney(credit),

      total: roundMoney(total),

      transactionCount: count,
    });
  } catch (error) {
    return jsonResponse(false, error.message);
  }
}

/* ============================================================
   35. INVENTORY
============================================================ */

function saveInventoryItem(request) {
  try {
    request = request || {};

    const itemName = String(
      request.itemName || request["Item Name"] || "",
    ).trim();

    if (!itemName) {
      return jsonResponse(false, "Item Name is required.");
    }

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inventory");

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    const itemId =
      String(request.itemId || "").trim() ||
      "INV-" + Utilities.getUuid().substring(0, 8).toUpperCase();

    const itemIdColumn = findColumn(headers, ["Item ID"]);

    let row = -1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][itemIdColumn] || "").trim() === itemId) {
        row = i + 1;

        break;
      }
    }

    const record = {
      "Item ID": itemId,

      "Item Code": request.itemCode || "",

      "Item Name": itemName,

      Category: request.category || "",

      Unit: request.unit || "Piece",

      "Current Stock": Number(request.currentStock || 0),

      "Reorder Level": Number(request.reorderLevel || 0),

      "Cost Price": Number(request.costPrice || 0),

      "Selling Price": Number(request.sellingPrice || 0),

      "Supplier ID": request.supplierId || "",

      "Supplier Name": request.supplierName || "",

      Status: request.status || "Active",

      "Updated At": new Date(),
    };

    if (row === -1) {
      record["Created At"] = new Date();

      sheet.appendRow(
        headers.map(function (header) {
          return record[header] !== undefined ? record[header] : "";
        }),
      );
    } else {
      headers.forEach(function (header, index) {
        if (record[header] !== undefined) {
          sheet.getRange(row, index + 1).setValue(record[header]);
        }
      });
    }

    return jsonResponse(true, "Inventory item saved successfully.", record);
  } catch (error) {
    return jsonResponse(false, error.message);
  }
}

/* ============================================================
   36. GET INVENTORY
============================================================ */

function getInventory() {
  return getTable("Inventory");
}

function getPurchasedInventorySheet_(spreadsheet) {
  return spreadsheet.getSheetByName("Purchased Inventory");
}

function getPurchasedSheet_(spreadsheet) {
  return spreadsheet.getSheetByName("Purchased");
}

function getPurchaseItemSuggestions_(request) {
  request = request || {};
  const query = String(
    request.query || request.itemName || request["Item Name"] || "",
  )
    .trim()
    .toLowerCase();

  if (!query) {
    return jsonResponse(false, "Item name is required.");
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const suggestions = {};
  const addSuggestion = function (name, rate, unit, source) {
    const itemName = String(name || "").trim();
    const numericRate = Number(rate);
    if (!itemName || !isFinite(numericRate) || numericRate < 0) return;
    const key = itemName.toLowerCase();
    if (key.indexOf(query) === -1) return;
    if (!suggestions[key] || suggestions[key].updatedAt < source.updatedAt) {
      suggestions[key] = {
        itemName: itemName,
        unit: String(unit || "").trim(),
        unitPrice: numericRate,
        source: source.name,
        updatedAt: source.updatedAt,
      };
    }
  };

  const purchaseSheet = getPurchasedInventorySheet_(spreadsheet);
  if (purchaseSheet) {
    const values = purchaseSheet.getDataRange().getValues();
    const headers = values[0] || [];
    const indexOf = function (names) {
      return headers.findIndex(function (header) {
        return names.indexOf(normalizeHeaderKey(header)) !== -1;
      });
    };
    const nameIndex = indexOf(["itemname", "purchaseditem", "productname"]);
    const rateIndex = indexOf(["price", "rate", "unitprice", "costprice"]);
    const unitIndex = indexOf(["unit"]);
    const dateIndex = indexOf([
      "createdat",
      "updatedat",
      "purchasedate",
      "date",
    ]);

    if (nameIndex >= 0 && rateIndex >= 0) {
      values.slice(1).forEach(function (row) {
        addSuggestion(
          row[nameIndex],
          row[rateIndex],
          unitIndex >= 0 ? row[unitIndex] : "",
          {
            name: "Purchased Inventory",
            updatedAt:
              dateIndex >= 0 && row[dateIndex] instanceof Date
                ? row[dateIndex].getTime()
                : 0,
          },
        );
      });
    }
  }

  return jsonResponse(
    true,
    "Purchase item suggestions loaded.",
    Object.keys(suggestions).map(function (key) {
      const suggestion = suggestions[key];
      delete suggestion.updatedAt;
      return suggestion;
    }),
  );
}

function getOrCreatePurchaseSheet_(spreadsheet, name, requiredHeaders) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  let headers =
    sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];
  if (!headers.length) {
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);
    headers = requiredHeaders.slice();
  }
  requiredHeaders.forEach(function (header) {
    if (
      headers.map(normalizeHeaderKey).indexOf(normalizeHeaderKey(header)) < 0
    ) {
      sheet.getRange(1, headers.length + 1).setValue(header);
      headers.push(header);
    }
  });
  return sheet;
}

function getPurchaseBillId_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.findIndex(function (header) {
    return (
      ["billid", "purchasebillid", "purchaseid"].indexOf(
        normalizeHeaderKey(header),
      ) !== -1
    );
  });
  let highest = 0;
  if (sheet.getLastRow() > 1 && idIndex >= 0) {
    sheet
      .getRange(2, idIndex + 1, sheet.getLastRow() - 1, 1)
      .getValues()
      .forEach(function (row) {
        const match = String(row[0] || "").match(/(\d+)$/);
        if (match) highest = Math.max(highest, Number(match[1]));
      });
  } else if (sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
      .getValues()
      .forEach(function (row) {
        row.forEach(function (value) {
          const match = String(value || "").match(/^PB-(\d+)$/i);
          if (match) highest = Math.max(highest, Number(match[1]));
        });
      });
  }
  return "PB-" + String(highest + 1).padStart(5, "0");
}

function sanitizePurchaseBillFileName_(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "");
}

function getPurchaseVendorFromVendors_(spreadsheet, vendorName, vendorId) {
  const vendorsSheet = spreadsheet.getSheetByName("Vendors");
  if (!vendorsSheet) throw new Error('Sheet "Vendors" was not found.');
  const values = vendorsSheet.getDataRange().getValues();
  const headers = values[0] || [];
  const nameIndex = headers.findIndex(function (header) {
    return ["name", "vendorname"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const idIndex = headers.findIndex(function (header) {
    return ["vendorid", "id"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  if (nameIndex < 0)
    throw new Error("Vendors is missing the vendor name column.");

  const targetName = String(vendorName || "")
    .trim()
    .toLowerCase();
  const targetId = String(vendorId || "")
    .trim()
    .toLowerCase();
  const vendorRow = values.slice(1).find(function (row) {
    const matchesId =
      targetId &&
      idIndex >= 0 &&
      String(row[idIndex] || "")
        .trim()
        .toLowerCase() === targetId;
    const matchesName =
      targetName &&
      String(row[nameIndex] || "")
        .trim()
        .toLowerCase() === targetName;
    return matchesId || matchesName;
  });
  if (!vendorRow) throw new Error("Vendor was not found in the Vendors table.");

  const valueAt = function (names) {
    const index = headers.findIndex(function (header) {
      return names.indexOf(normalizeHeaderKey(header)) !== -1;
    });
    return index >= 0 ? vendorRow[index] : "";
  };
  return {
    name: String(vendorRow[nameIndex] || "").trim(),
    pan: valueAt(["panvatno", "panno", "vatno"]),
    address: valueAt(["address"]),
    contact: valueAt(["contactno", "contactnumber", "phone", "contact"]),
  };
}

function createPurchaseBillPdf_(purchase, items, vendor) {
  const rows = items
    .map(function (item, index) {
      return (
        "<tr><td>" +
        (index + 1) +
        "</td><td>" +
        escapeHtml_(item.itemName) +
        "</td><td>" +
        escapeHtml_(item.unit) +
        "</td><td>" +
        item.quantity +
        "</td><td>" +
        item.unitPrice.toFixed(2) +
        "</td><td>" +
        item.amount.toFixed(2) +
        "</td></tr>"
      );
    })
    .join("");
  const html =
    "<html><head><style>" +
    "body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{text-align:center}" +
    "table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #bbb;padding:8px;text-align:left}" +
    ".right{text-align:right}.meta{line-height:1.6}" +
    "</style></head><body><h1>PURCHASE BILL</h1>" +
    "<div class='meta'><b>Bill ID:</b> " +
    escapeHtml_(purchase.billId) +
    "<br>" +
    "<b>Invoice No:</b> " +
    escapeHtml_(purchase.invoiceNo) +
    "<br>" +
    "<b>Purchase Date:</b> " +
    escapeHtml_(purchase.purchaseDate) +
    "<br>" +
    "<b>Vendor:</b> " +
    escapeHtml_(vendor.name) +
    "<br>" +
    "<b>PAN/VAT:</b> " +
    escapeHtml_(vendor.pan) +
    "<br><b>Address:</b> " +
    escapeHtml_(vendor.address) +
    "<br><b>Contact:</b> " +
    escapeHtml_(vendor.contact) +
    "</div>" +
    "<table><tr><th>S.N.</th><th>Item</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>" +
    rows +
    "</table><p class='right'><b>Subtotal:</b> " +
    purchase.subtotal.toFixed(2) +
    "<br><b>Discount:</b> " +
    purchase.discount.toFixed(2) +
    "<br><b>Tax:</b> " +
    purchase.tax.toFixed(2) +
    "<br><b>Grand Total:</b> " +
    purchase.grandTotal.toFixed(2) +
    "<br><b>Paid:</b> " +
    purchase.paidAmount.toFixed(2) +
    "<br><b>Due:</b> " +
    purchase.dueAmount.toFixed(2) +
    "<br><b>Status:</b> " +
    escapeHtml_(purchase.paymentStatus) +
    "</p>" +
    "<p><b>Remarks:</b> " +
    escapeHtml_(purchase.remarks) +
    "</p>" +
    "<p>Generated on " +
    new Date().toISOString() +
    "</p></body></html>";
  return HtmlService.createHtmlOutput(html)
    .getBlob()
    .getAs(MimeType.PDF)
    .setName(
      sanitizePurchaseBillFileName_(purchase.invoiceNo + " - " + vendor.name) +
        ".pdf",
    );
}

function uploadPurchaseBill_(purchase, items, spreadsheet) {
  const vendor = getPurchaseVendorFromVendors_(
    spreadsheet,
    purchase.vendorName,
    purchase.vendorId,
  );
  const folder = DriveApp.getFolderById(PURCHASE_BILLS_FOLDER_ID);
  const fileName =
    sanitizePurchaseBillFileName_(purchase.invoiceNo + " - " + vendor.name) +
    ".pdf";
  const file = folder.createFile(
    createPurchaseBillPdf_(purchase, items, vendor),
  );
  file.setName(fileName);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    fileId: file.getId(),
    fileName: file.getName(),
    fileUrl: file.getUrl(),
    webContentLink:
      "https://drive.google.com/uc?export=download&id=" + file.getId(),
    qrUrl: "https://quickchart.io/qr?text=" + encodeURIComponent(file.getUrl()),
  };
}

function getPurchaseBills_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const purchased = spreadsheet.getSheetByName("Purchased");
  if (!purchased)
    return jsonResponse(true, "Purchase bills loaded.", {
      bills: [],
      items: [],
    });
  const rows = getSheetObjects_("Purchased");
  const grouped = {};
  rows.forEach(function (row) {
    const billId = String(
      row["Bill ID"] ||
        row["Purchase ID"] ||
        row["Invoice Number"] ||
        row["Invoice No"] ||
        "",
    ).trim();
    if (!billId) return;
    if (!grouped[billId]) grouped[billId] = { bill: row, items: [] };
    grouped[billId].items.push(row);
  });
  const billsData = Object.keys(grouped).map(function (key) {
    return grouped[key];
  });
  return jsonResponse(true, "Purchase bills loaded.", {
    bills: billsData.map(function (entry) {
      return entry.bill;
    }),
    items: rows,
  });
}

function retryPurchaseBillUpload_(request) {
  const billId = String(
    (request || {}).billId || (request || {}).purchaseId || "",
  ).trim();
  if (!billId) throw new Error("Bill ID is required.");
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const purchased = spreadsheet.getSheetByName("Purchased");
  if (!purchased) throw new Error("Purchase bill records were not found.");
  const billValues = purchased.getDataRange().getValues();
  const billHeaders = billValues[0] || [];
  const billIndex = billHeaders.findIndex(function (header) {
    return ["billid", "purchaseid"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const billRow = billValues.slice(1).find(function (row) {
    return String(row[billIndex] || "") === billId;
  });
  if (!billRow) throw new Error("Purchase bill was not found.");
  const record = {};
  billHeaders.forEach(function (header, index) {
    record[normalizeHeaderKey(header)] = billRow[index];
  });
  const itemValues = billValues;
  const itemHeaders = billHeaders;
  const itemIdIndex = itemHeaders.findIndex(function (header) {
    return ["billid", "purchaseid"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const itemRows = itemValues
    .slice(1)
    .filter(function (row) {
      return String(row[itemIdIndex] || "") === billId;
    })
    .map(function (row) {
      const item = {};
      itemHeaders.forEach(function (header, index) {
        item[normalizeHeaderKey(header)] = row[index];
      });
      return {
        itemName: item.itemname,
        unit: item.unit,
        quantity: Number(item.quantity || item.qty),
        unitPrice: Number(item.rate || item.unitprice),
        amount: Number(item.amount),
      };
    });
  const file = uploadPurchaseBill_(
    {
      billId: billId,
      vendorId: record.vendorid,
      vendorName: record.vendorname,
      invoiceNo: record.invoicenumber || record.invoiceno || record.billno,
      purchaseDate: record.date,
      subtotal: Number(record.subtotal),
      discount: Number(record.discount),
      tax: Number(record.tax),
      grandTotal: Number(record.totalamount),
      paidAmount: Number(record.paidamount),
      dueAmount: Number(record.dueamount),
      paymentStatus: record.paymentstatus,
      remarks: record.remarks,
    },
    itemRows,
    spreadsheet,
  );
  [purchased].forEach(function (sheet) {
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const idIndex = headers.findIndex(function (header) {
      return (
        ["billid", "purchaseid"].indexOf(normalizeHeaderKey(header)) !== -1
      );
    });
    const fileIdIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billfileid";
    });
    const fileNameIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billfilename";
    });
    const fileUrlIndex = headers.findIndex(function (header) {
      return (
        ["billfileurl", "billurl", "billlink"].indexOf(
          normalizeHeaderKey(header),
        ) !== -1
      );
    });
    const qrIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billqrurl";
    });
    const billInfoIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billinfo";
    });
    values.slice(1).forEach(function (row, index) {
      if (idIndex >= 0 && String(row[idIndex] || "") === billId) {
        if (fileIdIndex >= 0)
          sheet.getRange(index + 2, fileIdIndex + 1).setValue(file.fileId);
        if (fileNameIndex >= 0)
          sheet.getRange(index + 2, fileNameIndex + 1).setValue(file.fileName);
        if (fileUrlIndex >= 0)
          sheet.getRange(index + 2, fileUrlIndex + 1).setValue(file.fileUrl);
        if (qrIndex >= 0) sheet.getRange(index + 2, qrIndex + 1).setValue("");
        if (billInfoIndex >= 0 && sheet.getName() === "Purchased") {
          sheet.getRange(index + 2, billInfoIndex + 1).setValue(file.fileUrl);
        }
      }
    });
  });
  SpreadsheetApp.flush();
  return jsonResponse(true, "Purchase bill uploaded successfully.", file);
}

// The desktop app supplies the final A4 PDF only after the user explicitly
// chooses Generate Bill. This keeps saving a purchase separate from billing.
function uploadPurchaseBillFromClient_(request) {
  const payload = request || {};
  const billId = String(payload.billId || payload.purchaseId || "").trim();
  const requestedInvoiceNumber = String(
    payload.invoiceNo || payload.invoiceNumber || "",
  ).trim();
  const vendorName = String(payload.vendorName || "").trim().toLowerCase();
  const fileData = payload.file || payload;
  const base64 = String(fileData.base64 || fileData.data || "").replace(
    /\s/g,
    "",
  );
  if (!billId) throw new Error("Bill ID is required.");
  if (!base64) throw new Error("A generated PDF is required.");

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const bills = spreadsheet.getSheetByName("Purchased");
  if (!bills) throw new Error("Purchase bill records were not found.");
  const values = bills.getDataRange().getValues();
  const headers = values[0] || [];
  const idIndex = headers.findIndex(function (header) {
    return ["billid", "purchaseid"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const invoiceIndex = headers.findIndex(function (header) {
    return ["invoicenumber", "invoiceno", "billno", "billnumber"].indexOf(
      normalizeHeaderKey(header),
    ) !== -1;
  });
  const vendorIndex = headers.findIndex(function (header) {
    return ["vendorname", "name"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const billRow = values.slice(1).find(function (row) {
    const matchesId =
      idIndex >= 0 && String(row[idIndex] || "").trim() === billId;
    const matchesInvoice =
      requestedInvoiceNumber &&
      invoiceIndex >= 0 &&
      String(row[invoiceIndex] || "").trim() === requestedInvoiceNumber &&
      (!vendorName ||
        vendorIndex < 0 ||
        String(row[vendorIndex] || "").trim().toLowerCase() === vendorName);
    return matchesId || matchesInvoice;
  });
  if (!billRow) throw new Error("Purchase bill was not found.");

  const savedVendorName = String(
    billRow[vendorIndex >= 0 ? vendorIndex : -1] || vendorName,
  ).trim();
  const vendor = getPurchaseVendorFromVendors_(spreadsheet, savedVendorName);
  const valueFromBill = function (names) {
    const index = headers.findIndex(function (header) {
      return names.indexOf(normalizeHeaderKey(header)) !== -1;
    });
    return index >= 0 ? billRow[index] : "";
  };
  const totalAmount = valueFromBill(["totalamount", "grandtotal", "total"]);
  const paidAmount = valueFromBill(["paidamount", "totalpaid", "paid"]);
  const dueAmount = valueFromBill(["dueamount", "totaldue", "due"]);
  const invoiceNumber = String(
    valueFromBill(["invoicenumber", "invoiceno", "billno", "billnumber"]) || "",
  ).trim();
  if (!invoiceNumber)
    throw new Error("Saved purchase is missing its invoice number.");
  const purchaseItemReferenceIndex = headers.findIndex(function (header) {
    return ["billid", "purchaseid"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const savedItems = values
    .slice(1)
    .filter(function (row) {
      return (
        purchaseItemReferenceIndex >= 0 &&
        String(row[purchaseItemReferenceIndex] || "").trim() === billId
      );
    })
    .map(function (row) {
      const item = {};
      headers.forEach(function (header, index) {
        item[normalizeHeaderKey(header)] = row[index];
      });
      return {
        itemName: String(item.itemname || "").trim(),
        unit: String(item.unit || "").trim(),
        quantity: Number(item.quantity || item.qty),
        unitPrice: Number(item.rate || item.unitprice),
        amount: Number(item.amount),
      };
    });
  if (!savedItems.length)
    throw new Error("No items were found for the saved purchase bill.");
  const fileName =
    sanitizePurchaseBillFileName_(invoiceNumber + " - " + vendor.name) + ".pdf";
  const folder = DriveApp.getFolderById(PURCHASE_BILLS_FOLDER_ID);
  const normalizedBase64 = base64.replace(/^data:application\/pdf;base64,/i, "");
  let pdfBlob;
  try {
    pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(normalizedBase64),
      String(fileData.mimeType || "application/pdf"),
      fileName,
    );
  } catch (error) {
    throw new Error("The generated bill PDF is invalid: " + error.message);
  }
  const driveFile = folder.createFile(pdfBlob);
  driveFile.setName(fileName);
  driveFile.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW,
  );
  const file = {
    fileId: driveFile.getId(),
    fileName: driveFile.getName(),
    fileUrl: driveFile.getUrl(),
  };

  [bills].forEach(function (sheet) {
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    const sheetHeaders = rows[0] || [];
    const referenceIndex = sheetHeaders.findIndex(function (header) {
      return (
        ["billid", "purchaseid"].indexOf(normalizeHeaderKey(header)) !== -1
      );
    });
    const billInfoIndex = sheetHeaders.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billinfo";
    });
    const totalAmountIndex = sheetHeaders.findIndex(function (header) {
      return (
        ["totalamount", "grandtotal", "total"].indexOf(
          normalizeHeaderKey(header),
        ) !== -1
      );
    });
    const paidAmountIndex = sheetHeaders.findIndex(function (header) {
      return (
        ["paidamount", "totalpaid", "paid"].indexOf(
          normalizeHeaderKey(header),
        ) !== -1
      );
    });
    const dueAmountIndex = sheetHeaders.findIndex(function (header) {
      return (
        ["dueamount", "totaldue", "due"].indexOf(normalizeHeaderKey(header)) !==
        -1
      );
    });
    const setReference = function (columnName, value) {
      const column = sheetHeaders.findIndex(function (header) {
        const normalized = normalizeHeaderKey(header);
        return columnName === "billfileurl"
          ? ["billfileurl", "billurl", "billlink"].indexOf(normalized) !== -1
          : normalized === columnName;
      });
      if (column < 0 || referenceIndex < 0) return;
      rows.slice(1).forEach(function (row, rowIndex) {
        if (String(row[referenceIndex] || "") === billId)
          sheet.getRange(rowIndex + 2, column + 1).setValue(value);
      });
    };
    setReference("billfileid", file.fileId);
    setReference("billfilename", file.fileName);
    setReference("billfileurl", file.fileUrl);
    setReference("billqrurl", "");
    rows.slice(1).forEach(function (row, rowIndex) {
      if (referenceIndex < 0 || String(row[referenceIndex] || "") !== billId)
        return;
      if (billInfoIndex >= 0 && sheet.getName() === "Purchased") {
        sheet.getRange(rowIndex + 2, billInfoIndex + 1).setValue(file.fileUrl);
      }
      if (totalAmountIndex >= 0)
        sheet
          .getRange(rowIndex + 2, totalAmountIndex + 1)
          .setValue(totalAmount);
      if (paidAmountIndex >= 0)
        sheet.getRange(rowIndex + 2, paidAmountIndex + 1).setValue(paidAmount);
      if (dueAmountIndex >= 0)
        sheet.getRange(rowIndex + 2, dueAmountIndex + 1).setValue(dueAmount);
    });
  });
  SpreadsheetApp.flush();
  return jsonResponse(true, "Purchase bill PDF uploaded successfully.", file);
}

function getPurchaseItems_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return jsonResponse(
    true,
    "Purchase items loaded.",
    spreadsheet.getSheetByName("Purchased")
      ? getSheetObjects_("Purchased")
      : [],
  );
}

function savePurchase(request) {
  const payload = request || {};
  const vendorId = String(payload.vendorId || "").trim();
  const invoiceNumber = String(
    payload.invoiceNo || payload.invoiceNumber || "",
  ).trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const validItems = items.filter(function (item) {
    return (
      item &&
      String(item.itemName || "").trim() &&
      Number(item.quantity) > 0 &&
      Number(item.unitPrice) >= 0
    );
  });

  if (!vendorId) throw new Error("Vendor ID is required.");
  if (!invoiceNumber) throw new Error("Invoice number is required.");
  if (!validItems.length)
    throw new Error("At least one valid purchase item is required.");

  const subtotal = validItems.reduce(function (total, item) {
    return total + Number(item.quantity) * Number(item.unitPrice);
  }, 0);
  const discount = Number(payload.discount || 0);
  const tax = Number(payload.tax || 0);
  const totalAmount = subtotal - discount + tax;
  const paidAmount = Number(payload.paidAmount || 0);
  if (
    ![discount, tax, paidAmount].every(Number.isFinite) ||
    discount < 0 ||
    tax < 0 ||
    paidAmount < 0 ||
    totalAmount < 0 ||
    paidAmount > totalAmount
  ) {
    throw new Error("Discount, tax, and payment must be valid and cannot exceed the invoice total.");
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const purchasedSheet = getOrCreatePurchaseSheet_(spreadsheet, "Purchased", [
    "Bill ID",
    "Purchase ID",
    "Date",
    "Vendor ID",
    "Vendor Name",
    "Invoice Number",
    "Item Name",
    "Quantity",
    "Unit",
    "Unit Price",
    "Rate",
    "Amount",
    "Subtotal",
    "Discount",
    "Tax",
    "Total Amount",
    "Paid Amount",
    "Due Amount",
    "Payment Mode",
    "Payment Status",
    "Remarks",
    "Bill File ID",
    "Bill File Name",
    "Bill File URL",
    "Bill QR URL",
    "Created At",
    "Updated At",
  ]);
  const purchasedInventorySheet = getPurchasedInventorySheet_(spreadsheet);
  if (!purchasedSheet) throw new Error('Sheet "Purchased" was not found.');
  if (!purchasedInventorySheet)
    throw new Error('Sheet "Purchased Inventory" was not found.');
  const ledger = getVendorLedgerSheet_(spreadsheet);
  const ledgerHeaders = ledger
    .getRange(1, 1, 1, ledger.getLastColumn())
    .getValues()[0];
  const vendorRecord = getVendorLedgerRecordById_(spreadsheet, vendorId);
  if (!vendorRecord)
    throw new Error("Selected vendor was not found in the Vendors table.");
  const vendorNameIndex = ledgerHeaders.findIndex(function (header) {
    return ["vendorname", "name"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const vendorName = String(
    vendorNameIndex >= 0 ? vendorRecord[vendorNameIndex] || "" : "",
  ).trim();
  if (!vendorName) throw new Error("Selected vendor is missing a vendor name.");
  const billId = getPurchaseBillId_(purchasedSheet);
  const existingBills = purchasedSheet.getDataRange().getValues();
  const existingHeaders = existingBills[0] || [];
  const existingVendorIndex = existingHeaders.findIndex(function (header) {
    return normalizeHeaderKey(header) === "vendorname";
  });
  const existingInvoiceIndex = existingHeaders.findIndex(function (header) {
    return (
      ["invoicenumber", "invoiceno", "billno"].indexOf(
        normalizeHeaderKey(header),
      ) !== -1
    );
  });
  if (
    existingVendorIndex >= 0 &&
    existingInvoiceIndex >= 0 &&
    existingBills.slice(1).some(function (row) {
      return (
        String(row[existingVendorIndex] || "")
          .trim()
          .toLowerCase() === vendorName.toLowerCase() &&
        String(row[existingInvoiceIndex] || "").trim() === invoiceNumber
      );
    })
  ) {
    throw new Error(
      "A purchase bill with this invoice number already exists for this vendor.",
    );
  }
  const purchaseId = billId;
  const now = new Date();
  const dueAmount = totalAmount - paidAmount;
  const paymentStatus =
    paidAmount === 0
      ? "UNPAID"
      : paidAmount >= totalAmount
        ? "PAID"
        : "PARTIAL";
  const billDate = payload.purchaseDate || payload.date || now;
  const purchasedValues = purchasedSheet.getDataRange().getValues();
  const purchasedHeaders = purchasedValues.length ? purchasedValues[0] : [];
  if (!purchasedHeaders.length)
    throw new Error('Sheet "Purchased" has no header row.');

  validItems.forEach(function (item, index) {
    const quantity = Number(item.quantity);
    const rate = Number(item.unitPrice);
    const inventoryItem = {
      itemId: String(item.itemId || item["Item ID"] || "").trim(),
      unit: String(item.unit || "").trim(),
    };
    const itemName = String(item.itemName || item["Item Name"] || "").trim();
    const itemRecord = {
      billingdate: payload.purchaseDate || payload.date || now,
      invoiceno: invoiceNumber,
      vendorname: vendorName,
      itemname: itemName,
      billinfo: "",
      unit: item.unit || inventoryItem.unit || "",
      unitprice: rate,
      quantity: quantity,
      qty: quantity,
      amount: quantity * rate,
      totalamount: totalAmount,
      billid: billId,
      purchaseid: purchaseId,
      vendorid: vendorId,
      invoicenumber: invoiceNumber,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      paymentstatus: paymentStatus,
      remarks: payload.remarks || payload.notes || "",
      createdat: now,
      updatedat: now,
      paymentmode: payload.paymentMode || payload.paymentMethod || "",
      paidamount: paidAmount,
      dueamount: dueAmount,
    };
    purchasedSheet.appendRow(
      purchasedHeaders.map(function (header) {
        const key = String(header || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        return itemRecord[key] !== undefined ? itemRecord[key] : "";
      }),
    );

    upsertPurchasedInventoryQty_(spreadsheet, item, quantity, rate);
  });

  // A save operation must not create a bill file. The Generate Bill action
  // calls uploadPurchaseBillFromClient_ with the rendered A4 PDF.
  let billFile = null;
  let uploadError = "";

  const updateBillReference = function (sheet, idNames) {
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const idIndex = headers.findIndex(function (header) {
      return idNames.indexOf(normalizeHeaderKey(header)) !== -1;
    });
    const fileIdIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billfileid";
    });
    const fileNameIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billfilename";
    });
    const fileUrlIndex = headers.findIndex(function (header) {
      return (
        ["billfileurl", "billurl", "billlink"].indexOf(
          normalizeHeaderKey(header),
        ) !== -1
      );
    });
    const qrIndex = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "billqrurl";
    });
    if (idIndex < 0 || !billFile) return;
    values.slice(1).forEach(function (row, index) {
      if (
        String(row[idIndex] || "") === billId ||
        String(row[idIndex] || "") === purchaseId
      ) {
        if (fileIdIndex >= 0)
          sheet.getRange(index + 2, fileIdIndex + 1).setValue(billFile.fileId);
        if (fileNameIndex >= 0)
          sheet
            .getRange(index + 2, fileNameIndex + 1)
            .setValue(billFile.fileName);
        if (fileUrlIndex >= 0)
          sheet
            .getRange(index + 2, fileUrlIndex + 1)
            .setValue(billFile.fileUrl);
        if (qrIndex >= 0) sheet.getRange(index + 2, qrIndex + 1).setValue("");
      }
    });
  };
  const updatePurchasedItemsLink = function (sheet, invoiceNo, vendor) {
    return;
  };
  if (billFile) {
    updateBillReference(purchasedSheet, ["billid", "purchaseid"]);
  }
  refreshConnectedData_(spreadsheet);

  return jsonResponse(
    true,
    uploadError
      ? "Purchase saved, but bill upload failed."
      : "Purchase bill saved successfully.",
    {
      purchaseId: purchaseId,
      billId: billId,
      invoiceNumber: invoiceNumber,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      dueAmount: dueAmount,
      billFile: billFile,
      billUploadFailed: !!uploadError,
      billUploadError: uploadError,
    },
  );
}

function saveVendorPayment(request) {
  const payload = request || {};
  const vendorName = String(payload.vendorName || "").trim();
  const amount = Number(payload.amount || 0);
  if (!vendorName || !isFinite(amount) || amount <= 0)
    throw new Error("Vendor and payment amount are required.");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payments = ss.getSheetByName("VendorPayments");
  if (!payments) throw new Error("Vendor payment tables are not available.");

  const ledger = ["Vendor Ledger", "VendorLedgers"]
    .map(function (name) {
      return ss.getSheetByName(name);
    })
    .find(function (sheet) {
      return !!sheet;
    });
  if (!ledger) throw new Error("Vendor Ledger table was not found.");
  const ledgerRows = ledger.getDataRange().getValues();
  const ledgerHeaders = ledgerRows[0] || [];
  const ledgerNameColumn = ledgerHeaders.findIndex(function (header) {
    return ["vendorname", "name"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  const ledgerIdColumn = ledgerHeaders.findIndex(function (header) {
    return ["vendorid", "id"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  if (ledgerNameColumn < 0)
    throw new Error("Vendor Ledger is missing the vendor name column.");
  const vendorRow = ledgerRows.slice(1).find(function (row) {
    return (
      String(row[ledgerNameColumn] || "")
        .trim()
        .toLowerCase() === vendorName.toLowerCase()
    );
  });
  if (!vendorRow) throw new Error("Vendor was not found in the Vendor Ledger.");
  const currentTotals = getVendorPurchaseTotals_()[
    vendorName.toLowerCase()
  ] || { totalDue: 0 };
  if (amount > Number(currentTotals.totalDue || 0))
    throw new Error("Payment cannot exceed the vendor due amount.");
  const paymentId = "VPAY-" + new Date().getTime();
  const paymentOut = getPaymentOutSheet_(ss);
  const previousDue = Number(currentTotals.totalDue || 0);
  const remainingDue = Math.max(0, previousDue - amount);
  const voucherNo = nextPaymentVoucherNumber_(paymentOut);
  const paymentValues = {
    paymentid: paymentId,
    vendorid: ledgerIdColumn >= 0 ? vendorRow[ledgerIdColumn] : "",
    vendorname: String(vendorRow[ledgerNameColumn] || "").trim(),
    amount: amount,
    paymentdate: payload.paymentDate || new Date(),
    paymentmethod: payload.paymentMethod || "",
    remarks: payload.remarks || "",
    createdat: new Date(),
  };
  const paymentHeaders = payments.getDataRange().getValues()[0] || [];
  payments.appendRow(
    paymentHeaders.map(function (header) {
      const value = paymentValues[normalizeHeaderKey(header)];
      return value === undefined ? "" : value;
    }),
  );
  appendPaymentOut_(paymentOut, {
    "Voucher No": voucherNo,
    "Payment ID": paymentId,
    "Payment Type": "VENDOR PAYMENT",
    "Payee ID": ledgerIdColumn >= 0 ? vendorRow[ledgerIdColumn] : "",
    "Payee Name": paymentValues.vendorname,
    "PAN/VAT No": payload.panVatNo || "",
    "Previous Due": previousDue,
    "Paid Amount": amount,
    "Remaining Due": remainingDue,
    "Payment Method": paymentValues.paymentmethod,
    "Payment Date": paymentValues.paymentdate,
    Remarks: paymentValues.remarks,
    "Created At": paymentValues.createdat,
  });
  syncVendorLedgerTotals_(ss, vendorName);
  refreshConnectedData_(ss);
  return jsonResponse(true, "Vendor payment recorded successfully.", {
    voucherNo: voucherNo,
    paymentId: paymentId,
    paymentType: "VENDOR PAYMENT",
    payeeId: paymentValues.vendorid,
    payeeName: paymentValues.vendorname,
    previousDue: previousDue,
    paidAmount: amount,
    remainingDue: remainingDue,
    paymentMethod: paymentValues.paymentmethod,
    paymentDate: paymentValues.paymentdate,
    remarks: paymentValues.remarks,
  });
}

function getPaymentOutSheet_(spreadsheet) {
  const headers = getDatabaseStructure().PaymentOut;
  let sheet = spreadsheet.getSheetByName("PaymentOut");
  if (!sheet) sheet = spreadsheet.insertSheet("PaymentOut");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    headers.forEach(function (header) {
      if (
        existing.map(normalizeHeaderKey).indexOf(normalizeHeaderKey(header)) < 0
      ) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        existing.push(header);
      }
    });
  }
  return sheet;
}

function nextPaymentVoucherNumber_(sheet) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const year = new Date().getFullYear();
    const headers = sheet.getDataRange().getValues()[0] || [];
    const index = headers.findIndex(function (header) {
      return normalizeHeaderKey(header) === "voucherno";
    });
    let max = 0;
    if (index >= 0) {
      sheet
        .getDataRange()
        .getValues()
        .slice(1)
        .forEach(function (row) {
          const match = String(row[index] || "").match(/^PV-\d{4}-(\d+)$/);
          if (match) max = Math.max(max, Number(match[1]));
        });
    }
    return "PV-" + year + "-" + String(max + 1).padStart(6, "0");
  } finally {
    lock.releaseLock();
  }
}

function appendPaymentOut_(sheet, record) {
  const headers = sheet.getDataRange().getValues()[0] || [];
  sheet.appendRow(
    headers.map(function (header) {
      const key = normalizeHeaderKey(header);
      const match = Object.keys(record).find(function (candidate) {
        return normalizeHeaderKey(candidate) === key;
      });
      return match === undefined ? "" : record[match];
    }),
  );
}

function saveStaffPayment(request) {
  const payload = request || {};
  const employeeId = String(payload.employeeId || "").trim();
  const amount = Number(payload.amount || 0);
  if (!employeeId || !isFinite(amount) || amount <= 0) {
    throw new Error("Staff and payment amount are required.");
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payrollSheet = ss.getSheetByName("Payroll");
  if (!payrollSheet) throw new Error("Payroll sheet is not available.");
  const staff = getSheetObjects_("Staff").find(function (record) {
    return String(record["Employee ID"] || "").trim() === employeeId;
  });
  if (!staff) throw new Error("Employee was not found.");
  const employeeName = String(
    staff["Full Name"] || payload.employeeName || payload.staffName || "",
  ).trim();
  if (!employeeName) throw new Error("Employee name is missing.");
  const payrollValues = payrollSheet.getDataRange().getValues();
  const headers = payrollValues[0] || [];
  const employeeIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "employeeid";
  });
  const dueIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "duesalary";
  });
  const paidIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "totalpaid";
  });
  if (employeeIndex < 0 || dueIndex < 0 || paidIndex < 0)
    throw new Error("Payroll sheet is missing payment columns.");
  const matching = [];
  payrollValues.slice(1).forEach(function (row, index) {
    if (String(row[employeeIndex] || "").trim() === employeeId)
      matching.push({ row: row, rowNumber: index + 2 });
  });
  if (!matching.length)
    throw new Error("Employee payroll record was not found.");
  const previousDue = matching.reduce(function (total, item) {
    return total + Math.max(Number(item.row[dueIndex] || 0), 0);
  }, 0);
  const advanceAmount = Math.max(amount - previousDue, 0);
  let remaining = amount;
  matching.forEach(function (item) {
    if (remaining <= 0) return;
    const due = Math.max(Number(item.row[dueIndex] || 0), 0);
    const applied = Math.min(due, remaining);
    if (applied > 0) {
      payrollSheet
        .getRange(item.rowNumber, paidIndex + 1)
        .setValue(Number(item.row[paidIndex] || 0) + applied);
      payrollSheet
        .getRange(item.rowNumber, dueIndex + 1)
        .setValue(due - applied);
      remaining -= applied;
    }
  });
  const paymentId = "SPAY-" + new Date().getTime();
  const paymentOut = getPaymentOutSheet_(ss);
  const voucherNo = nextPaymentVoucherNumber_(paymentOut);
  const paymentDate = payload.paymentDate || new Date();
  appendPaymentOut_(paymentOut, {
    "Voucher No": voucherNo,
    "Payment ID": paymentId,
    "Payment Type": "STAFF PAYMENT",
    "Payee ID": employeeId,
    "Payee Name": employeeName,
    "Previous Due": previousDue,
    "Paid Amount": amount,
    "Remaining Due": Math.max(previousDue - amount, 0),
    "Advance Amount": advanceAmount,
    "Payment Method": payload.paymentMethod || "",
    "Payment Date": paymentDate,
    Remarks:
      String(payload.remarks || "") +
      (advanceAmount
        ? (payload.remarks ? " | " : "") +
          "Staff advance: " + advanceAmount.toFixed(2)
        : ""),
    "Created At": new Date(),
  });
  updatePayrollSummary_(employeeId);
  SpreadsheetApp.flush();
  return jsonResponse(true, "Staff payment recorded successfully.", {
    voucherNo: voucherNo,
    paymentId: paymentId,
    paymentType: "STAFF PAYMENT",
    payeeId: employeeId,
    payeeName: employeeName,
    previousDue: previousDue,
    paidAmount: amount,
    remainingDue: Math.max(previousDue - amount, 0),
    advanceAmount: advanceAmount,
    paymentMethod: payload.paymentMethod || "",
    paymentDate: paymentDate,
    remarks: payload.remarks || "",
  });
}

function refreshConnectedData_(spreadsheet) {
  syncAllVendorLedgerTotals_(spreadsheet);
  SpreadsheetApp.flush();
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheetName = e.range.getSheet().getName();
  if (
    [
      "Purchased",
      "ExpensesPurchases",
      "VendorPayments",
      "Vendor Ledger",
      "VendorLedgers",
    ].indexOf(sheetName) === -1
  ) {
    return;
  }
  refreshConnectedData_(e.range.getSheet().getParent());
}

function getVendorPurchaseTotals_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const purchaseSheet =
    getPurchasedSheet_(spreadsheet) ||
    spreadsheet.getSheetByName("ExpensesPurchases");

  if (!purchaseSheet) {
    return {};
  }

  const values = purchaseSheet.getDataRange().getValues();
  const headers = values[0] || [];
  const rows = values.slice(1).map(function (row, rowIndex) {
    const record = { rowIndex: rowIndex };
    headers.forEach(function (header, index) {
      record[normalizeHeaderKey(header)] = row[index];
    });
    return record;
  });
  const totals = {};
  const seenBills = {};
  rows.forEach(function (row) {
    const vendor = String(row.vendorname || "")
      .trim()
      .toLowerCase();
    const bill = String(
      row.purchaseid || row.invoicenumber || row.invoiceno || row.billno || "",
    ).trim();
    if (!vendor) return;
    const billKey = vendor + "|" + (bill || "row-" + row.rowIndex);
    if (seenBills[billKey]) return;
    seenBills[billKey] = true;
    if (!totals[vendor])
      totals[vendor] = { totalPurchases: 0, totalPaid: 0, totalDue: 0 };
    totals[vendor].totalPurchases += Number(
      row.totalamount ||
        row.totalpurchasedamount ||
        row.purchasedamount ||
        row.amount ||
        0,
    );
    totals[vendor].totalPaid += Number(
      row.paidamount || row.totalpaidamount || row.paid || 0,
    );
    totals[vendor].totalDue += Number(
      row.dueamount || row.totaldueamount || row.due || 0,
    );
  });
  const paymentSheet = spreadsheet.getSheetByName("VendorPayments");
  if (paymentSheet) {
    const paymentValues = paymentSheet.getDataRange().getValues();
    const paymentHeaders = paymentValues[0] || [];
    paymentValues.slice(1).forEach(function (row) {
      const record = {};
      paymentHeaders.forEach(function (header, index) {
        record[normalizeHeaderKey(header)] = row[index];
      });
      const vendor = String(record.vendorname || "")
        .trim()
        .toLowerCase();
      if (!vendor) return;
      if (!totals[vendor])
        totals[vendor] = { totalPurchases: 0, totalPaid: 0, totalDue: 0 };
      totals[vendor].totalPaid += Number(record.amount || 0);
    });
  }
  Object.keys(totals).forEach(function (vendor) {
    totals[vendor].totalDue =
      totals[vendor].totalPurchases - totals[vendor].totalPaid;
  });
  return totals;
}

function getVendorLedgerSheet_(spreadsheet) {
  const aliases = ["Vendor Ledger", "VendorLedgers"];
  for (let i = 0; i < aliases.length; i += 1) {
    const sheet = spreadsheet.getSheetByName(aliases[i]);
    if (sheet) return sheet;
  }
  return spreadsheet.insertSheet("Vendor Ledger");
}

function syncAllVendorLedgerTotals_(spreadsheet) {
  const ledger = getVendorLedgerSheet_(spreadsheet);
  const values = ledger.getDataRange().getValues();
  const headers = values[0] || [];
  const nameIndex = headers.findIndex(function (header) {
    return ["name", "vendorname"].indexOf(normalizeHeaderKey(header)) !== -1;
  });
  if (nameIndex < 0)
    throw new Error("Vendor Ledger is missing the vendor name column.");

  values.slice(1).forEach(function (row) {
    const vendorName = String(row[nameIndex] || "").trim();
    if (vendorName) syncVendorLedgerTotals_(spreadsheet, vendorName);
  });
}

function syncVendorLedgerTotals_(spreadsheet, vendorName) {
  const ledger = getVendorLedgerSheet_(spreadsheet);
  const requiredHeaders = [
    "PAN/VAT No",
    "Vendor Name",
    "Address",
    "Contact No",
    "Opening Balance",
    "Purchased",
    "Paid Amount",
    "Due Amount",
    "Status",
  ];

  let headers =
    ledger.getRange(1, 1, 1, ledger.getLastColumn()).getValues()[0] || [];
  if (!headers.length) {
    ledger
      .getRange(1, 1, 1, requiredHeaders.length)
      .setValues([requiredHeaders]);
    headers = requiredHeaders;
  }

  const totals = getVendorPurchaseTotals_()[
    String(vendorName || "")
      .trim()
      .toLowerCase()
  ] || {
    totalPurchases: 0,
    totalPaid: 0,
    totalDue: 0,
  };

  const data = ledger.getDataRange().getValues();
  const findColumn = function (names) {
    return headers.findIndex(function (header) {
      return names.indexOf(normalizeHeaderKey(header)) !== -1;
    });
  };
  const nameIndex = findColumn(["vendorname", "name"]);
  const purchasedIndex = findColumn([
    "purchased",
    "totalpurchasedamount",
    "totalpurchased",
  ]);
  const paidIndex = findColumn(["paidamount", "totalpaidamount", "paid"]);
  const dueIndex = findColumn(["dueamount", "totaldueamount", "due"]);
  const rowIndex = data.slice(1).findIndex(function (row) {
    return (
      nameIndex >= 0 &&
      String(row[nameIndex] || "")
        .trim()
        .toLowerCase() ===
        String(vendorName || "")
          .trim()
          .toLowerCase()
    );
  });

  if (rowIndex >= 0) {
    const sheetRow = rowIndex + 2;
    if (purchasedIndex >= 0)
      ledger
        .getRange(sheetRow, purchasedIndex + 1)
        .setValue(Number(totals.totalPurchases || 0));
    if (paidIndex >= 0)
      ledger
        .getRange(sheetRow, paidIndex + 1)
        .setValue(Number(totals.totalPaid || 0));
    if (dueIndex >= 0) {
      const openingIndex = findColumn(["openingbalance", "opening"]);
      const opening =
        openingIndex >= 0 ? Number(data[rowIndex + 1][openingIndex] || 0) : 0;
      ledger
        .getRange(sheetRow, dueIndex + 1)
        .setValue(
          opening +
            Number(totals.totalPurchases || 0) -
            Number(totals.totalPaid || 0),
        );
    }
  } else {
    const newRow = headers.map(function () {
      return "";
    });
    if (nameIndex >= 0) newRow[nameIndex] = vendorName;
    if (purchasedIndex >= 0)
      newRow[purchasedIndex] = Number(totals.totalPurchases || 0);
    if (paidIndex >= 0) newRow[paidIndex] = Number(totals.totalPaid || 0);
    if (dueIndex >= 0) newRow[dueIndex] = Number(totals.totalDue || 0);
    ledger.appendRow(newRow);
  }
}

function findInventoryItem_(spreadsheet, item) {
  const sheet = spreadsheet.getSheetByName("Inventory");
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const itemIdColumn = headers.indexOf("Item ID");
  const itemNameColumn = headers.indexOf("Item Name");
  const unitColumn = headers.indexOf("Unit");
  const requestedId = String(item.itemId || item["Item ID"] || "")
    .trim()
    .toLowerCase();
  const requestedName = String(item.itemName || "")
    .trim()
    .toLowerCase();

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index] || [];
    const rowId =
      itemIdColumn >= 0 ? String(row[itemIdColumn] || "").trim() : "";
    const rowName =
      itemNameColumn >= 0 ? String(row[itemNameColumn] || "").trim() : "";
    if (
      (requestedId && rowId.toLowerCase() === requestedId) ||
      (!requestedId && requestedName && rowName.toLowerCase() === requestedName)
    ) {
      return {
        itemId: rowId,
        unit: unitColumn >= 0 ? String(row[unitColumn] || "").trim() : "",
      };
    }
  }
  return null;
}

function upsertPurchasedInventoryQty_(spreadsheet, item, quantity, rate) {
  const sheet = getPurchasedInventorySheet_(spreadsheet);
  if (!sheet) throw new Error('Sheet "Purchased Inventory" was not found.');

  const normalize = function (value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  };
  let lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([["Item Name", "Qty", "Price"]]);
    lastColumn = 3;
  }

  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0] || [];
  const requiredHeaders = ["Item Name", "Qty", "Price"];
  requiredHeaders.forEach(function (requiredHeader) {
    const exists = headers.some(function (header) {
      return normalize(header) === normalize(requiredHeader);
    });
    if (!exists) {
      lastColumn += 1;
      sheet.getRange(1, lastColumn).setValue(requiredHeader);
      headers.push(requiredHeader);
    }
  });

  const values = sheet.getDataRange().getValues();
  const column = function (names) {
    return headers.findIndex(function (header) {
      return names.indexOf(normalize(header)) !== -1;
    });
  };

  const nameIndex = column(["itemname", "productname"]);
  const qtyIndex = column(["qty", "quantity"]);
  const unitIndex = column(["unit"]);
  const costIndex = column(["price", "costprice", "unitprice", "rate"]);
  const idIndex = column(["itemid", "id"]);
  if (nameIndex < 0 || qtyIndex < 0) return null;

  const itemName = String(item.itemName || item["Item Name"] || "").trim();
  const itemKey = itemName.toLowerCase();
  const existingIndex = values.slice(1).findIndex(function (row) {
    return (
      String(row[nameIndex] || "")
        .trim()
        .toLowerCase() === itemKey
    );
  });

  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    const currentQty = Number(values[existingIndex + 1][qtyIndex] || 0);
    sheet
      .getRange(rowNumber, qtyIndex + 1)
      .setValue(currentQty + Number(quantity));
    if (costIndex >= 0 && Number(rate) >= 0) {
      sheet.getRange(rowNumber, costIndex + 1).setValue(Number(rate));
    }
    const inventoryResult = updateInventoryStockFromPurchase_(
      spreadsheet,
      item,
      quantity,
      rate,
    );
    return {
      itemId:
        idIndex >= 0
          ? String(values[existingIndex + 1][idIndex] || "").trim()
          : "",
      unit:
        unitIndex >= 0
          ? String(values[existingIndex + 1][unitIndex] || "").trim()
          : "",
      qtyIsCurrentStock:
        normalize(headers[qtyIndex]) !== "qty" &&
        normalize(headers[qtyIndex]) !== "quantity",
      inventoryUpdated: inventoryResult,
    };
  }

  const newItemId = "INV-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const newRecord = {};
  headers.forEach(function (header) {
    newRecord[String(header || "").trim()] = "";
  });
  newRecord[headers[nameIndex]] = itemName;
  newRecord[headers[qtyIndex]] = Number(quantity);
  if (idIndex >= 0) newRecord[headers[idIndex]] = newItemId;
  if (unitIndex >= 0)
    newRecord[headers[unitIndex]] = String(item.unit || "").trim();
  if (costIndex >= 0) newRecord[headers[costIndex]] = Number(rate);

  sheet.appendRow(
    headers.map(function (header) {
      return newRecord[String(header || "").trim()] !== undefined
        ? newRecord[String(header || "").trim()]
        : "";
    }),
  );
  const inventoryResult = updateInventoryStockFromPurchase_(
    spreadsheet,
    item,
    quantity,
    rate,
  );
  return {
    itemId: idIndex >= 0 ? newItemId : "",
    unit: unitIndex >= 0 ? newRecord[headers[unitIndex]] : "",
    qtyIsCurrentStock:
      normalize(headers[qtyIndex]) !== "qty" &&
      normalize(headers[qtyIndex]) !== "quantity",
    inventoryUpdated: inventoryResult,
  };
}

function updateInventoryStockFromPurchase_(spreadsheet, item, quantity, rate) {
  const inventory = spreadsheet.getSheetByName("Inventory");
  if (!inventory) return false;
  const values = inventory.getDataRange().getValues();
  if (!values.length) return false;
  const headers = values[0] || [];
  const idIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "itemid";
  });
  const nameIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "itemname";
  });
  const stockIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "currentstock";
  });
  const costIndex = headers.findIndex(function (header) {
    return normalizeHeaderKey(header) === "costprice";
  });
  if (stockIndex < 0 || (idIndex < 0 && nameIndex < 0)) return false;
  const requestedId = String(item.itemId || item["Item ID"] || "").trim().toLowerCase();
  const requestedName = String(item.itemName || item["Item Name"] || "").trim().toLowerCase();
  let rowNumber = -1;
  for (let index = 1; index < values.length; index += 1) {
    const row = values[index];
    const sameId = requestedId && idIndex >= 0 &&
      String(row[idIndex] || "").trim().toLowerCase() === requestedId;
    const sameName = !requestedId && requestedName && nameIndex >= 0 &&
      String(row[nameIndex] || "").trim().toLowerCase() === requestedName;
    if (sameId || sameName) {
      rowNumber = index + 1;
      break;
    }
  }
  if (rowNumber < 0) return false;
  const current = Number(inventory.getRange(rowNumber, stockIndex + 1).getValue() || 0);
  inventory.getRange(rowNumber, stockIndex + 1).setValue(roundMoney(current + Number(quantity)));
  if (costIndex >= 0 && Number(rate) >= 0) {
    inventory.getRange(rowNumber, costIndex + 1).setValue(roundMoney(rate));
  }
  return true;
}

/*

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();


    const inventory =
      ss.getSheetByName(
        "Inventory"
      );


    const transactions =
      ss.getSheetByName(
        "InventoryTransactions"
      );


    const inventoryData =
      inventory
        .getDataRange()
        .getValues();


    const inventoryHeaders =
      inventoryData[0];


    const itemColumn =
      findColumn(
        inventoryHeaders,
        [
          "Item ID"
        ]
      );


    const stockColumn =
      findColumn(
        inventoryHeaders,
        [
          "Current Stock"
        ]
      );


    let inventoryRow =
      -1;


    let itemName =
      "";


    let unit =
      "";


    for (
      let i = 1;
      i < inventoryData.length;
      i++
    ) {

      if (
        String(
          inventoryData[i][itemColumn] ||
          ""
        ).trim() ===
        itemId
      ) {

        inventoryRow =
          i + 1;

        itemName =
          inventoryData[i][
            findColumn(
              inventoryHeaders,
              [
                "Item Name"
              ]
            )
          ] || "";

        unit =
          inventoryData[i][
            findColumn(
              inventoryHeaders,
              [
                "Unit"
              ]
            )
          ] || "";

        break;

      }

    }


    if (
      inventoryRow === -1
    ) {

      return jsonResponse(
        false,
        "Inventory item not found."
      );

    }


    const currentStock =
      Number(
        inventory
          .getRange(
            inventoryRow,
            stockColumn + 1
          )
          .getValue() || 0
      );


    let newStock;


    if (
      type.toUpperCase() ===
      "IN"
    ) {

      newStock =
        currentStock +
        quantity;

    } else {

      newStock =
        currentStock -
        quantity;


      if (
        newStock < 0
      ) {

        return jsonResponse(
          false,
          "Insufficient stock."
        );

      }

    }


    inventory
      .getRange(
        inventoryRow,
        stockColumn + 1
      )
      .setValue(
        newStock
      );


    const now =
      new Date();


    const timezone =
      Session.getScriptTimeZone();


    const record = {

      "Transaction ID":
        "STK-" +
        Utilities.getUuid()
          .substring(0, 8)
          .toUpperCase(),

      "Date":
        Utilities.formatDate(
          now,
          timezone,
          "yyyy-MM-dd"
        ),

      "Time":
        Utilities.formatDate(
          now,
          timezone,
          "HH:mm:ss"
        ),

      "Item ID":
        itemId,

      "Item Name":
        itemName,

      "Transaction Type":
        type.toUpperCase(),

      "Quantity":
        quantity,

      "Unit":
        unit,

      "Rate":
        Number(
          request.rate ||
          0
        ),

      "Amount":
        Number(
          request.amount ||
          0
        ),

      "Reference":
        request.reference ||
        "",

      "Remarks":
        request.remarks ||
        "",

      "Created At":
        now

    };


    const headers =
      transactions
        .getRange(
          1,
          1,
          1,
          transactions.getLastColumn()
        )
        .getValues()[0];


    transactions.appendRow(
      headers.map(
        function(header) {

          return record[header] !== undefined
            ? record[header]
            : "";

        }
      )
    );


    return jsonResponse(
      true,
      "Inventory transaction saved.",
      {

        itemId:
          itemId,

        previousStock:
          currentStock,

        newStock:
          newStock,

        transaction:
          record

      }
    );


  } catch (error) {

    return jsonResponse(
      false,
      "Inventory transaction error: " +
      error.message
    );

  }

}


*/

/* ============================================================
   38. PAYROLL
============================================================ */

function getPayrollPriorOutstanding_(employeeId) {
  const records = getSheetObjects_("Payroll");
  return records.reduce(function (total, record) {
    if (
      String(record["Employee ID"] || "").trim() !==
      String(employeeId || "").trim()
    ) {
      return total;
    }
    return total + Math.max(Number(record["Due Salary"] || 0), 0);
  }, 0);
}

function updatePayrollSummary_(employeeId) {
  const payrollRecords = getSheetObjects_("Payroll");
  const matching = payrollRecords.filter(function (record) {
    return (
      String(record["Employee ID"] || "").trim() ===
      String(employeeId || "").trim()
    );
  });
  const summarySheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PayrollSummary");
  if (!summarySheet) throw new Error("PayrollSummary sheet is not available.");
  const paymentOut = getPaymentOutSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const paymentRows = paymentOut.getDataRange().getValues();
  const paymentHeaders = paymentRows[0] || [];
  const paymentEmployeeIndex = paymentHeaders.findIndex(function (header) {
    return normalizeHeaderKey(header) === "payeeid";
  });
  const paymentTypeIndex = paymentHeaders.findIndex(function (header) {
    return normalizeHeaderKey(header) === "paymenttype";
  });
  const advanceIndex = paymentHeaders.findIndex(function (header) {
    return normalizeHeaderKey(header) === "advanceamount";
  });
  const totalAdvance = paymentRows.slice(1).reduce(function (total, row) {
    if (paymentEmployeeIndex < 0 || paymentTypeIndex < 0 || advanceIndex < 0)
      return total;
    const isStaffPayment =
      String(row[paymentTypeIndex] || "").toUpperCase() === "STAFF PAYMENT";
    const isEmployee =
      String(row[paymentEmployeeIndex] || "").trim() ===
      String(employeeId || "").trim();
    return total +
      (isStaffPayment && isEmployee
        ? Math.max(Number(row[advanceIndex] || 0), 0)
        : 0);
  }, 0);
  const headers = summarySheet
    .getRange(1, 1, 1, summarySheet.getLastColumn())
    .getValues()[0];
  const first = matching[0] || {};
  const totalEarnings = matching.reduce(function (total, row) {
    return total + Number(row["Total Earning"] || 0);
  }, 0);
  const totalPaid = matching.reduce(function (total, row) {
    return total + Number(row["Total Paid"] || 0);
  }, 0);
  const summary = {
    "Employee ID": employeeId,
    "Employee Name": first["Employee Name"] || "",
    "Total Earnings": totalEarnings,
    "Total Paid": totalPaid,
    "Total Due": matching.reduce(function (total, row) {
      const net = Number(row["Net Salary"] || 0);
      const paid = Number(row["Total Paid"] || 0);
      return total + Math.max(net - paid, 0);
    }, 0),
    "Total Outstanding": Math.max(
      totalPaid + totalAdvance - totalEarnings,
      0,
    ),
    "Total Advance": totalAdvance,
    "Updated At": new Date(),
  };
  const values = summarySheet.getDataRange().getValues();
  let rowNumber = -1;
  for (let index = 1; index < values.length; index += 1) {
    if (
      String(values[index][0] || "").trim() === String(employeeId || "").trim()
    ) {
      rowNumber = index + 1;
      break;
    }
  }
  const row = headers.map(function (header) {
    return summary[header] !== undefined ? summary[header] : "";
  });
  if (rowNumber > 0)
    summarySheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  else summarySheet.appendRow(row);
  return summary;
}

function getPayrollSummary_() {
  return getTable("PayrollSummary");
}

function getPayrollRecords_() {
  return getSheetObjects_("Payroll").map(function (record) {
    const employeeId = String(
      record["Employee ID"] || record.employeeId || "",
    ).trim();
    const staff = getSheetObjects_("Staff").find(function (item) {
      return String(item["Employee ID"] || "").trim() === employeeId;
    }) || {};
    const employeeName = String(
      record["Employee Name"] || staff["Full Name"] || employeeId || "",
    ).trim();
    const designation = String(
      record.Designation || staff["Job Title"] || "",
    ).trim();
    return Object.assign({}, record, {
      "Employee ID": employeeId,
      "Employee Name": employeeName,
      employeeName: employeeName,
      Designation: designation,
      designation: designation,
      "Joining Date": record["Joining Date"] || staff["Joining Date"] || "",
    });
  });
}

function savePayroll(request) {
  try {
    request = request || {};

    const employeeId = String(
      request.employeeId || request.employeeID || request["Employee ID"] || "",
    ).trim();

    const payrollMonth = String(
      request.payrollMonth || request["Payroll Month"] || "",
    ).trim();

    if (!employeeId) {
      return jsonResponse(false, "Employee ID is required.");
    }

    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      return jsonResponse(false, "Payroll Month must be YYYY-MM.");
    }

    const staffRecords = getSheetObjects_("Staff");

    const staff = staffRecords.find(function (record) {
      return String(record["Employee ID"] || "").trim() === employeeId;
    });

    if (!staff) {
      return jsonResponse(false, "Employee not found.");
    }

    const joiningDateValue = staff["Joining Date"];
    const joiningDate = joiningDateValue instanceof Date
      ? Utilities.formatDate(joiningDateValue, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(joiningDateValue || "").slice(0, 10);
    if (joiningDate) {
      const joiningMonth = joiningDate.slice(0, 7);
      if (payrollMonth < joiningMonth) {
        return jsonResponse(false, "Salary cannot be calculated before the staff joining month.");
      }
      if (payrollMonth === joiningMonth) {
        const joiningDay = Number(joiningDate.slice(8, 10));
        const daysInMonth = new Date(
          Number(payrollMonth.slice(0, 4)),
          Number(payrollMonth.slice(5, 7)),
          0,
        ).getDate();
        const eligibleDays = daysInMonth - joiningDay + 1;
        const requestedDays = request.daysWorked === undefined
          ? eligibleDays
          : Number(request.daysWorked);
        if (!Number.isInteger(requestedDays) || requestedDays < 0 || requestedDays > eligibleDays) {
          return jsonResponse(false, "Days worked cannot exceed " + eligibleDays + " days for the joining month.");
        }
        request.daysWorked = requestedDays;
      }
    }

    const basicSalary = Number(staff["Basic Salary"] || 0);

    const workingDays = 26;

    const daysWorked =
      request.daysWorked === undefined ? 26 : Number(request.daysWorked);

    if (!Number.isFinite(daysWorked) || daysWorked < 0 || daysWorked > 31) {
      return jsonResponse(false, "Days Worked must be between 0 and 31.");
    }

    const allowance = Number(request.allowance || 0);

    const bonus = Number(request.bonus || 0);

    const deduction = Number(request.deduction || 0);
    const totalPaid = Math.max(0, Number(request.totalPaid || 0));
    if (![allowance, bonus, deduction, totalPaid].every(Number.isFinite) ||
        allowance < 0 || bonus < 0 || deduction < 0) {
      return jsonResponse(false, "Payroll amounts must be valid non-negative numbers.");
    }

    const earnedBasic = roundMoney((basicSalary / workingDays) * daysWorked);

    const gross = roundMoney(earnedBasic + allowance + bonus);

    const tds = roundMoney(gross * 0.01);

    const net = roundMoney(gross - tds - deduction);
    if (net < 0) {
      return jsonResponse(false, "Deductions cannot exceed the earned salary.");
    }
    if (totalPaid > net) {
      return jsonResponse(false, "Total paid cannot exceed the net salary.");
    }
    const dueSalary = roundMoney(Math.max(0, net - totalPaid));
    const outstandingSalary = roundMoney(Math.max(0, totalPaid - net));

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Payroll");

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    const payrollId =
      "PAY-" + payrollMonth + "-" + employeeId + "-" + new Date().getTime();

    const existing = getSheetObjects_("Payroll").some(function (record) {
      return (
        String(record["Employee ID"] || "").trim() === employeeId &&
        String(record["Payroll Month"] || "").trim() === payrollMonth
      );
    });

    if (existing) {
      return jsonResponse(
        false,
        "Payroll already exists for this employee and month.",
      );
    }

    const record = {
      "Payroll ID": payrollId,

      "Employee ID": employeeId,

      "Employee Name": staff["Full Name"] || "",

      Designation: staff["Job Title"] || "",

      "Basic Salary": basicSalary,

      "Payroll Month": payrollMonth,

      "Normal Working Days": workingDays,

      "Days Worked": daysWorked,

      "Earned Salary": earnedBasic,

      Bonus: bonus,

      Allowance: allowance,

      "Total Earning": gross,

      Deduction: deduction,

      TDS: tds,

      "Net Salary": net,

      "Total Paid": totalPaid,

      "Due Salary": dueSalary,

      "Outstanding Salary": outstandingSalary,

      "Payment Method": request.paymentMethod || "",

      "Payment Date": request.paymentDate || "",

      Remarks: request.remarks || "",

      "Created At": new Date(),
    };

    sheet.appendRow(
      headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      }),
    );

    const summary = updatePayrollSummary_(employeeId);

    return jsonResponse(true, "Payroll saved successfully.", {
      monthly: record,
      summary: summary,
    });
  } catch (error) {
    return jsonResponse(false, "Payroll error: " + error.message);
  }
}

/* ============================================================
   39. SET STATUS
============================================================ */

function setStatusByKey_(
  sheetName,
  keyColumnName,
  keyValue,
  statusValue,
  statusColumnName,
) {
  try {
    statusColumnName = statusColumnName || "Status";

    keyValue = String(keyValue || "").trim();

    if (!keyValue) {
      return jsonResponse(false, keyColumnName + " is required.");
    }

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(sheetName + " sheet not found.");
    }

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    const keyColumn = findColumn(headers, [keyColumnName]);

    const statusColumn = findColumn(headers, [statusColumnName]);

    if (keyColumn === -1) {
      throw new Error(keyColumnName + " column not found.");
    }

    if (statusColumn === -1) {
      throw new Error(statusColumnName + " column not found.");
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][keyColumn] || "").trim() === keyValue) {
        sheet.getRange(i + 1, statusColumn + 1).setValue(statusValue);

        const updatedColumn = findColumn(headers, ["Updated At"]);

        if (updatedColumn !== -1) {
          sheet.getRange(i + 1, updatedColumn + 1).setValue(new Date());
        }

        return jsonResponse(true, "Record status updated successfully.", {
          key: keyValue,

          status: statusValue,
        });
      }
    }

    return jsonResponse(false, "Record not found.");
  } catch (error) {
    return jsonResponse(false, error.message);
  }
}

/* ============================================================
   40. DEACTIVATE STUDENT
============================================================ */

function deactivateStudent(registrationNumber) {
  return setStatusByKey_(
    "Students",
    "Registration Number",
    registrationNumber,
    "Inactive",
  );
}

function updateStudentStatus(request) {
  const status = String((request && request.status) || "").trim();
  if (["Active", "Passed"].indexOf(status) === -1) {
    return jsonResponse(false, "Student status must be Active or Passed.");
  }
  return setStatusByKey_(
    "Students",
    "Registration Number",
    request && (request.registrationNumber || request["Registration Number"]),
    status,
    "Status",
  );
}

function updateStudent(request) {
  request = request || {};
  const student = request.student || request;
  const registrationNumber = String(
    student.registrationNumber || student["Registration Number"] || "",
  ).trim();
  if (!registrationNumber)
    return jsonResponse(false, "Registration Number is required.");
  const sheet =
    findSheetCaseInsensitive_("Students");
  if (!sheet) throw new Error("Students sheet not found.");
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const keyColumn = findColumn(headers, ["Registration Number"]);
  if (keyColumn === -1)
    throw new Error("Registration Number column not found.");
  let row = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyColumn] || "").trim() === registrationNumber) {
      row = i + 1;
      break;
    }
  }
  if (row === -1) return jsonResponse(false, "Student not found.");
  const fields = {
    "registration number": registrationNumber,
    "joining date": student.joiningDate,
    "full name": student.fullName,
    "date of birth": student.dateOfBirth,
    "marital status": student.maritalStatus,
    gender: student.gender,
    address: student.address || student.personalAddress,
    "parents name": student.parentsName || student.parentName,
    relationship: student.relationship,
    "parents contact": student.parentsContact || student.parentContact,
    course: student.course,
    "course duration": student.courseDuration,
    duration: student.courseDuration,
    "registration fee": student.registrationFee,
    "training course fee": student.trainingCourseFee,
    "course fee": student.trainingCourseFee,
    discount: student.discount,
    status: student.status,
  };
  headers.forEach(function (header, index) {
    const key = normalizeHeader(header).toLowerCase();
    if (key !== "registration number" && fields[key] !== undefined)
      sheet.getRange(row, index + 1).setValue(fields[key]);
  });
  return jsonResponse(true, "Student updated successfully.");
}

/* ============================================================
   41. DEACTIVATE STAFF
============================================================ */

function deactivateStaff(employeeId) {
  return setStatusByKey_("Staff", "Employee ID", employeeId, "Inactive");
}

function updateStaffStatus(request) {
  return setStatusByKey_(
    "Staff",
    "Employee ID",
    request &&
      (request.employeeId || request.employeeID || request["Employee ID"]),
    request && request.status,
    "Status",
  );
}

/* ============================================================
   42. GET STAFF BY EMPLOYEE ID
============================================================ */

function getStaffByEmployeeId(employeeId) {
  try {
    employeeId = String(employeeId || "").trim();

    const records = getSheetObjects_("Staff");

    const employee = records.find(function (record) {
      return String(record["Employee ID"] || "").trim() === employeeId;
    });

    if (!employee) {
      return jsonResponse(false, "Employee not found.");
    }

    return jsonResponse(true, "Employee loaded successfully.", employee);
  } catch (error) {
    return jsonResponse(false, error.message);
  }
}

/* ============================================================
   43. ROUND MONEY
============================================================ */

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/* ============================================================
   44. FORMAT DATE VALUE
============================================================ */

function formatDateValue_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    );
  }

  return String(value || "").trim();
}

/* ============================================================
   45. GET API
============================================================ */

function doGet(e) {
  try {
    e = e || {};

    const action = String((e.parameter && e.parameter.action) || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    const authorizationError = authorizeRequest_(e.parameter || {}, action);
    if (authorizationError) return authorizationError;

    switch (action) {
      /* COLLEGE */

      case "getstudents":
        return getStudents();

      case "getstudentpayments":
        return getStudentPayments();

      case "getstaff":
      case "getemployees":
        return getStaff();

      case "getstaffbyemployeeid":
        return getStaffByEmployeeId(
          e.parameter.employeeId || e.parameter.employeeID || "",
        );

      case "getcourses":
        return getCourses();

      case "getvendors":
        return getVendors();

      case "getpurchaseitemsuggestions":
      case "searchpurchaseitems":
        return getPurchaseItemSuggestions_(e.parameter || {});

      case "getpurchasebills":
        return getPurchaseBills_();

      case "getpurchaseitems":
        return getPurchaseItems_();

      case "getexpensespurchases":
        return jsonResponse(
          true,
          "Expenses and purchases loaded successfully.",
          {
            expenses: getSheetObjects_("Expenses"),
            purchases: getSheetObjects_("Purchased"),
          },
        );

      case "getpayroll":
        return getPayrollRecords_();

      case "getpayrollsummary":
        return getPayrollSummary_();

      case "getusersadmin":
      case "getsystemusers":
        return getUsersForAdmin(e.parameter || {});

      case "getrolesadmin":
      case "getsystemroles":
        return getRolesForAdmin(e.parameter || {});

      case "getpermissionmatrix":
      case "getpermissionsadmin":
        return getPermissionMatrix(e.parameter || {});

      /* CAFÉ */

      case "getcafetables":
      case "gettables":
        return getCafeTables();

      case "getcafecategories":
      case "getcategoriess":
        return getCafeCategories();

      case "getcafemenu":
      case "getmenu":
        return getCafeMenu();

      case "getcafesales":
      case "getsales":
        return getCafeSales();

      case "getcafetodaysummary":
      case "getcafedailysummary":
        return getCafeTodaySummary();

      case "getcafecustomers":
      case "getcreditcustomers":
        return getCafeCustomers();

      case "getcustomerledger":
        return getCustomerLedger();

      case "getcreditsales":
        return getCreditSales();

      case "getcustomerpayments":
        return getTable("CustomerPayments");
      case "getduereceived":
        return getDueReceived();

      case "getcafedailysales":
      case "getcafe daily sales":
        return getCafeDailySales();

      case "getcafeinventory":
      case "getinventory":
        return getInventory();

      case "getdatabase":
        return jsonResponse(
          true,
          "Database structure loaded.",
          getDatabaseStructure(),
        );

      default:
        return jsonResponse(
          false,
          action ? "Invalid GET action: " + action : "Missing action.",
        );
    }
  } catch (error) {
    return jsonResponse(false, "GET server error: " + error.message);
  }
}
/**
 * ============================================================
 * SAVE VENDOR
 * Stores vendor in existing "Vendor Ledger" sheet
 * ============================================================
 */
function saveVendor_(data) {
  try {
    // --------------------------------------------------------
    // VALIDATE INPUT
    // --------------------------------------------------------

    data = data || {};

    var vendorName = String(data.vendorName || "").trim();

    var panNo = String(data.panNo || "").trim();

    var contactNumber = String(data.contactNumber || "").trim();

    var address = String(data.address || "").trim();
    var requestedVendorId = String(
      data.vendorId || data["Vendor ID"] || data.id || "",
    ).trim();

    var openingBalance = Number(
      data.openingBalance ||
        data["Opening Balance"] ||
        data.openingbalance ||
        0,
    );

    if (!vendorName) {
      throw new Error("Vendor name is required.");
    }

    function deactivateVendor_(request) {
      var payload = request || {};
      var vendorId = String(payload.vendorId || payload["Vendor ID"] || "").trim();
      var vendorName = String(payload.vendorName || payload["Vendor Name"] || "").trim().toLowerCase();
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = getVendorLedgerSheet_(ss);
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idIndex = headers.findIndex(function (header) {
        return ["vendorid", "id"].indexOf(normalizeHeaderKey(header)) !== -1;
      });
      var nameIndex = headers.findIndex(function (header) {
        return ["vendorname", "name"].indexOf(normalizeHeaderKey(header)) !== -1;
      });
      var statusIndex = headers.findIndex(function (header) {
        return normalizeHeaderKey(header) === "status";
      });
      if (statusIndex < 0) throw new Error("Vendor Ledger is missing the Status column.");
      var rowNumber = -1;
      for (var index = 1; index < values.length; index++) {
        var matchesId = vendorId && idIndex >= 0 && String(values[index][idIndex] || "").trim() === vendorId;
        var matchesName = !vendorId && vendorName && nameIndex >= 0 &&
          String(values[index][nameIndex] || "").trim().toLowerCase() === vendorName;
        if (matchesId || matchesName) {
          rowNumber = index + 1;
          break;
        }
      }
      if (rowNumber < 0) throw new Error("Vendor was not found.");
      sheet.getRange(rowNumber, statusIndex + 1).setValue("Inactive");
      refreshConnectedData_(ss);
      return jsonResponse(true, "Vendor deactivated successfully.", {
        vendorId: idIndex >= 0 ? values[rowNumber - 1][idIndex] : "",
      });
    }

    if (!panNo) {
      throw new Error("PAN/VAT No is required.");
    }

    if (!contactNumber) {
      throw new Error("Contact No is required.");
    }

    if (!address) {
      throw new Error("Address is required.");
    }

    // --------------------------------------------------------
    // OPEN DATABASE
    // --------------------------------------------------------

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheet = getVendorLedgerSheet_(ss);

    if (!sheet) {
      throw new Error("Vendor Ledger sheet not found.");
    }

    // --------------------------------------------------------
    // READ HEADER ROW
    // --------------------------------------------------------

    var lastColumn = sheet.getLastColumn();

    if (lastColumn < 1) {
      throw new Error("Vendor Ledger has no columns.");
    }

    var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    // --------------------------------------------------------
    // NORMALIZE HEADER
    // --------------------------------------------------------

    function normalizeHeader(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s._/-]+/g, "");
    }

    // --------------------------------------------------------
    // FIND COLUMN
    // --------------------------------------------------------

    function findColumn(names) {
      var wanted = names.map(function (name) {
        return normalizeHeader(name);
      });

      for (var i = 0; i < headers.length; i++) {
        var current = normalizeHeader(headers[i]);

        if (wanted.indexOf(current) !== -1) {
          return i;
        }
      }

      return -1;
    }

    // --------------------------------------------------------
    // COLUMN MAPPING
    // --------------------------------------------------------

    var vendorIdColumn = findColumn(["Vendor ID", "VendorID", "ID"]);

    var nameColumn = findColumn(["Name", "Vendor Name", "VendorName"]);

    var panColumn = findColumn([
      "PAN/VAT No",
      "PAN/VAT No.",
      "PAN No",
      "PAN",
      "VAT No",
    ]);

    var contactColumn = findColumn([
      "Contact No",
      "Contact Number",
      "Contact",
      "Phone",
    ]);

    var addressColumn = findColumn(["Address"]);

    var openingBalanceColumn = findColumn([
      "Opening Balance",
      "OpeningBalance",
      "Opening_Balance",
    ]);

    var statusColumn = findColumn(["Status"]);

    var createdAtColumn = findColumn(["Created At", "CreatedAt"]);

    var updatedAtColumn = findColumn(["Updated At", "UpdatedAt"]);

    // --------------------------------------------------------
    // REQUIRED DATABASE COLUMNS
    // --------------------------------------------------------

    if (nameColumn === -1) {
      throw new Error("Vendor Ledger is missing the Name/Vendor Name column.");
    }

    if (panColumn === -1) {
      throw new Error("Vendor Ledger is missing the PAN/VAT No column.");
    }

    if (contactColumn === -1) {
      throw new Error("Vendor Ledger is missing the Contact No column.");
    }

    if (addressColumn === -1) {
      throw new Error("Vendors is missing the Address column.");
    }

    // --------------------------------------------------------
    // CHECK DUPLICATE PAN
    // --------------------------------------------------------

    var lastRow = sheet.getLastRow();

    if (lastRow > 1 && panColumn !== -1) {
      var existingPANs = sheet
        .getRange(2, panColumn + 1, lastRow - 1, 1)
        .getValues();

      for (var p = 0; p < existingPANs.length; p++) {
        var existingPAN = String(existingPANs[p][0] || "")
          .trim()
          .toLowerCase();

        var existingRowNumber = p + 2;
        var existingId =
          vendorIdColumn >= 0
            ? String(sheet.getRange(existingRowNumber, vendorIdColumn + 1).getValue() || "").trim()
            : "";
        if (
          existingPAN &&
          existingPAN === panNo.toLowerCase() &&
          existingId !== requestedVendorId
        ) {
          throw new Error(
            'A vendor with PAN/VAT No "' + panNo + '" already exists.',
          );
        }
      }
    }

    // --------------------------------------------------------
    // GENERATE VENDOR ID
    // --------------------------------------------------------

    var vendorId = requestedVendorId;

    if (!vendorId && vendorIdColumn !== -1) {
      var existingIDs = [];

      if (lastRow > 1) {
        existingIDs = sheet
          .getRange(2, vendorIdColumn + 1, lastRow - 1, 1)
          .getValues()
          .flat();
      }

      var highestNumber = 0;

      existingIDs.forEach(function (id) {
        var match = String(id || "").match(/(\d+)$/);

        if (match) {
          var number = parseInt(match[1], 10);

          if (number > highestNumber) {
            highestNumber = number;
          }
        }
      });

      vendorId = "VEN-" + String(highestNumber + 1).padStart(4, "0");
    }

    // --------------------------------------------------------
    // PREPARE DATABASE ROW
    // --------------------------------------------------------

    var rowNumber = -1;
    if (vendorId && vendorIdColumn >= 0 && lastRow > 1) {
      var ids = sheet
        .getRange(2, vendorIdColumn + 1, lastRow - 1, 1)
        .getValues();
      for (var idIndex = 0; idIndex < ids.length; idIndex++) {
        if (String(ids[idIndex][0] || "").trim() === vendorId) {
          rowNumber = idIndex + 2;
          break;
        }
      }
    }
    var row = rowNumber > 0
      ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]
      : new Array(headers.length).fill("");

    var now = new Date();

    if (vendorIdColumn !== -1) {
      row[vendorIdColumn] = vendorId;
    }

    row[nameColumn] = vendorName;

    row[panColumn] = panNo;

    row[contactColumn] = contactNumber;

    row[addressColumn] = address;

    if (openingBalanceColumn !== -1) {
      row[openingBalanceColumn] = openingBalance;
    }

    if (statusColumn !== -1) {
      row[statusColumn] = "Active";
    }

    if (createdAtColumn !== -1 && rowNumber < 0) {
      row[createdAtColumn] = now;
    }

    if (updatedAtColumn !== -1) {
      row[updatedAtColumn] = now;
    }

    // --------------------------------------------------------
    // WRITE TO VENDOR LEDGER
    // --------------------------------------------------------

    if (rowNumber > 0) {
      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    refreshConnectedData_(ss);

    // --------------------------------------------------------
    // RETURN SUCCESS
    // --------------------------------------------------------

    return {
      success: true,

      message: rowNumber > 0
        ? "Vendor updated successfully."
        : "Vendor added successfully.",

      data: {
        vendorId: vendorId,

        vendorName: vendorName,

        panNo: panNo,

        contactNumber: contactNumber,

        address: address,

        openingBalance: openingBalance,

        status: "Active",
      },
    };
  } catch (error) {
    return {
      success: false,

      message: error.message || "Unable to save vendor.",
    };
  }
}

/* ============================================================
   46. POST API
============================================================ */

function getStudentPayments() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ["Student payment", "Student Payment", "StudentPayments"]
    .map(function (name) {
      return spreadsheet.getSheetByName(name);
    })
    .find(function (candidate) {
      return !!candidate;
    });
  if (!sheet) throw new Error("Student payment sheet not found.");
  return getTable(sheet.getName());
}

function saveStudentPayment(request) {
  request = request || {};
  const studentId = String(
    request.studentId || request.registrationNumber || "",
  ).trim();
  const studentName = String(request.studentName || "").trim();
  const amount = Number(request.amount);
  if (!studentId || !studentName)
    return jsonResponse(
      false,
      "Student name and registration number are required.",
    );
  if (!isFinite(amount) || amount <= 0)
    return jsonResponse(false, "Payment amount must be greater than zero.");
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ["Student payment", "Student Payment", "StudentPayments"]
    .map(function (name) {
      return spreadsheet.getSheetByName(name);
    })
    .find(function (candidate) {
      return !!candidate;
    });
  if (!sheet) throw new Error("Student payment sheet not found.");
  const headers = sheet.getDataRange().getValues()[0] || [];
  const values = sheet.getDataRange().getValues();
  const normalized = function (value) {
    return normalizeHeaderKey(value);
  };
  const paymentRows = values.slice(1);
  const paidForStudent = paymentRows.reduce(function (total, row) {
    const rowStudentId = String(
      row[
        headers.findIndex(function (header) {
          return (
            ["registrationno", "registrationnumber", "studentid"].indexOf(
              normalized(header),
            ) !== -1
          );
        })
      ] || "",
    )
      .trim()
      .toLowerCase();
    if (rowStudentId !== studentId.toLowerCase()) return total;
    const amountIndex = headers.findIndex(function (header) {
      return normalized(header) === "amount";
    });
    return total + Number(amountIndex >= 0 ? row[amountIndex] || 0 : 0);
  }, 0);
  const record = {
    "Payment ID": "PAY-" + new Date().getTime(),
    "Student ID": studentId,
    "Registration No.": studentId,
    "Student Name": studentName,
    Date: request.paymentDate || new Date(),
    "Payment Type": request.paymentType || "Course Fee",
    "Fee Type": request.paymentType || "Course Fee",
    Amount: amount,
    "Payment Date": request.paymentDate || new Date(),
    "Payment Mode": request.paymentMode || "Cash",
    "Payment Method": request.paymentMode || "Cash",
    "Due Amount":
      request.dueAmount !== undefined ? Number(request.dueAmount) : "",
    Remarks: request.remarks || "",
    "Created At": new Date(),
  };
  const feeType = String(request.paymentType || "")
    .trim()
    .toLowerCase();
  if (record["Due Amount"] === "" && feeType) {
    record["Due Amount"] = Math.max(
      0,
      Number(request.studentDueAmount || 0) - paidForStudent - amount,
    );
  }
  sheet.appendRow(
    headers.map(function (header) {
      const key = normalized(header);
      const recordKey = Object.keys(record).find(function (candidate) {
        return normalized(candidate) === key;
      });
      return recordKey === undefined ? "" : record[recordKey];
    }),
  );
  return jsonResponse(true, "Payment saved successfully.", record);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(false, "No POST data received.");
    }

    let request;

    try {
      request = JSON.parse(e.postData.contents);
    } catch (error) {
      return jsonResponse(false, "Invalid JSON.");
    }

    const action = String(
      request.action || (e.parameter && e.parameter.action) || "",
    )
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    if (action === 'exportalldata') return exportAllData_(request);
    if (action === 'readpersonfile') return readPersonFile_(request);
    const authorizationError = authorizeRequest_(request, action);
    if (authorizationError) return authorizationError;

    switch (action) {
      case "savevendor":
      case "updatevendor":
        var vendorResult = saveVendor_(request);
        return jsonResponse(
          vendorResult.success,
          vendorResult.message,
          vendorResult.data,
        );

      case "deletevendor":
      case "deactivatevendor":
        return deactivateVendor_(request);

      case "savepurchase":
        return savePurchase(request);

      case "saveexpense":
        return saveExpense(request);

      case "uploadpurchasebill":
        return uploadPurchaseBillFromClient_(request);

      case "getpurchasebills":
        return getPurchaseBills_();

      case "retrypurchasebillupload":
        return retryPurchaseBillUpload_(request);

      case "getpurchaseitemsuggestions":
      case "searchpurchaseitems":
        return getPurchaseItemSuggestions_(request);

      case "savevendorpayment":
        return saveVendorPayment(request);

      case "savestaffpayment":
        return saveStaffPayment(request);

      case "savestudentpayment":
        return saveStudentPayment(request);

      case "saveduereceived":
        return saveDueReceived(request);

      case "authenticateuser":
      case "login":
        return authenticateUser(request);

      case "saveuser":
      case "savesystemuser":
        return saveSystemUser(request);

      case "deleteuser":
      case "deletesystemuser":
        return deleteSystemUser(request);

      case "getusersadmin":
      case "getsystemusers":
        return getUsersForAdmin(request);

      case "getrolesadmin":
      case "getsystemroles":
        return getRolesForAdmin(request);

      case "getpermissionmatrix":
      case "getpermissionsadmin":
        return getPermissionMatrix(request);

      case "saverole":
      case "savesystemrole":
        return saveSystemRole(request);

      case "deleterole":
      case "deletesystemrole":
        return deleteSystemRole(request);

      case "savepermission":
      case "savepermissionassignment":
        return savePermissionAssignments(request);

      case "savecourse":
      case "updatecourse":
        return jsonResponse(saveCourse_(request));

      case "deletecourse":
        return jsonResponse(deleteCourse_(request));

      /* ======================================================
         DATABASE
      ====================================================== */

      case "initializedatabase":
        return jsonResponse(
          true,
          "Database initialized.",
          initializeDatabase(),
        );

      case "upsertreport":
        return upsertReport_(request);
      case "uploadpersonfile":
        return uploadPersonFile_(request);

      /* ======================================================
         STUDENTS
      ====================================================== */

      case "savestudent":
      case "registerstudent":
      case "addstudent":
        return saveStudent(request);

      case "updatestudent":
        return updateStudent(request);

      case "deletestudent":
        return deactivateStudent(
          request.registrationNumber ||
            request["Registration Number"] ||
            request.studentId,
        );

      case "deactivatestudent":
        return deactivateStudent(
          request.registrationNumber || request["Registration Number"],
        );

      case "updatestudentstatus":
        return updateStudentStatus(request);

      /* ======================================================
         STAFF
      ====================================================== */

      case "savestaff":
      case "saveemployee":
        return saveStaff(request);

      case "updatestaff":
        return saveStaff(request);

      case "deletestaff":
        return deactivateStaff(
          request.employeeId || request.employeeID || request["Employee ID"],
        );

      case "deactivatestaff":
      case "deactivateemployee":
        return deactivateStaff(
          request.employeeId || request.employeeID || request["Employee ID"],
        );

      case "updatestaffstatus":
        return updateStaffStatus(request);

      /* ======================================================
         PAYROLL
      ====================================================== */

      case "savepayroll":
      case "createpayroll":
        return savePayroll(request);

      case "getpayroll":
        return getTable("Payroll");

      case "getpayrollsummary":
        return getPayrollSummary_();

      /* ======================================================
         CAFÉ TABLES
      ====================================================== */

      case "savecafetables":
      case "savecafetable":
      case "savetables":
        return saveCafeTable(request);

      case "disablecafetable":
      case "disabletable":
        return disableCafeTable(request.tableNo || request["Table No"]);

      /* ======================================================
         CAFÉ CATEGORY
      ====================================================== */

      case "savecafecategory":
      case "savecategory":
        return saveCafeCategory(request);

      /* ======================================================
         CAFÉ MENU
      ====================================================== */

      case "savecafemenu":
      case "savecafeitem":
      case "savemenu":
        return saveCafeMenu(request);

      case "disablecafemenuitem":
      case "disablemenuitem":
        return disableCafeMenuItem(request.itemId || request["Item ID"]);

      /* ======================================================
         CAFÉ SALES
      ====================================================== */

      case "savecafesale":
      case "savecafe sales":
      case "savecafetransaction":
      case "savesale":
        return saveCafeSale(request);

      case "submitcafedailyclosingreport":
      case "submitcafeclosingreport":
      case "submitclosingreport":
        return submitCafeDailyClosingReport(request);

      case "savecafecustomer":
      case "savecreditcustomer":
        return saveCafeCustomer(request);

      case "disablecafecustomer":
      case "deactivatecafecustomer":
        return disableCafeCustomer(
          request.customerId || request["Customer ID"],
        );

      /* ======================================================
         INVENTORY
      ====================================================== */

      case "saveinventoryitem":
      case "saveinventory":
        return saveInventoryItem(request);

      case "addinventorytransaction":
      case "stocktransaction":
        return addInventoryTransaction(request);

      /* ======================================================
         DEFAULT
      ====================================================== */

      default:
        if (request.customerName || request["Customer Name"]) {
          return saveCafeCustomer(request);
        }

        return jsonResponse(
          false,
          action ? "Invalid POST action: " + action : "Missing POST action.",
        );
    }
  } catch (error) {
    return jsonResponse(false, "POST server error: " + error.message);
  }
}

/* ============================================================
   47. DRIVE TESTS
============================================================ */

function testStudentsDriveFolder() {
  const folder = getStudentsDriveFolder();

  return {
    success: true,

    folderName: folder.getName(),

    folderId: folder.getId(),

    url: folder.getUrl(),
  };
}

function testStaffDriveFolder() {
  const folder = getStaffDriveFolder();

  return {
    success: true,

    folderName: folder.getName(),

    folderId: folder.getId(),

    url: folder.getUrl(),
  };
}

/* ============================================================
   48. DATABASE CHECK
============================================================ */

function checkDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const database = getDatabaseStructure();

  const result = {};

  Object.keys(database).forEach(function (tableName) {
    const sheet = ss.getSheetByName(tableName);

    result[tableName] = {
      exists: !!sheet,

      rows: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0,

      columns: sheet ? sheet.getLastColumn() : 0,
    };
  });

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/* ============================================================
   49. DEFAULT ROLES
============================================================ */

function setupDefaultRoles() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Roles");

  if (!sheet) {
    throw new Error("Roles sheet not found. Run initializeDatabase() first.");
  }

  if (sheet.getLastRow() > 1) {
    return {
      success: true,

      message: "Roles already exist.",
    };
  }

  const now = new Date();

  sheet.getRange(2, 1, 3, 6).setValues([
    ["ROLE-001", "Admin", "Full system access", "Active", now, now],

    ["ROLE-002", "Staff", "College operational access", "Active", now, now],

    [
      "ROLE-003",
      "Cashier",
      "Café sales and table operations",
      "Active",
      now,
      now,
    ],
  ]);

  return {
    success: true,

    message: "Default roles created.",
  };
}

/* ============================================================
   50. AUDIT LOG
============================================================ */

function writeAuditLog(
  userId,
  username,
  role,
  action,
  module,
  recordId,
  description,
) {
  try {
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AuditLog");

    if (!sheet) {
      return;
    }

    const now = new Date();

    const timezone = Session.getScriptTimeZone();

    const record = {
      "Log ID": "LOG-" + Utilities.getUuid().substring(0, 8).toUpperCase(),

      Date: Utilities.formatDate(now, timezone, "yyyy-MM-dd"),

      Time: Utilities.formatDate(now, timezone, "HH:mm:ss"),

      "User ID": userId || "",

      Username: username || "",

      Role: role || "",

      Action: action || "",

      Module: module || "",

      "Record ID": recordId || "",

      Description: description || "",

      "Created At": now,
    };

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    sheet.appendRow(
      headers.map(function (header) {
        return record[header] !== undefined ? record[header] : "";
      }),
    );
  } catch (error) {
    console.log("Audit log error: " + error.message);
  }
}

/* ============================================================
   51. GOOGLE SHEETS MENU
============================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("College Management")

    .addItem("Initialize / Update Database", "initializeDatabase")

    .addItem("Clear All Data (Keep Headers)", "clearAllDataKeepHeaders")

    .addItem("Check Database", "checkDatabase")

    .addItem("Setup Default Roles", "setupDefaultRoles")

    .addSeparator()

    .addItem("Test Student Drive", "testStudentsDriveFolder")

    .addItem("Test Employee Drive", "testStaffDriveFolder")

    .addToUi();
}

/* KCMT desktop migration/report-only endpoints. Included in code.gs/code.js.
 * Do not deploy this file alongside code.gs: it is its source copy. */
function findSheetCaseInsensitive_(name) {
  var matches = SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function(sheet) { return sheet.getName().toLowerCase() === name.toLowerCase(); });
  if (matches.length > 1) throw new Error('Ambiguous sheet name: ' + name);
  return matches[0] || null;
}
function readOnlyImportAdmin_(request) {
  var sheet = findSheetCaseInsensitive_('Users');
  if (!sheet) throw new Error('Existing Users sheet is required');
  var values=sheet.getDataRange().getValues(), headers=values.shift()||[];
  var user=values.map(function(row){var record={};headers.forEach(function(h,i){record[h]=row[i];});return record;}).find(function(record){return String(record.Username||'').toLowerCase()===String(request.username||'').trim().toLowerCase() && String(record.Status||'Active').toLowerCase()==='active' && verifyUserPassword_(request.password,record['Password Hash']);});
  if (!user || String(user.Role||'').toUpperCase()!=='ADMIN') throw new Error('An existing administrator account is required for initial import');
  // Intentionally no authenticateUser(), audit writes, sheet initialization,
  // password upgrade, last-login update, or session creation in this read path.
  return user;
}
function exportAllData_(request) {
  readOnlyImportAdmin_(request);
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var supported=PRODUCTION_SHEET_NAMES.map(function(name){return name.toLowerCase();});
  var sheets=ss.getSheets().filter(function(sheet){return supported.indexOf(sheet.getName().toLowerCase())>=0;}).map(function(sheet){
    var values=sheet.getDataRange().getValues(), headers=(values.shift()||[]).map(String);
    if(headers.some(function(h,i){return h && headers.indexOf(h)!==i;}))throw new Error('Duplicate headers: '+sheet.getName());
    var rows=values.map(function(cells,index){
      var row={_row:index+2};headers.forEach(function(header,i){
        var value=cells[i];
        if(Object.prototype.toString.call(value)==='[object Date]') {
          var pattern=/^time$/i.test(header)?'HH:mm:ss':/date|birth/i.test(header)&&!/created|updated|submitted|transaction/i.test(header)?'yyyy-MM-dd':'yyyy-MM-dd HH:mm:ss';
          value=Utilities.formatDate(value,ss.getSpreadsheetTimeZone(),pattern);
        }
        if(header)row[header]=value;
        else if(value!==''&&value!=null)throw new Error('Unnamed data column in '+sheet.getName());
      });return row;
    }).filter(function(row){return Object.keys(row).some(function(k){return k!=='_row'&&row[k]!==''&&row[k]!=null;});});
    return {name:sheet.getName(),headers:headers,count:rows.length,rows:rows};
  });
  return jsonResponse(true,'Read-only snapshot exported',{version:1,spreadsheetId:ss.getId(),exportedAt:new Date().toISOString(),sheets:sheets});
}
function isUnderDriveRoot_(entry,rootId) {
  var queue=[entry],seen={};
  while(queue.length){var item=queue.shift(),id=item.getId();if(id===rootId)return true;if(seen[id])continue;seen[id]=true;var parents=item.getParents();while(parents.hasNext())queue.push(parents.next());}
  return false;
}
function personRoot_(entity) {
  if(entity==='Students')return getStudentsDriveFolder();
  if(entity==='Staff')return getStaffDriveFolder();
  throw new Error('Invalid person entity');
}
function readPersonFile_(request) {
  readOnlyImportAdmin_(request);
  var root=personRoot_(request.entity),file=DriveApp.getFileById(String(request.fileId||''));
  if(!isUnderDriveRoot_(file,root.getId()))throw new Error('File is outside the configured person root');
  if(file.getSize()>20*1024*1024)throw new Error('Historical file exceeds 20 MB: '+file.getName());
  return jsonResponse(true,'File read',{fileName:file.getName(),mimeType:file.getMimeType(),base64:Utilities.base64Encode(file.getBlob().getBytes())});
}
function uploadPersonFile_(request) {
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  var driveStage='open root folder';
  try {
    var entity=String(request.entity||'').trim();
    entity=entity.toLowerCase()==='staff'?'Staff':entity.toLowerCase()==='students'?'Students':entity;
    var encoded=String(request.base64||request.data||'').replace(/^data:[^,]*,/,'');
    var root;
    try { root=personRoot_(entity); root.getName(); if(root.isTrashed && root.isTrashed())throw new Error('Root is in Trash'); }
    catch(error) { throw new Error(entity+' Drive root folder is missing or inaccessible. Restore the configured root folder and give the Apps Script deployment account Editor access.'); }
    var identifier=String(request.identifier||'').trim(),name=String(request.fullName||'').trim();
    if(!identifier||!name||(!request.folderOnly&&(!request.fileName||!encoded||!request.fileHash)))throw new Error('Missing person/file identity');
    if(!request.folderOnly&&['photo','document'].indexOf(String(request.mediaType||'').toLowerCase())<0)throw new Error('Invalid document type');
    var bytes=Utilities.base64Decode(encoded);
    if(!request.folderOnly&&(!bytes.length||bytes.length>20*1024*1024))throw new Error('File must be at most 20 MB');
    var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+(b<0?b+256:b).toString(16)).slice(-2);}).join('');
    if(!request.folderOnly&&hash!==request.fileHash)throw new Error('File hash mismatch');
    var properties=PropertiesService.getScriptProperties();
    var folderKey='KCMT_PERSON_'+entity+'_'+identifier;
    var supplied=String(request.folderId||properties.getProperty(folderKey)||'');
    var idMatch=supplied.match(/(?:\/folders\/)([\w-]+)/);
    if(idMatch)supplied=idMatch[1];
    var folder;
    driveStage='open saved person folder';
    if(supplied){
      try { folder=DriveApp.getFolderById(supplied); folder.getName(); if(folder.isTrashed && folder.isTrashed())folder=null; }
      catch(error) { folder=null; }
      if(folder && (folder.getId()===root.getId()||!isUnderDriveRoot_(folder,root.getId())))throw new Error('Person folder is outside configured root');
    }
    if(!folder) {
      driveStage='find or create person folder';
      var desired=name+' - '+identifier,existing=root.getFoldersByName(desired),legacy=root.getFoldersByName(identifier+' - '+name);
      folder=existing.hasNext()?existing.next():legacy.hasNext()?legacy.next():root.createFolder(desired);
    }
    properties.setProperty(folderKey,folder.getId());
    driveStage='create Photo subfolder';
    var photoFolder=getOrCreateChildFolder_(folder,'Photo');
    driveStage='create Documents subfolder';
    var documentsFolder=getOrCreateChildFolder_(folder,'Documents');
    if(request.folderOnly)return jsonResponse(true,'Person folders ready',{folderId:folder.getId(),photoFolderId:photoFolder.getId(),documentsFolderId:documentsFolder.getId()});
    var target=request.mediaType==='photo'?photoFolder:documentsFolder;
    driveStage='upload '+request.mediaType;
    // Stable remote filename makes a retry safe even if upload succeeded but
    // the client lost the response or SQLite metadata update failed.
    var remoteName=hash+'--'+String(request.fileName),matches=target.getFilesByName(remoteName);
    var file=matches.hasNext()?matches.next():target.createFile(Utilities.newBlob(bytes,request.mimeType||'application/octet-stream',remoteName));
    // Files created in the configured private root inherit its access policy.
    // Do not call setSharing here: Workspace/shared-drive policies may reject
    // that mutation even when the script can create files.
    return jsonResponse(true,'File stored',{fileId:file.getId(),url:'https://drive.google.com/file/d/'+encodeURIComponent(file.getId())+'/view?usp=drivesdk',folderId:folder.getId(),fileName:request.fileName,fileHash:hash});
  } catch(error) {
    throw new Error('[DRIVE-CHECK-2 / '+driveStage+'] '+error.message);
  } finally {lock.releaseLock();}
}

// Run from the Apps Script editor. Read-only: never creates or changes files.
function diagnoseReportDriveFolders() {
  var results=['Students','Staff'].map(function(entity) {
    try {
      var folder=personRoot_(entity);
      var name=folder.getName();
      var children=folder.getFolders();
      var hasChildren=children.hasNext();
      return {entity:entity,readable:true,folderId:folder.getId(),folderName:name,hasSubfolders:hasChildren,inTrash:folder.isTrashed()};
    } catch(error) { return {entity:entity,readable:false,error:String(error.message||error)}; }
  });
  console.log(JSON.stringify({diagnostic:'DRIVE-CHECK-2',results:results},null,2));
  return results;
}
