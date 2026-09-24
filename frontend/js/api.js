// Application data uses the configured desktop database. Only report submission contacts Google Sheets.
const DATABASE_REQUEST_TIMEOUT_MS = 45000;

async function getApiUrl() { return (await apiRequest("getReportConfig")).data.endpoint; }
async function setApiUrl(endpoint, apiToken) { return (await apiRequest("saveReportConfig", { endpoint, apiToken })).data.endpoint; }

let activeDatabaseRequests = 0;
let idleResolvers = [];
let loadingFailsafeTimer = null;

function buildLoadingOverlay() {
  const existing = document.getElementById("appSplash");
  if (existing?.classList.contains("database-loading-indicator")) return existing;
  const assetPath = window.location.pathname.includes("/pages/")
    ? "../assets/kumakh-logo.png"
    : "./assets/kumakh-logo.png";
  // Even dialog.show() runs the browser's focusing steps. Background database
  // activity must never move the caret or make an add/edit form inert.
  const overlay = document.createElement("div");
  overlay.id = "appSplash";
  overlay.className = existing ? existing.className : "app-splash";
  overlay.classList.add("database-loading-indicator");
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "Loading database data");
  overlay.innerHTML = `<div class="kcmt-loader"><div class="kcmt-loader-ring"></div><div class="kcmt-loader-logo"><img src="${assetPath}" alt="KCMT logo"></div><div class="kcmt-loader-text">LOADING<span class="kcmt-loader-dots"><i>.</i><i>.</i><i>.</i></span></div></div>`;
  if (existing) {
    if (existing.tagName === "DIALOG" && existing.open) existing.close();
    existing.replaceWith(overlay);
  }
  else document.body.appendChild(overlay);
  return overlay;
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("appSplash");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
}

function beginDatabaseLoading() {
  activeDatabaseRequests += 1;
  const overlay = buildLoadingOverlay();
  overlay.classList.remove("is-hidden");
  window.clearTimeout(loadingFailsafeTimer);
  loadingFailsafeTimer = window.setTimeout(() => {
    activeDatabaseRequests = 0;
    hideLoadingOverlay();
    idleResolvers.splice(0).forEach((resolve) => resolve());
  }, DATABASE_REQUEST_TIMEOUT_MS + 1000);
  let released = false;
  return function releaseDatabaseLoading() {
    if (released) return;
    released = true;
    endDatabaseLoading();
  };
}

function endDatabaseLoading() {
  activeDatabaseRequests = Math.max(0, activeDatabaseRequests - 1);
  if (activeDatabaseRequests) return;
  window.clearTimeout(loadingFailsafeTimer);
  loadingFailsafeTimer = null;
  hideLoadingOverlay();
  idleResolvers.splice(0).forEach((resolve) => resolve());
}

window.kumakhLoading = {
  get pending() {
    return activeDatabaseRequests;
  },
  // Page fragments and their initializers use the same counter as database
  // requests, so the overlay cannot disappear between rendering a page and
  // receiving the data it needs.
  begin: beginDatabaseLoading,
  end: endDatabaseLoading,
  whenIdle(callback) {
    if (!activeDatabaseRequests) callback();
    else idleResolvers.push(callback);
  },
};

async function apiRequest(action, payload, methodOverride, options) {
  action = String(action || "").trim().replace(/[\s_-]+/g, "").toLowerCase();
  if (!window.kumakhApp || typeof window.kumakhApp.apiRequest !== "function") {
    throw new Error("The application database is unavailable. Open the installed desktop application.");
  }
  const showLoading = !options || options.showLoading !== false;
  if (showLoading) beginDatabaseLoading();
  try {
    return await window.kumakhApp.apiRequest(action, payload || {});
  } finally {
    if (showLoading) endDatabaseLoading();
  }
}

function getCourses() {
  return apiRequest("getCourses");
}
function saveCourse(payload) {
  return apiRequest("saveCourse", payload);
}
function updateCourse(payload) {
  return apiRequest("updateCourse", payload);
}
function deleteCourse(payload) {
  return apiRequest("deleteCourse", payload);
}
function getStudents() {
  return apiRequest("getStudents");
}
function getInventory() {
  return apiRequest("getInventory");
}
function getStudentPayments() {
  return apiRequest("getStudentPayments");
}
function saveStudentPayment(payload) {
  return apiRequest("saveStudentPayment", payload);
}
function getStaff() {
  return apiRequest("getStaff");
}
function getPayroll(payload) {
  return apiRequest("getPayroll", payload, "GET");
}
function getPayrollSummary() {
  return apiRequest("getPayrollSummary");
}
function saveStaff(payload) {
  return apiRequest("saveStaff", payload);
}
function updateStaff(payload) {
  return apiRequest("updateStaff", payload);
}
function deleteStaff(payload) {
  return apiRequest("deleteStaff", payload);
}
function savePayroll(payload) {
  return apiRequest("savePayroll", payload);
}
function markPayrollPaid(payload) {
  return apiRequest("markPayrollPaid", payload);
}
function getVendors() {
  return apiRequest("getVendors");
}
function saveVendor(payload) {
  return apiRequest("saveVendor", payload);
}
function deleteVendor(payload) {
  return apiRequest("deleteVendor", payload);
}
function savePurchase(payload) {
  return apiRequest("savePurchase", payload);
}
function uploadPurchaseBill(payload) {
  return apiRequest("uploadPurchaseBill", payload);
}
function getPurchaseBills() {
  return apiRequest("getPurchaseBills");
}
function getVendorPurchaseAccount(payload) {
  return apiRequest("getVendorPurchaseAccount", payload);
}
function saveVendorPayment(payload) {
  return apiRequest("saveVendorPayment", payload);
}
function getVendorLedger() {
  return apiRequest("getVendorLedger");
}
function saveStaffPayment(payload) {
  return apiRequest("saveStaffPayment", payload);
}
function getCafeCustomers() {
  return apiRequest("getCafeCustomers");
}
function authenticateUser(payload) {
  return apiRequest("authenticateUser", payload, undefined, {
    showLoading: false,
  });
}
function getUsersForAdmin(payload) {
  return apiRequest("getUsersAdmin", payload || {});
}
function saveSystemUser(payload) {
  return apiRequest("saveSystemUser", payload);
}
function deleteSystemUser(payload) {
  return apiRequest("deleteSystemUser", payload);
}
function getRolesForAdmin(payload) {
  return apiRequest("getRolesAdmin", payload || {});
}
function getPermissionMatrix(payload) {
  return apiRequest("getPermissionMatrix", payload || {});
}
function saveSystemRole(payload) {
  return apiRequest("saveSystemRole", payload);
}
function deleteSystemRole(payload) {
  return apiRequest("deleteSystemRole", payload);
}
function savePermissionAssignment(payload) {
  return apiRequest("savePermissionAssignment", payload);
}
function getCustomerLedger() {
  return apiRequest("getCustomerLedger");
}
function getCreditSales() {
  return apiRequest("getCreditSales");
}
function getDueReceived() {
  return apiRequest("getDueReceived");
}
function saveDueReceived(payload) {
  return apiRequest("saveDueReceived", payload);
}
function saveCafeCustomer(payload) {
  return apiRequest("saveCafeCustomer", payload);
}
function saveCafeSale(payload) {
  return apiRequest("saveCafeSale", payload);
}
function getCafeTables() {
  return apiRequest("getCafeTables");
}
function getCafeMenu() {
  return apiRequest("getCafeMenu");
}
function getCafeSales() {
  return apiRequest("getCafeSales");
}
function getCafeDailySales() {
  return apiRequest("getCafeDailySales");
}
function getCafeCategories() {
  return apiRequest("getCafeCategories");
}
function saveCafeCategory(payload) {
  return apiRequest("saveCafeCategory", payload);
}
function saveCafeTable(payload) {
  return apiRequest("saveCafeTable", payload);
}
function disableCafeTable(payload) {
  return apiRequest("disableCafeTable", payload);
}
function saveCafeMenu(payload) {
  return apiRequest("saveCafeMenu", payload);
}
function disableCafeMenuItem(payload) {
  return apiRequest("disableCafeMenuItem", payload);
}
function disableCafeCustomer(payload) {
  return apiRequest("disableCafeCustomer", payload);
}
function getCafeTodaySummary() {
  return apiRequest("getCafeTodaySummary");
}
function submitCafeDailyClosingReport(payload) {
  return apiRequest("submitCafeDailyClosingReport", payload);
}
function saveExpense(payload) {
  return apiRequest("saveExpense", payload);
}
function getExpensesPurchases() {
  return apiRequest("getExpensesPurchases");
}
function addStudent(payload) {
  return apiRequest("addStudent", payload);
}
function updateStudent(payload) {
  return apiRequest("updateStudent", payload);
}
function deleteStudent(payload) {
  return apiRequest("deleteStudent", payload);
}
function updateStudentStatus(payload) {
  return apiRequest("updateStudentStatus", payload);
}
function updateStaffStatus(payload) {
  return apiRequest("updateStaffStatus", payload);
}
function getReportConfig() { return apiRequest("getReportConfig"); }
function getReportPreview(payload) { return apiRequest("getReportPreview", payload); }
function submitReport(payload) { return apiRequest("submitReport", payload, undefined, { showLoading: false }); }
function retryReport(payload) { return apiRequest("retryReport", payload, undefined, { showLoading: false }); }
function getReportSubmissions(payload) { return apiRequest("getReportSubmissions", payload || {}); }

window.kumakhApi = {
  authenticateReports: (payload) => apiRequest("authenticateReports", payload, undefined, { showLoading: false }),
  getApiUrl,
  setApiUrl,
  getCourses,
  saveCourse,
  updateCourse,
  deleteCourse,
  getStudents,
  getInventory,
  getStudentPayments,
  saveStudentPayment,
  getStaff,
  getPayroll,
  getPayrollSummary,
  saveStaff,
  updateStaff,
  deleteStaff,
  savePayroll,
  markPayrollPaid,
  getVendors,
  saveVendor,
  deleteVendor,
  savePurchase,
  uploadPurchaseBill,
  getPurchaseBills,
  getVendorPurchaseAccount,
  saveVendorPayment,
  getVendorLedger,
  saveStaffPayment,
  getCafeCustomers,
  authenticateUser,
  getUsersForAdmin,
  saveSystemUser,
  deleteSystemUser,
  getRolesForAdmin,
  getPermissionMatrix,
  saveSystemRole,
  deleteSystemRole,
  savePermissionAssignment,
  getCustomerLedger,
  getCreditSales,
  getDueReceived,
  saveDueReceived,
  saveCafeCustomer,
  saveCafeSale,
  getCafeTables,
  getCafeMenu,
  getCafeSales,
  getCafeDailySales,
  getCafeCategories,
  saveCafeCategory,
  saveCafeTable,
  disableCafeTable,
  saveCafeMenu,
  disableCafeMenuItem,
  disableCafeCustomer,
  getCafeTodaySummary,
  submitCafeDailyClosingReport,
  saveExpense,
  getExpensesPurchases,
  addStudent,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  updateStaffStatus,
  getReportConfig,
  getReportPreview,
  submitReport,
  retryReport,
  getReportSubmissions,
};
