// ============================================================
// KUMAKH COLLEGE MANAGEMENT SYSTEM
// FRONTEND APPLICATION JAVASCRIPT
// ============================================================

// ============================================================
// PAGE MAP
// ============================================================

const PAGE_MAP = {
  dashboard: "./pages/dashboard.html",
  cafe: "./pages/cafe.html",
  course: "./pages/course.html",
  students: "./pages/students.html",
  studentDetails: "./pages/student-details.html",
  payments: "./pages/payments.html",
  staff: "./pages/staff.html",
  staffDetails: "./pages/staff-details.html",
  salary: "./pages/salary.html",
  "payment-out": "./pages/payment-out.html",
  purchases: "./pages/purchases.html",
  expenses: "./pages/expenses.html",
  vendors: "./pages/vendors.html",
  reports: "./pages/reports.html",
  settings: "./pages/settings.html",
};
const PAGE_PERMISSIONS = {
  dashboard: "dashboard.view",
  cafe: "cafe.view",
  course: "courses.view",
  students: "students.view",
  studentDetails: "students.view",
  payments: "payments.view",
  staff: "staff.view",
  staffDetails: "staff.view",
  salary: "payroll.view",
  "payment-out": "paymentout.view",
  purchases: "purchases.view",
  expenses: "expenses.view",
  vendors: "vendors.view",
  reports: "reports.view",
  settings: "settings.view",
};

// ============================================================
// STUDENT UPLOAD LIMIT
// ============================================================

const MAX_STUDENT_UPLOAD_BYTES = 20 * 1024 * 1024;

// ============================================================
// GENERAL HELPERS
// ============================================================

const formatNepaliCurrency = (value = 0) => {
  const formatted = new Intl.NumberFormat("ne-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

  return `NPR ${formatted}`;
};

const formatNepaliDate = (date = new Date()) => {
  return new Intl.DateTimeFormat("ne-NP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

const getSession = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem("kumakhSession") || "null");
  } catch (error) {
    console.error("Session parsing error:", error);
    return null;
  }
};

function isAdministrator(session = getSession()) {
  if (!session) return false;
  return (
    ["ADMIN", "ADMINISTRATOR"].includes(String(session.role || "").toUpperCase()) ||
    String(session.userId || "") === "USR-0001" ||
    String(session.username || "").trim().toLowerCase() === "admin"
  );
}

function hasPermission(permission) {
  const session = getSession();
  if (!session) return false;
  if (isAdministrator(session)) return true;
  return Array.isArray(session.permissions) && session.permissions.includes(permission);
}

window.kumakhAccess = { hasPermission, isAdministrator };

function applyRoleNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    const permission = PAGE_PERMISSIONS[button.dataset.page];
    button.hidden = Boolean(permission) && !hasPermission(permission);
  });
}

function applyPageActionPermissions(container, pageName) {
  container.querySelectorAll("[data-permission]").forEach((element) => {
    if (!hasPermission(element.dataset.permission)) element.hidden = true;
  });
  const actionSelectors = {
    students: [["students.add", "#addStudentButton"], ["students.modify", "[data-student-index]"], ["students.delete", "[data-delete-student-index]"]],
    staff: [["staff.add", "#addStaffButton"], ["staff.modify", '[data-action="edit"]'], ["staff.delete", '[data-action="delete"]']],
    course: [["courses.add", "#addCourseButton"], ["courses.modify", '[data-course-action="edit"]'], ["courses.delete", '[data-course-action="delete"]']],
    vendors: [["vendors.add", "#openAddVendorButton"], ["vendors.add", "#saveVendorButton"], ["vendors.delete", '[data-vendor-action="delete"]']],
    purchases: [["purchases.add", "#openPurchaseForm"], ["purchases.modify", '#purchaseForm button[type="submit"]']],
    expenses: [["expenses.add", '.expenses-actions button[type="submit"]']],
    salary: [["payroll.add", "#salarySaveButton"], ["payroll.modify", '[data-payroll-action="modify"]'], ["payroll.delete", '[data-payroll-action="delete"]']],
    "payment-out": [["paymentout.add", "#savePaymentOutButton"]],
  };
  (actionSelectors[pageName] || []).forEach(([permission, selector]) => {
    if (!hasPermission(permission)) {
      container.querySelectorAll(selector).forEach((element) => {
        element.hidden = true;
      });
    }
  });
}

// ============================================================
// LOCAL APPEARANCE PREFERENCES
// ============================================================

const APPEARANCE_STORAGE_KEY = "kumakhAppearancePreferences";
const DEFAULT_APPEARANCE = {
  fontFamily: "system",
  fontSize: "medium",
  displaySize: "100",
};

function getAppearancePreferences() {
  try {
    const preferences = {
      ...DEFAULT_APPEARANCE,
      ...JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || "{}"),
    };
    const legacyDisplaySizes = {
      compact: "75",
      standard: "100",
      comfortable: "100",
    };
    preferences.displaySize =
      legacyDisplaySizes[preferences.displaySize] ||
      String(preferences.displaySize || "100");
    return preferences;
  } catch (error) {
    return { ...DEFAULT_APPEARANCE };
  }
}

function applyAppearancePreferences(preferences = getAppearancePreferences()) {
  const fontFamilies = {
    system:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    segoe: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    inter: "Inter, ui-sans-serif, system-ui, sans-serif",
    serif: 'Georgia, "Times New Roman", serif',
  };
  const fontSizes = { small: "14px", medium: "16px", large: "18px" };
  const displayScales = { 25: ".25", 50: ".5", 75: ".75", 100: "1" };
  const root = document.documentElement;
  root.style.setProperty(
    "--app-font-family",
    fontFamilies[preferences.fontFamily] || fontFamilies.system,
  );
  root.style.fontSize = fontSizes[preferences.fontSize] || fontSizes.medium;
  // CSS zoom keeps every responsive grid and table proportional at the selected
  // percentage instead of merely changing text size.
  const displaySize = String(preferences.displaySize || "100");
  document.body.dataset.displaySize = displaySize;
  document.body.style.zoom = displayScales[displaySize] || "1";
  return preferences;
}

window.applyAppearancePreferences = applyAppearancePreferences;

async function initializePaymentsPage() {
  const form = document.getElementById("studentPaymentForm");
  const input = document.getElementById("paymentStudent");
  if (!form || !input) return;
  const message = document.getElementById("paymentMessage");
  const statusDialog = document.getElementById("paymentStatusDialog");
  const statusTitle = document.getElementById("paymentStatusTitle");
  const statusMessage = document.getElementById("paymentStatusMessage");
  const statusProgress = document.getElementById("paymentStatusProgress");
  const statusDetails = document.getElementById("paymentStatusDetails");
  const statusClose = document.getElementById("paymentStatusClose");
  const showSaving = (label) => {
    message.textContent = `Saving ${label}. Please wait for database confirmation...`;
    message.className = "alert alert-info";
    message.classList.remove("d-none");
    statusTitle.textContent = "Saving payment";
    statusMessage.textContent = `Saving ${label} to the database. Please wait...`;
    statusProgress.className = "progress-bar progress-bar-striped progress-bar-animated";
    statusProgress.style.width = "35%";
    statusProgress.textContent = "Saving";
    statusDetails.textContent = "The payment is confirmed only after the database responds.";
    statusClose.classList.add("d-none");
    statusDialog.showModal();
  };
  const showPaymentResult = (success, label, result) => {
    message.textContent = success
      ? `${label} saved successfully. Record ID: ${result?.data?.paymentId || result?.data?.receiptId || result?.data?.id || "confirmed"}.`
      : `${label} was not saved: ${result?.message || "Database did not confirm the payment."}`;
    message.className = `alert alert-${success ? "success" : "danger"}`;
    message.classList.remove("d-none");
    statusTitle.textContent = success ? "Payment recorded successfully" : "Payment was not recorded";
    statusMessage.textContent = success ? `${label} was saved in the database.` : (result?.message || `Unable to save ${label}.`);
    statusProgress.className = `progress-bar ${success ? "bg-success" : "bg-danger"}`;
    statusProgress.style.width = "100%";
    statusProgress.textContent = success ? "Saved" : "Failed";
    statusDetails.textContent = success ? `Database record: ${result?.data?.paymentId || result?.data?.receiptId || result?.data?.id || "confirmed"}` : "No successful database confirmation was received.";
    statusClose.classList.remove("d-none");
  };
  statusClose.onclick = () => statusDialog.close();
  const normalizePaymentKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const paymentField = (payment, aliases) => {
    const keys = Object.keys(payment || {});
    const key = aliases.map((alias) => keys.find((candidate) => normalizePaymentKey(candidate) === alias)).find((key) => key !== undefined);
    return key === undefined ? "" : payment[key];
  };
  const studentIdentifier = (student) =>
    paymentField(student, [
      "studentid",
      "id",
      "registrationnumber",
      "registrationno",
    ]);
  const paymentIdentifier = (payment) =>
    paymentField(payment, [
      "studentid",
      "registrationnumber",
      "registrationno",
    ]);
  const registrationNumber = (student) => paymentField(student, ["registrationnumber", "registrationno"]) || studentIdentifier(student);
  const studentName = (student) =>
    String(paymentField(student, ["fullname", "studentname", "name"]) || "").trim();
  const studentCourse = (student) =>
    String(paymentField(student, ["course", "coursename", "course_name"]) || "").trim();
  const studentFee = (student) => {
    const totalFee = Number(paymentField(student, ["totalfee"]) || 0);
    if (totalFee > 0) return totalFee;
    return (
      Number(paymentField(student, ["registrationfee", "registration_fee"]) || 0) +
      Number(paymentField(student, ["trainingcoursefee", "trainingcourse_fee"]) || 0) -
      Number(paymentField(student, ["discount"]) || 0)
    );
  };
  const paymentAmount = (payment) => {
    const rawAmount = paymentField(payment, [
      "amount",
      "paidamount",
      "paymentamount",
    ]);
    return Number(String(rawAmount || 0).replace(/,/g, "")) || 0;
  };
  const normalizedIdentifier = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  initializePaymentTypeSelector();
  const [studentsResponse, paymentsResponse] = await Promise.all([
    getStudents(),
    getStudentPayments(),
  ]);
  const students =
    studentsResponse &&
    studentsResponse.success &&
    Array.isArray(studentsResponse.data)
      ? studentsResponse.data
      : [];
  const payments =
    paymentsResponse &&
    paymentsResponse.success &&
    Array.isArray(paymentsResponse.data)
      ? paymentsResponse.data
      : [];
  const options = document.getElementById("paymentStudentOptions");
  options.innerHTML = students
    .map((student) => {
      const id = studentIdentifier(student);
      const name = studentName(student);
      return `<option value="${escapeStudentHtml(name)}" label="Registration No: ${escapeStudentHtml(String(registrationNumber(student)))}"></option>`;
    })
    .join("");
  const findStudent = () =>
    students.find((student) => {
      const id = normalizedIdentifier(studentIdentifier(student));
      const name = normalizedIdentifier(studentName(student));
      const composite = normalizedIdentifier(`${studentName(student)} (${studentIdentifier(student)})`);
      return (
        normalizedIdentifier(registrationNumber(student)) === normalizedIdentifier(input.value) ||
        id === input.value.trim().toLowerCase() ||
        name === normalizedIdentifier(input.value) ||
        composite === normalizedIdentifier(input.value)
      );
    });
  const refreshDetails = () => {
    const student = findStudent();
    document.getElementById("paymentCourse").value = student ? studentCourse(student) : "";
    document.getElementById("paymentCourseFee").value = student ? Math.max(0, studentFee(student)).toFixed(2) : "";
    const selectedDetails = document.getElementById("selectedStudentDetails");
    if (selectedDetails) {
      selectedDetails.textContent = student
        ? `${studentName(student)} | Registration No: ${registrationNumber(student)}`
        : "Enter or select a student name.";
      selectedDetails.className = student ? "form-text text-success" : "form-text text-muted";
    }
    const id = student ? studentIdentifier(student) : "";
    const paid = payments
      .filter(
        (payment) =>
          normalizedIdentifier(paymentIdentifier(payment)) ===
          normalizedIdentifier(id),
      )
      .reduce((sum, payment) => sum + paymentAmount(payment), 0);
    document.getElementById("paymentTotalPaid").value = paid.toFixed(2);
  };
  input.oninput = refreshDetails;
  refreshDetails();
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("paymentDate").value =
    document.getElementById("paymentDate").value || today;
  const body = document.getElementById("studentPaymentsBody");
  const summaries = students.map((student) => {
    const id = String(studentIdentifier(student) || "").trim();
    const paid = payments
      .filter(
        (payment) =>
          normalizedIdentifier(paymentIdentifier(payment)) ===
          normalizedIdentifier(id),
      )
      .reduce((sum, payment) => sum + paymentAmount(payment), 0);
    const totalFee =
      Number(student["Total Fee"] || 0) ||
      Number(student["Registration Fee"] || 0) +
        Number(student["Training/Course Fee"] || 0) -
        Number(student.Discount || 0);
    return `<tr><td>${escapeStudentHtml(studentName(student))}</td><td>${escapeStudentHtml(id)}</td><td>${escapeStudentHtml(studentCourse(student))}</td><td>${formatNepaliCurrency(totalFee)}</td><td>${formatNepaliCurrency(paid)}</td><td>${formatNepaliCurrency(Math.max(totalFee - paid, 0))}</td></tr>`;
  });
  body.innerHTML =
    summaries.join("") ||
    '<tr><td colspan="6" class="text-center text-muted">No students found.</td></tr>';
  document.getElementById("studentPaymentTotal").textContent =
    formatNepaliCurrency(
      payments.reduce((sum, payment) => sum + paymentAmount(payment), 0),
    );
  {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const student = findStudent();
      if (!student) {
        message.textContent =
          "Select a valid student name or registration number.";
        message.className = "alert alert-danger";
        return;
      }
      const totalFee = Number(
        document.getElementById("paymentCourseFee").value || 0,
      );
      const paid = Number(
        document.getElementById("paymentTotalPaid").value || 0,
      );
      const amount = Number(
        document.getElementById("paymentAmount").value || 0,
      );
      showSaving("student fee");
      let result;
      try {
        result = await saveStudentPayment({
          studentId: studentIdentifier(student),
          studentName: studentName(student),
          paymentType: document.getElementById("paymentType").value,
          amount,
          dueAmount: Math.max(totalFee - paid - amount, 0),
          paymentDate: document.getElementById("paymentDate").value,
          paymentMode: document.getElementById("paymentMode").value,
          remarks: document.getElementById("paymentRemarks").value,
        });
      } catch (error) {
        result = { success: false, message: error.message };
      }
      if (!result || !result.success) {
        showPaymentResult(false, "student fee", result);
        message.textContent =
          (result && result.message) || "Unable to save payment.";
        message.className = "alert alert-danger";
        return;
      }
      showPaymentResult(true, "student fee", result);
      window.KumakhVouchers?.studentReceipt({
        paymentId: paymentField(result.data || {}, ["paymentid", "id"]),
        studentId: studentIdentifier(student),
        studentName: studentName(student),
        course: document.getElementById("paymentCourse").value,
        paymentType: document.getElementById("paymentType").value,
        amount,
        totalFee: Number(result.data.course_fee),
        alreadyPaid: Number(result.data.total_paid) - Number(result.data.amount),
        totalPaid: Number(result.data.total_paid),
        dueAmount: Math.max(Number(result.data.course_fee) - Number(result.data.total_paid), 0),
        paymentDate: document.getElementById("paymentDate").value,
        paymentMode: document.getElementById("paymentMode").value,
        remarks: document.getElementById("paymentRemarks").value,
      });
      message.textContent = "Student fee saved successfully.";
      message.className = "alert alert-success";
      form.reset();
      document.getElementById("paymentDate").value = today;
      await initializePaymentsPage();
    };
  }

  try {
    await initializeCustomerDueSection(today, message, { showSaving, showPaymentResult });
  } catch (error) {
    console.error("Customer ledger could not be loaded:", error);
    message.textContent =
      "Customer account data could not be loaded. Please refresh and try again.";
    message.className = "alert alert-warning";
  }
}

async function initializeCustomerDueSection(today, message, { showSaving, showPaymentResult }) {
  const form = document.getElementById("customerDueForm");
  const customerInput = document.getElementById("dueCustomer");
  const submitButton = document.getElementById("receiveCustomerDueButton");
  if (!form || !customerInput) return;

  let customers = [];
  let ledger = [];
  let dueReceived = [];
  let creditSales = [];
  let savingCustomerDue = false;
  const normalizedKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const recordValue = (record, ...names) => {
    if (!record || typeof record !== "object") return "";
    const wanted = names.map(normalizedKey);
    const matchingKey = Object.keys(record).find((key) =>
      wanted.includes(normalizedKey(key)),
    );
    return matchingKey === undefined ? "" : record[matchingKey];
  };
  const moneyValue = (value) => {
    const normalized = String(value ?? "")
      .replace(/[^0-9.-]/g, "")
      .trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const customerName = (customer) =>
    String(
      customer["Customer Name"] || customer.customerName || customer.name || "",
    ).trim();
  const customerId = (customer) =>
    String(
      customer["Customer ID"] || customer.customerId || customer.id || "",
    ).trim();
  const sameCustomer = (left, right) =>
    String(left || "").trim().toLowerCase() ===
    String(right || "").trim().toLowerCase();
  const ledgerValue = (record, header, fallback) =>
    moneyValue(recordValue(record, header, fallback));
  const setTextIfPresent = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  const selectedCustomer = () =>
    customers.find(
      (customer) => customerId(customer) === customerInput.value,
    ) || null;
  const accountTotals = (customer, ledgerRecord) => {
    const selectedId = customerId(customer);
    const selectedName = customerName(customer);
    const matchesCustomer = (record) =>
      sameCustomer(
        recordValue(record, "Customer ID", "customerId"),
        selectedId,
      ) ||
      (selectedName &&
        sameCustomer(
          recordValue(record, "Customer Name", "customerName"),
          selectedName,
        ));
    const directCredit = creditSales
      .filter(matchesCustomer)
      .reduce(
        (total, sale) =>
          total +
          moneyValue(
            recordValue(
              sale,
              "Total Bill",
              "totalBill",
              "Credit Amount",
              "creditAmount",
            ),
          ),
        0,
      );
    const saleReceived = creditSales
      .filter(matchesCustomer)
      .reduce(
        (total, sale) =>
          total + moneyValue(recordValue(sale, "Paid Amount", "paidAmount")),
        0,
      );
    const receiptReceived = dueReceived
      .filter(matchesCustomer)
      .reduce(
        (total, receipt) =>
          total +
          moneyValue(recordValue(receipt, "Received Amount", "receivedAmount")),
        0,
      );
    const ledgerCredit = ledgerValue(
      ledgerRecord,
      "Total Credit Amount",
      "totalCredit",
    );
    const ledgerReceived = ledgerValue(
      ledgerRecord,
      "Total Received Amount",
      "totalReceived",
    );
    const ledgerDue = ledgerValue(
      ledgerRecord,
      "Total Due Amount",
      "totalDue",
    );
    const calculatedDue = Math.max(0, directCredit - saleReceived - receiptReceived);
    const outstanding = moneyValue(
      recordValue(customer, "Outstanding Amount", "outstandingAmount", "Due Amount"),
    );
    const hasCalculatedActivity = directCredit > 0 || saleReceived > 0 || receiptReceived > 0;
    // CustomerLedger is refreshed from CafeSales and DueReceived in MySQL and
    // is the authoritative account summary for the payment screen.
    if (
      ledgerRecord &&
      (ledgerCredit > 0 || ledgerReceived > 0 || ledgerDue > 0)
    ) {
      return {
        credit: ledgerCredit,
        received: ledgerReceived,
        due: Math.max(0, ledgerDue),
      };
    }
    if (hasCalculatedActivity) {
      return {
        credit: directCredit,
        received: saleReceived + receiptReceived,
        due: calculatedDue,
      };
    }
    if (ledgerRecord) {
      return {
        credit: ledgerCredit,
        received: ledgerReceived,
        due: Math.max(0, ledgerDue),
      };
    }
    /* Older customer records may only have their balance stored on the
       customer sheet. Show that balance instead of incorrectly showing zero. */
    return { credit: outstanding, received: 0, due: outstanding };
  };
  const refreshCustomerDue = () => {
    const customer = selectedCustomer();
    const ledgerRecord = ledger.find((item) =>
      sameCustomer(
        recordValue(item, "Customer ID", "customerId"),
        customer ? customerId(customer) : customerInput.value,
      ) ||
      (customer && sameCustomer(
        recordValue(item, "Customer Name", "customerName"),
        customerName(customer),
      )),
    );
    const received = Number(document.getElementById("dueAmount").value || 0);
    document.getElementById("dueCustomerDisplay").textContent = customer
      ? customerName(customer)
      : "Select a customer to view the balance";
    document.getElementById("dueCustomerDetails").textContent = customer
      ? [
          customer["Phone Number"] || customer.phoneNumber || customer.phone,
          customer.Email || customer.email,
          customer["Credit Limit"] || customer.creditLimit
            ? `Credit limit: ${formatNepaliCurrency(customer["Credit Limit"] || customer.creditLimit)}`
            : "",
          customer.Status || customer.status,
        ]
          .filter(Boolean)
          .join(" · ") || "Customer details loaded from the database."
      : "Choose a customer to load account details.";
    const totals = customer
      ? accountTotals(customer, ledgerRecord)
      : { credit: 0, received: 0, due: 0 };
    document.getElementById("customerTotalCredit").textContent =
      formatNepaliCurrency(totals.credit);
    document.getElementById("customerTotalReceived").textContent =
      formatNepaliCurrency(totals.received);
    setTextIfPresent("customerReceived", formatNepaliCurrency(received));
    document.getElementById("customerRemainingDue").textContent =
      formatNepaliCurrency(Math.max(0, totals.due - received));
  };
  if (form.dataset.initialized !== "true") {
    customerInput.addEventListener("change", refreshCustomerDue);
    document
      .getElementById("dueAmount")
      .addEventListener("input", refreshCustomerDue);
    const submitCustomerDue = async (event) => {
      event.preventDefault();
      if (savingCustomerDue) return;
      const customerRecord = selectedCustomer();
      const received = Number(document.getElementById("dueAmount").value || 0);
      if (!customerRecord || !Number.isFinite(received) || received <= 0) {
        message.textContent =
          "Select a customer from the database and enter a valid received amount.";
        message.className = "alert alert-danger";
        return;
      }
      const selectedTotals = accountTotals(customerRecord, ledger.find((item) =>
        sameCustomer(recordValue(item, "Customer ID", "customerId"), customerId(customerRecord)) ||
        sameCustomer(recordValue(item, "Customer Name", "customerName"), customerName(customerRecord)),
      ));
      if (received > selectedTotals.due) {
        message.textContent = `Received amount cannot exceed the remaining due of ${formatNepaliCurrency(selectedTotals.due)}.`;
        message.className = "alert alert-danger";
        return;
      }
      savingCustomerDue = true;
      if (submitButton) submitButton.disabled = true;
      showSaving("customer due payment");
      let result;
      try {
        result = await saveDueReceived({
          customerId: customerId(customerRecord),
          receiptDate: document.getElementById("duePaymentDate").value || today,
          receivedAmount: received,
          paymentMode: document.getElementById("duePaymentMode").value,
          remarks: document.getElementById("dueRemarks").value.trim(),
        });
      } catch (error) {
        result = { success: false, message: error.message };
      }
      if (!result || !result.success) {
        showPaymentResult(false, "customer due payment", result);
        message.textContent =
          (result && result.message) || "Unable to save due receipt.";
        message.className = "alert alert-danger";
        savingCustomerDue = false;
        if (submitButton) submitButton.disabled = false;
        return;
      }
      showPaymentResult(true, "customer due payment", result);
      const receiptId =
        result.data?.receiptId ||
        result.data?.paymentId ||
        result.data?.id ||
        "confirmed";
      const ledgerTotals = result.data?.ledger;
      message.textContent = ledgerTotals
        ? `Payment saved successfully. Receipt ID: ${receiptId}. Paid: ${formatNepaliCurrency(ledgerTotals.totalReceived)}. Remaining due: ${formatNepaliCurrency(ledgerTotals.totalDue)}.`
        : `Payment saved successfully. Receipt ID: ${receiptId}. Customer ledger updated.`;
      message.className = "alert alert-success";
      message.classList.remove("d-none");
      form.reset();
      document.getElementById("duePaymentDate").value = today;
      try {
        const [ledgerResponse, receiptResponse, creditSalesResponse] = await Promise.all([
          getCustomerLedger(),
          getDueReceived(),
          getCreditSales(),
        ]);
        if (!ledgerResponse?.success || !receiptResponse?.success || !creditSalesResponse?.success) {
          throw new Error("The payment was saved, but the updated customer account could not be loaded.");
        }
        ledger = Array.isArray(ledgerResponse.data) ? ledgerResponse.data : [];
        dueReceived = Array.isArray(receiptResponse.data) ? receiptResponse.data : [];
        creditSales = Array.isArray(creditSalesResponse.data) ? creditSalesResponse.data : [];
        renderCustomerDueRecords(dueReceived);
        refreshCustomerDue();
      } catch (refreshError) {
        console.error("Customer payment saved but account refresh failed:", refreshError);
        message.textContent = `Payment saved successfully. Receipt ID: ${receiptId}. Refresh the page to view the updated account.`;
        message.className = "alert alert-warning";
      } finally {
        savingCustomerDue = false;
        if (submitButton) submitButton.disabled = false;
      }
    };
    form.addEventListener("submit", submitCustomerDue);
    form.dataset.initialized = "true";
  }
  const [customerResponse, ledgerResponse, receiptResponse, creditSalesResponse] =
    await Promise.all([
      getCafeCustomers().catch((error) => {
        console.warn("Customers could not be loaded:", error);
        return { success: false, data: [] };
      }),
      getCustomerLedger().catch((error) => {
        // Older deployed API versions may not expose the derived ledger
        // endpoint. Account totals are recalculated from sales and receipts
        // below, so a missing ledger must not block the payment screen.
        console.warn("Customer ledger endpoint unavailable; calculating totals from account records.", error);
        return { success: false, data: [] };
      }),
      getDueReceived().catch((error) => {
        console.warn("Due receipts could not be loaded:", error);
        return { success: false, data: [] };
      }),
      getCreditSales().catch((error) => {
        console.warn("Credit sales could not be loaded:", error);
        return { success: false, data: [] };
      }),
    ]);
  customers =
    customerResponse &&
    customerResponse.success &&
    Array.isArray(customerResponse.data)
      ? customerResponse.data.filter(
          (customer) =>
            String(
              customer.Status || customer.status || "Active",
            ).toLowerCase() === "active",
        )
      : [];
  ledger =
    ledgerResponse &&
    ledgerResponse.success &&
    Array.isArray(ledgerResponse.data)
      ? ledgerResponse.data
      : [];
  dueReceived =
    receiptResponse &&
    receiptResponse.success &&
    Array.isArray(receiptResponse.data)
      ? receiptResponse.data
      : [];
  creditSales =
    creditSalesResponse &&
    creditSalesResponse.success &&
    Array.isArray(creditSalesResponse.data)
      ? creditSalesResponse.data
      : [];
  customerInput.innerHTML =
    '<option value="">Select customer...</option>' +
    customers
      .map(
        (customer) =>
          `<option value="${escapeStudentHtml(customerId(customer))}">${escapeStudentHtml(customerName(customer))}${customer["Phone Number"] || customer.phoneNumber || customer.phone ? ` - ${escapeStudentHtml(customer["Phone Number"] || customer.phoneNumber || customer.phone)}` : ""}</option>`,
      )
      .join("");
  document.getElementById("duePaymentDate").value =
    document.getElementById("duePaymentDate").value || today;
  renderCustomerDueRecords(dueReceived);
  refreshCustomerDue();
}

function initializePaymentTypeSelector() {
  const studentSelector = document.getElementById("studentFeePayment");
  const customerSelector = document.getElementById("customerDuePayment");
  const studentSection = document.getElementById("studentFeeSection");
  const customerSection = document.getElementById("customerDueSection");
  if (
    !studentSelector ||
    !customerSelector ||
    !studentSection ||
    !customerSection
  )
    return;

  const toggle = () => {
    studentSection.classList.toggle("active", studentSelector.checked);
    customerSection.classList.toggle("active", customerSelector.checked);
  };

  if (studentSelector.dataset.initialized !== "true") {
    studentSelector.addEventListener("change", toggle);
    customerSelector.addEventListener("change", toggle);
    studentSelector.dataset.initialized = "true";
  }
  toggle();
}

function renderCustomerDueRecords(records = []) {
  const body = document.getElementById("customerDueBody");
  if (!body) return;
  body.innerHTML = records.length
    ? records
        .map(
          (record) =>
            `<tr><td>${escapeStudentHtml(record["Receipt Date"] || "")}</td><td>${escapeStudentHtml(record["Customer Name"] || "")}</td><td>${formatNepaliCurrency(record["Previous Due Amount"])}</td><td>${formatNepaliCurrency(record["Received Amount"])}</td><td>${formatNepaliCurrency(record["Remaining Due Amount"])}</td><td>${escapeStudentHtml(record["Payment Mode"] || "")}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6" class="text-center text-muted">No customer due collections yet.</td></tr>';
}

// ============================================================
// SESSION STATE
// ============================================================

function applySessionState() {
  const session = getSession();

  const userDisplay = document.getElementById("userDisplayName");

  const userRoleBadge = document.getElementById("userRoleBadge");

  const currentDateDisplay = document.getElementById("currentDateDisplay");

  if (!session || !session.isAuthenticated || !session.sessionToken) {
    window.location.href = "login.html";
    return false;
  }

  if (userDisplay) {
    userDisplay.textContent = session.fullName || session.username || "User";
  }

  if (userRoleBadge) {
    userRoleBadge.textContent = session.role === "ADMIN" ? "Admin" : "Cashier";
  }

  if (currentDateDisplay) {
    currentDateDisplay.textContent = formatNepaliDate();
  }

  return true;
}

// ============================================================
// PAGE LOADING
// ============================================================

let pageLoadSequence = 0;
let reportPageAuthenticationPromise = null;

async function requireReportPageAuthentication() {
  let existingSession = null;
  try {
    existingSession = JSON.parse(window.sessionStorage.getItem("kumakhReportSession") || "null");
  } catch (error) {
    window.sessionStorage.removeItem("kumakhReportSession");
  }
  if (existingSession?.sessionToken && existingSession.endpoint) return true;
  if (reportPageAuthenticationPromise) return reportPageAuthenticationPromise;

  reportPageAuthenticationPromise = new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "report-page-auth-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="report-page-auth-card">
        <div class="report-page-auth-icon"><i class="bi bi-shield-lock-fill"></i></div>
        <h2>Reporting account sign-in</h2>
        <p>Enter your username and password to open the report submission page.</p>
        <label>Username<input name="username" autocomplete="username" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <div class="report-page-auth-error" role="alert"></div>
        <div class="report-page-auth-actions"><button type="button" class="btn btn-outline-secondary" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Sign in</button></div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector("form");
    const errorMessage = dialog.querySelector(".report-page-auth-error");
    const finish = (authenticated) => {
      dialog.close();
      dialog.remove();
      reportPageAuthenticationPromise = null;
      resolve(authenticated);
    };
    dialog.querySelector("[data-cancel]").onclick = () => finish(false);
    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      errorMessage.textContent = "";
      try {
        const response = await window.kumakhApi.authenticateUser({
          username: form.username.value.trim(),
          password: form.password.value,
        });
        if (!response.success || !response.data?.sessionToken) {
          throw new Error(response.message || "Invalid username or password.");
        }
        if (!Array.isArray(response.data.permissions) || !response.data.permissions.includes("reports.view")) {
          throw new Error("This account does not have permission to open reports.");
        }
        window.kumakhReportCredentials = {
          username: form.username.value.trim(),
          password: form.password.value,
        };
        finish(true);
      } catch (error) {
        errorMessage.textContent = error.message || "Report sign-in failed.";
        button.disabled = false;
        form.password.value = "";
        form.password.focus();
      }
    };
    dialog.addEventListener("cancel", () => finish(false), { once: true });
    dialog.showModal();
    form.username.focus();
  });
  return reportPageAuthenticationPromise;
}

async function loadPage(pageName) {
  if (pageName === "reports" && !(await requireReportPageAuthentication())) return;
  const loadSequence = ++pageLoadSequence;
  const requiredPermission = PAGE_PERMISSIONS[pageName];
  if (requiredPermission && !hasPermission(requiredPermission)) {
    pageName = "dashboard";
  }
  const pagePath = PAGE_MAP[pageName] || PAGE_MAP.dashboard;

  const container = document.getElementById("pageContent");

  if (!container) {
    console.error("pageContent container not found.");
    return;
  }

  container.classList.add("is-loading");
  container.setAttribute("aria-busy", "true");
  // Keep the shared overlay active for the complete page lifecycle. Individual
  // API calls are tracked too, so nested requests keep it visible until all
  // page data has settled.
  const releasePageLoading = window.kumakhLoading?.begin?.();

  try {
    const pageFileName = pagePath.split("/").pop();
    let html;

    if (window.kumakhApp && typeof window.kumakhApp.readPage === "function") {
      html = await window.kumakhApp.readPage(pageFileName);
    } else {
      const response = await fetch(pagePath, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Failed to load page: ${response.status}`);
      }
      html = await response.text();
    }

    if (loadSequence !== pageLoadSequence) return;
    // Page fragments render inside index.html, so normalize bundled asset links.
    html = html.replaceAll('../assets/vendor/', './assets/vendor/');
    container.innerHTML = html;
    container.setAttribute("tabindex", "-1");

    // Scripts inside HTML fragments are inert when assigned through innerHTML.
    // Replacing each local script node makes page-specific initializers available
    // before the matching initialize*Page function is called below.
    container.querySelectorAll("script").forEach((inertScript) => {
      const executableScript = document.createElement("script");
      if (inertScript.src) {
        executableScript.src = inertScript.src;
      } else {
        executableScript.textContent = inertScript.textContent;
      }
      inertScript.replaceWith(executableScript);
    });

    requestAnimationFrame(() => {
      container.classList.remove("is-loading");
    });

    // --------------------------------------------------------
    // ACTIVE NAVIGATION
    // --------------------------------------------------------

    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.page === pageName);
      if (button.dataset.page === pageName) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const activeNavigation = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    const workspaceTitle = document.getElementById("workspaceTitle");
    if (workspaceTitle) workspaceTitle.textContent = activeNavigation?.textContent.trim() || (pageName === "studentDetails" ? "Student details" : pageName === "staffDetails" ? "Staff details" : "College Operations");

    // --------------------------------------------------------
    // FORMAT CURRENCY VALUES
    // --------------------------------------------------------

    container.querySelectorAll(".currency-value").forEach((element) => {
      const raw = element.dataset.value || element.textContent || "0";

      const numeric = Number(String(raw).replace(/[^0-9.-]/g, "")) || 0;

      element.textContent = formatNepaliCurrency(numeric);
    });

    if (pageName === "studentDetails") {
      if (!window.currentStudentDetails) {
        const selectedId = window.sessionStorage.getItem(
          "kumakhSelectedStudentId",
        );
        if (selectedId) {
          const response = await getStudents();
          const records =
            response && response.success && Array.isArray(response.data)
              ? response.data
              : [];
          window.currentStudentDetails =
            records.find((record) =>
              [
                studentField(record, "Student ID"),
                studentField(record, "Registration Number"),
              ].some((value) => String(value || "").trim() === selectedId),
            ) || null;
        }
      }

      const detailsContent = container.querySelector(
        "#studentDetailsPageContent",
      );

      if (detailsContent && window.currentStudentDetails) {
        detailsContent.innerHTML = buildStudentDetailsHtml(
          window.currentStudentDetails,
          true,
        );
        detailsContent
          .querySelector("[data-preview-print-profile]")
          ?.addEventListener("click", () =>
            openProfilePrintPreview(detailsContent.querySelector(".student-record-page")),
          );
        detailsContent
          .querySelector("[data-edit-profile]")
          ?.addEventListener("click", async () => {
            window.sessionStorage.setItem(
              "kumakhEditStudentId",
              studentField(window.currentStudentDetails, "Registration Number") ||
                studentField(window.currentStudentDetails, "Student ID") ||
                "",
            );
            await loadPage("students");
          });
      }
    }

    if (pageName === "staffDetails") {
      if (!window.currentStaffDetails) {
        const selectedId = window.sessionStorage.getItem(
          "kumakhSelectedStaffId",
        );
        if (selectedId) {
          const response = await getStaff();
          const records =
            response && response.success && Array.isArray(response.data)
              ? response.data
              : [];
          window.currentStaffDetails =
            records.find((record) =>
              [
                staffField(record, "Employee ID"),
                staffField(record, "Staff ID"),
              ].some((value) => String(value || "").trim() === selectedId),
            ) || null;
        }
      }

      const detailsContent = container.querySelector(
        "#staffDetailsPageContent",
      );

      if (detailsContent && window.currentStaffDetails) {
        detailsContent.innerHTML = buildStaffDetailsHtml(
          window.currentStaffDetails,
          true,
        );
        detailsContent
          .querySelector("[data-preview-print-profile]")
          ?.addEventListener("click", () =>
            openProfilePrintPreview(detailsContent.querySelector(".student-record-page")),
          );
        detailsContent
          .querySelector("[data-edit-profile]")
          ?.addEventListener("click", async () => {
            window.sessionStorage.setItem(
              "kumakhEditStaffId",
              staffField(window.currentStaffDetails, "Employee ID") ||
                staffField(window.currentStaffDetails, "Staff ID") ||
                "",
            );
            await loadPage("staff");
          });
      }
    }

    // --------------------------------------------------------
    // INITIALIZE STUDENTS PAGE
    // --------------------------------------------------------

    if (
      pageName === "students" &&
      typeof window.initializeStudentsPage === "function"
    ) {
      await window.initializeStudentsPage();
    }

    if (
      pageName === "staff" &&
      typeof window.initializeStaffPage === "function"
    ) {
      await window.initializeStaffPage();
    }

    if (pageName === "payments") {
      await initializePaymentsPage();
    }

    if (
      pageName === "payment-out" &&
      typeof window.initializePaymentOutPage === "function"
    ) {
      await window.initializePaymentOutPage();
    }

    // --------------------------------------------------------
    // INITIALIZE COURSE PAGE
    // --------------------------------------------------------

    if (
      pageName === "course" &&
      typeof window.initializeCoursePage === "function"
    ) {
      await window.initializeCoursePage();
    }

    if (
      pageName === "settings" &&
      typeof window.initializeSettingsPage === "function"
    ) {
      window.initializeSettingsPage();
    }


    if (
      pageName === "salary" &&
      typeof window.initializePayrollPage === "function"
    ) {
      await window.initializePayrollPage();
    }

    if (
      pageName === "vendors" &&
      typeof window.initializeVendorsPage === "function"
    ) {
      await window.initializeVendorsPage();
    }

    if (
      pageName === "purchases" &&
      typeof window.initializePurchasesPage === "function"
    ) {
      await window.initializePurchasesPage();
    }
    if (pageName === "reports" && typeof window.initializeReportsPage === "function") {
      await window.initializeReportsPage();
    }

    if (loadSequence === pageLoadSequence) applyPageActionPermissions(container, pageName);
  } catch (error) {
    console.error("Page loading error:", error);
    if (loadSequence !== pageLoadSequence) return;
    container.innerHTML = `
      <div class="page-load-error" role="alert">
        <h2>This section could not be loaded</h2>
        <p>Please try again. Your saved records have not been changed.</p>
        <button type="button" class="btn btn-primary" data-retry-page>Try again</button>
      </div>
    `;
    container.querySelector("[data-retry-page]").addEventListener("click", () => loadPage(pageName));
    container.classList.remove("is-loading");
  } finally {
    if (loadSequence === pageLoadSequence) {
      container.setAttribute("aria-busy", "false");
      container.classList.remove("is-loading");
    }
    if (releasePageLoading) releasePageLoading();
    else window.kumakhLoading?.end?.();
  }
}

// ============================================================
// STUDENT HELPERS
// ============================================================

let studentsPageRequest = 0;

const normalizeStudentFieldKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const studentField = (student, field) => {
  if (!student) {
    return "";
  }

  const wantedKey = normalizeStudentFieldKey(field);

  const directMatch = Object.keys(student).find(
    (key) => normalizeStudentFieldKey(key) === wantedKey,
  );

  if (directMatch !== undefined) {
    const value = student[directMatch];
    return value === undefined || value === null ? "" : String(value);
  }

  const aliasMatches = Object.keys(student).filter((key) => {
    const normalizedKey = normalizeStudentFieldKey(key);

    return (
      (normalizedKey === "passportsizephoto" &&
        wantedKey === "passportphoto") ||
      (normalizedKey === "passportphoto" &&
        wantedKey === "passportsizephoto") ||
      (normalizedKey === "documentsuploaded" && wantedKey === "documents") ||
      (normalizedKey === "documents" && wantedKey === "documentsuploaded")
    );
  });

  if (aliasMatches.length) {
    const value = student[aliasMatches[0]];
    return value === undefined || value === null ? "" : String(value);
  }

  return "";
};

const rawStudentField = (student, ...fields) => {
  if (!student) return null;
  const keys = fields.map(normalizeStudentFieldKey);
  const matches = Object.keys(student).filter((candidate) =>
    keys.includes(normalizeStudentFieldKey(candidate)),
  );
  for (const key of matches) {
    if (student[key] !== undefined && student[key] !== null && String(student[key]).trim() !== "") {
      return student[key];
    }
  }
  return null;
};

const storedMedia = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  const text = String(value).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : { url: text };
  } catch (error) {
    return { url: text };
  }
};

const mediaUrl = (value) => {
  const media = storedMedia(value);
  if (!media) return "";
  const encoded = media.base64 || (
    typeof media.data === "string" && !/^https?:\/\//i.test(media.data)
      ? media.data
      : ""
  );
  if (encoded) {
    if (/^data:/i.test(encoded)) return encoded;
    return `data:${media.mimeType || media.mime || "application/octet-stream"};base64,${encoded}`;
  }
  const source = media.url || media.downloadUrl || media.fileUrl || media.path ||
    media.fileId || media.id;
  if (/^data:/i.test(String(source || ""))) return String(source);
  return studentImageUrl(source);
};

const storedDocumentEntries = (value) => {
  if (!value) return [];
  let documents = value;
  if (typeof documents === "string") {
    try { documents = JSON.parse(documents); } catch (error) {
      documents = documents.split(/\n+/).map((url) => ({ url }));
    }
  }
  if (!Array.isArray(documents)) documents = [documents];
  return documents.map((document) => {
    const media = storedMedia(document);
    if (!media) return null;
    return {
      name: media.fileName || media.name || "Open document",
      url: mediaUrl(media),
    };
  }).filter((document) => document.url);
};

const escapeStudentHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const studentUrl = (value) => {
  if (!value) {
    return "";
  }

  const text = String(value).trim();

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch (error) {
    // ignore and continue with Google Drive fallback handling
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(text)) {
    return `https://drive.google.com/uc?export=view&id=${text}`;
  }

  const driveMatch = text.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/i);

  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }

  return "";
};

const googleDriveFileId = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(text)) {
    return text;
  }

  const match = text.match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{10,})/i);
  return match && match[1] ? match[1] : "";
};

const studentImageUrl = (value) => {
  const fileId = googleDriveFileId(value);
  if (fileId) {
    // Drive's thumbnail endpoint is intended for <img> and works more
    // consistently than the download endpoint inside the Electron renderer.
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`;
  }

  return studentUrl(value);
};

const formatStudentDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return formatNepaliDate(date);
};

const formatStudentMoney = (value) => {
  if (value === "" || value === null || value === undefined) {
    return "—";
  }

  return formatNepaliCurrency(value);
};

// ============================================================
// FILE READER
// ============================================================

const readStudentFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");

      resolve({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: result.split(",")[1] || "",
      });
    };

    reader.onerror = () => {
      reject(new Error(`Could not read ${file.name}`));
    };

    reader.readAsDataURL(file);
  });
};

// ============================================================
// STUDENT MESSAGES
// ============================================================

const setStudentMessage = (element, message, type) => {
  if (!element) {
    return;
  }

  element.textContent = message;

  element.className = `alert alert-${type} mb-4`;
};

function showStudentPageMessage(message, type) {
  const element = document.getElementById("studentPageMessage");

  if (!element) {
    return;
  }

  element.textContent = message;

  element.className = `alert alert-${type} mb-3`;
}

// ============================================================
// STUDENT DETAILS
// ============================================================

const buildStudentDetailsHtml = (student, isRecordPage = false) => {
  const photoUrl = mediaUrl(rawStudentField(
    student,
    "Passport Size Photo",
    "Passport Photo",
    "passportPhoto",
    "passport_photo",
    "Photo",
    "Profile Photo",
  ));

  const storedDocuments = storedDocumentEntries(
    rawStudentField(student, "Documents", "Document", "Documents Uploaded"),
  );

  const documentEntries = storedDocuments.length ? storedDocuments : String(
    studentField(student, "Documents") ||
    studentField(student, "Document") ||
    studentField(student, "Documents Uploaded") || "",
  )
    .split(/\n+/)
    .map((value) => {
      const trimmed = String(value || "").trim();

      if (!trimmed) {
        return null;
      }

      const separatorIndex = trimmed.indexOf(":");

      if (separatorIndex > 0) {
        const name = trimmed.slice(0, separatorIndex).trim();
        const url = trimmed.slice(separatorIndex + 1).trim();

        return {
          name: name || "Open document",
          url,
        };
      }

      const documentUrl = studentUrl(trimmed);

      if (!documentUrl) {
        return null;
      }

      return {
        name: "Open document",
        url: documentUrl,
      };
    })
    .filter(Boolean)
    .map((entry) => ({
      name: entry.name,
      url: studentUrl(entry.url),
    }))
    .filter((entry) => entry.url);

  const photo = photoUrl
    ? `
        <div class="student-passport-photo">
          <img
            src="${escapeStudentHtml(photoUrl)}"
            alt="Passport size photo"
            class="img-thumbnail"
            style="width:160px;height:200px;object-fit:contain;"
            onerror="
              this.parentElement.innerHTML =
                '<div class=&quot;text-muted p-3&quot;>Passport photo could not be loaded.</div>';
            "
          >
        </div>
      `
    : `
        <div class="text-muted mb-3">
          No photo available
        </div>
      `;

  const documents = documentEntries.length
    ? documentEntries
        .map((entry) => {
          const name = escapeStudentHtml(entry.name);
          const url = escapeStudentHtml(entry.url);
          const extension = String(entry.name).split(".").pop().toLowerCase();
          const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(
            extension,
          );
          const isPdf = extension === "pdf";
          const preview = isImage
            ? `<img src="${url}" alt="${name}" class="img-fluid rounded border mt-2" style="max-height:220px;object-fit:contain;" onerror="this.remove()">`
            : isPdf
              ? `<iframe src="${url}" title="${name}" class="w-100 border rounded mt-2" style="height:300px;"></iframe>`
              : "";

          return `
              <article class="border rounded-3 p-3 mb-2 bg-light-subtle">
                <div class="d-flex align-items-center justify-content-between gap-3">
                  <span class="fw-semibold text-break">${name}</span>
                  <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary flex-shrink-0">Open</a>
                </div>
                ${preview}
              </article>
            `;
        })
        .join("")
    : '<span class="text-muted">No documents uploaded.</span>';

  const valueCard = (label, value) => `
    <div class="student-detail-item">
      <span>${escapeStudentHtml(label)}</span>
      <strong>${escapeStudentHtml(value || "—")}</strong>
    </div>
  `;

  const fullName = studentField(student, "Full Name");
  const joiningDate = formatStudentDate(studentField(student, "Joining Date"));
  const course = studentField(student, "Course") || "Course not assigned";
  const registrationNumber =
    studentField(student, "Registration Number") ||
    studentField(student, "Student ID") ||
    "—";
  const status =
    studentField(student, "Student Status") ||
    studentField(student, "Status") ||
    "—";
  const duration = (studentField(student, "Course Duration") || "—").replace(
    /^1 Months?$/i,
    "1 Month",
  );
  const registrationFee = formatStudentMoney(
    studentField(student, "Registration Fee"),
  );
  const trainingFee = formatStudentMoney(
    studentField(student, "Training/Course Fee"),
  );
  const discount = formatStudentMoney(studentField(student, "Discount"));
  const parentName = studentField(student, "Parents Name");
  const parentRelationship = studentField(student, "Relationship");
  const parentPhone = studentField(student, "Parents Contact");
  const address = studentField(student, "Address");
  const currentUserName =
    document.getElementById("userDisplayName")?.textContent?.trim() ||
    "Cashier User";
  const infoRow = (label, value, icon) => `
    <div class="student-record-item">
      <span><i class="bi ${icon}" aria-hidden="true"></i>${escapeStudentHtml(label)}</span>
      <strong>${escapeStudentHtml(value || "—")}</strong>
    </div>
  `;

  if (isRecordPage) {
    return `
      <article class="student-record-page" aria-label="KCMT student record">
        <header class="student-record-brand">
          <div class="student-record-brand-main">
            <div class="student-record-brand-logo"><img src="./assets/kumakh-logo.png" alt="KCMT logo"></div>
            <div class="student-record-brand-copy">
              <b>KCMT</b>
              <strong>Kumakh College Management System</strong>
              <span>Learn · Lead · Succeed</span>
            </div>
          </div>
          <div class="student-record-document-type">
            <b>Student Record</b>
            <span>Issued by ${escapeStudentHtml(currentUserName)}</span>
            <span>${escapeStudentHtml(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</span>
          </div>
        </header>

        <section class="student-record-profile">
          <div class="student-record-photo">${photo}</div>
          <div class="student-record-profile-copy">
            <span class="student-profile-label">STUDENT PROFILE</span>
            <h1>${escapeStudentHtml(fullName || "Unnamed student")}</h1>
            <p>${escapeStudentHtml(course)}</p>
            <div class="student-record-profile-meta">
              <span><b>Student ID</b> ${escapeStudentHtml(registrationNumber)}</span>
              <span class="profile-status"><b>Status</b> ${escapeStudentHtml(status)}</span>
              <span><b>Enrolled</b> ${escapeStudentHtml(joiningDate)}</span>
            </div>
          </div>
          <div class="d-flex gap-2 no-print">
          <button type="button" class="btn btn-outline-secondary" data-edit-profile data-permission="students.modify">
            <i class="bi bi-pencil me-1"></i>Edit
          </button>
          <button type="button" class="btn btn-primary student-record-print" data-preview-print-profile>
            <i class="bi bi-printer me-1"></i>Preview &amp; Print
          </button>
          </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-wallet2" aria-hidden="true"></i> Course &amp; Fees</h2>
          <div class="student-record-grid student-record-fees">
            ${infoRow("Course", course, "bi-mortarboard")}
            ${infoRow("Duration", duration, "bi-clock")}
            ${infoRow("Registration Fee", registrationFee, "bi-receipt")}
            ${infoRow("Training / Course Fee", trainingFee, "bi-cash-stack")}
            ${infoRow("Discount", discount, "bi-tag")}
          </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-person-vcard" aria-hidden="true"></i> Personal Information</h2>
          <div class="student-record-grid">
            ${infoRow("Full Name", fullName, "bi-person")}
            ${infoRow("Course", course, "bi-book")}
            ${infoRow("Student ID", registrationNumber, "bi-upc-scan")}
            ${infoRow("Status", status, "bi-check-circle")}
            ${infoRow("Date of Birth", formatStudentDate(studentField(student, "Date of Birth")), "bi-calendar3")}
            ${infoRow("Gender", studentField(student, "Gender"), "bi-gender-ambiguous")}
            ${infoRow("Marital Status", studentField(student, "Marital Status"), "bi-heart")}
            ${infoRow("Phone", studentField(student, "Student Contact Number") || studentField(student, "Contact"), "bi-telephone")}
            ${infoRow("Email", studentField(student, "Email"), "bi-envelope")}
            ${infoRow("Address", address, "bi-geo-alt")}
            ${infoRow("Enrolled Date", joiningDate, "bi-calendar3")}
            ${infoRow("Duration", duration, "bi-hourglass-split")}
            ${infoRow("Registration Fee", registrationFee, "bi-receipt")}
            ${infoRow("Training / Course Fee", trainingFee, "bi-cash-stack")}
            ${infoRow("Discount", discount, "bi-tag")}
          </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-people" aria-hidden="true"></i> Parent / Guardian</h2>
          <div class="student-record-grid">
            ${infoRow("Parent / Guardian Name", parentName, "bi-person-heart")}
            ${infoRow("Relationship", parentRelationship, "bi-diagram-3")}
            ${infoRow("Phone", parentPhone, "bi-telephone")}
            ${infoRow("Address", address, "bi-geo-alt")}
          </div>
        </section>

        <section class="student-record-section student-record-documents">
          <h2><i class="bi bi-folder2-open" aria-hidden="true"></i> Documents</h2>
          ${
            documentEntries.length
              ? `<div class="student-record-document-list">${documents}</div>`
              : `<div class="student-record-empty"><i class="bi bi-file-earmark-text" aria-hidden="true"></i><strong>No documents uploaded</strong><span>Documents will be available once submitted.</span></div>`
          }
        </section>

      </article>
    `;
  }

  return `
    <div class="profile-details-layout student-details-layout">
      <header class="student-profile-header">
        <div class="student-profile-photo">${photo}</div>
        <div class="student-profile-summary">
          <span class="student-profile-label">Student profile</span>
          <h4>${escapeStudentHtml(fullName || "Unnamed student")}</h4>
          <p>${escapeStudentHtml(studentField(student, "Course") || "Course not assigned")}</p>
          <div class="student-profile-meta">
            <span>ID: ${escapeStudentHtml(studentField(student, "Registration Number") || studentField(student, "Student ID") || "—")}</span>
            <span class="profile-status">● ${escapeStudentHtml(studentField(student, "Student Status") || studentField(student, "Status") || "—")}</span>
            <span>Enrolled: ${escapeStudentHtml(joiningDate)}</span>
          </div>
        </div>
      </header>

      <nav class="detail-tabs" aria-label="Student details sections">
        <button type="button" class="detail-tab active" data-detail-tab="student-personal">Personal</button>
        <button type="button" class="detail-tab" data-detail-tab="student-parent">Parent / Guardian</button>
        <button type="button" class="detail-tab" data-detail-tab="student-fees">Course &amp; Fees</button>
        <button type="button" class="detail-tab" data-detail-tab="student-documents">Documents</button>
      </nav>

      <section class="student-detail-section detail-panel active" data-detail-panel="student-personal">
        <h6>Personal information</h6>
        <div class="student-detail-grid">
          ${valueCard("Date of birth", formatStudentDate(studentField(student, "Date of Birth")))}
          ${valueCard("Gender", studentField(student, "Gender"))}
          ${valueCard("Marital status", studentField(student, "Marital Status"))}
          ${valueCard("Phone", studentField(student, "Student Contact Number") || studentField(student, "Contact"))}
          ${valueCard("Email", studentField(student, "Email"))}
          ${valueCard("Address", studentField(student, "Address"))}
        </div>
      </section>

      <section class="student-detail-section detail-panel" data-detail-panel="student-parent">
        <h6>Parent / guardian</h6>
        <div class="student-detail-grid">
          ${valueCard("Name", studentField(student, "Parents Name"))}
          ${valueCard("Relationship", studentField(student, "Relationship"))}
          ${valueCard("Contact", studentField(student, "Parents Contact"))}
        </div>
      </section>

      <section class="student-detail-section detail-panel" data-detail-panel="student-fees">
        <h6>Course and fees</h6>
        <div class="student-detail-grid">
          ${valueCard("Course", studentField(student, "Course"))}
          ${valueCard("Duration", studentField(student, "Course Duration"))}
          ${valueCard("Registration fee", formatStudentMoney(studentField(student, "Registration Fee")))}
          ${valueCard("Training / course fee", formatStudentMoney(studentField(student, "Training/Course Fee")))}
          ${valueCard("Discount", formatStudentMoney(studentField(student, "Discount")))}
        </div>
      </section>

      <section class="student-detail-section detail-panel" data-detail-panel="student-documents">
        <h6>Uploaded documents</h6>
        <div class="student-documents">${documents}</div>
      </section>
    </div>
  `;
};

function initializeDetailTabs(container) {
  container.querySelectorAll("[data-detail-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.detailTab;
      container.querySelectorAll("[data-detail-tab]").forEach((item) => {
        item.classList.toggle("active", item === tab);
      });
      container.querySelectorAll("[data-detail-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.detailPanel === target);
      });
    });
  });
}

function openProfilePrintPreview(record) {
  if (!record) return;

  document.querySelector(".profile-print-preview")?.remove();
  const preview = document.createElement("section");
  preview.className = "profile-print-preview";
  preview.setAttribute("role", "dialog");
  preview.setAttribute("aria-modal", "true");
  preview.setAttribute("aria-label", "A4 print preview");

  const paper = document.createElement("div");
  paper.className = "profile-print-preview__paper";
  const printableRecord = record.cloneNode(true);
  printableRecord.querySelectorAll(".no-print").forEach((element) => element.remove());
  paper.appendChild(printableRecord);

  preview.innerHTML = `
    <div class="profile-print-preview__backdrop" data-close-print-preview></div>
    <div class="profile-print-preview__toolbar no-print">
      <div><strong>A4 print preview</strong><span>All profile sections are included.</span></div>
      <div class="profile-print-preview__actions">
        <button type="button" class="btn btn-light" data-close-print-preview>Close</button>
        <button type="button" class="btn btn-primary" data-confirm-profile-print><i class="bi bi-printer me-1"></i>Print A4</button>
      </div>
    </div>
    <div class="profile-print-preview__viewport"></div>
  `;
  preview.querySelector(".profile-print-preview__viewport").appendChild(paper);
  document.body.appendChild(preview);
  document.body.classList.add("modal-scroll-lock", "profile-printing");

  const close = () => {
    window.removeEventListener("keydown", onKeyDown);
    preview.remove();
    document.body.classList.remove("profile-printing");
    if (!document.querySelector(".profile-print-preview, .modal:not(.d-none)")) {
      document.body.classList.remove("modal-scroll-lock");
    }
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };

  preview.querySelectorAll("[data-close-print-preview]").forEach((button) => {
    button.addEventListener("click", close);
  });
  preview
    .querySelector("[data-confirm-profile-print]")
    ?.addEventListener("click", () => window.print());
  window.addEventListener("keydown", onKeyDown);
}

function renderStudentDetails(student) {
  const body = document.getElementById("studentDetailsBody");
  const modal = document.getElementById("studentDetailsModal");

  if (!body || !modal) {
    return;
  }

  body.innerHTML = buildStudentDetailsHtml(student);
  initializeDetailTabs(body);
  modal.classList.remove("d-none");
  modal.style.display = "flex";
  document.body.classList.add("modal-scroll-lock");
}

async function openStudentDetailsPage(student) {
  if (!student) {
    return;
  }

  window.currentStudentDetails = student;
  window.sessionStorage.setItem(
    "kumakhSelectedStudentId",
    studentField(student, "Student ID") ||
      studentField(student, "Registration Number") ||
      "",
  );
  try {
    const response = await getStudents();
    if (response && response.success && Array.isArray(response.data)) {
      const selectedId = window.sessionStorage.getItem(
        "kumakhSelectedStudentId",
      );
      window.currentStudentDetails =
        response.data.find((record) =>
          [
            studentField(record, "Student ID"),
            studentField(record, "Registration Number"),
          ].some((value) => String(value || "").trim() === selectedId),
        ) || student;
    }
  } catch (error) {
    console.error("Unable to refresh selected student details:", error);
  }
  await loadPage("studentDetails");
}

// ============================================================
// STAFF HELPERS
// ============================================================

let staffPageRequest = 0;

const normalizeStaffFieldKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const staffField = (staff, field) => {
  if (!staff) {
    return "";
  }

  const wantedKey = normalizeStaffFieldKey(field);
  const directMatch = Object.keys(staff).find(
    (key) => normalizeStaffFieldKey(key) === wantedKey,
  );

  if (directMatch !== undefined) {
    const value = staff[directMatch];
    return value === undefined || value === null ? "" : String(value);
  }

  return "";
};

const escapeStaffHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const staffUrl = (value) => {
  if (!value) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch (error) {
    // ignore
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(text)) {
    return `https://drive.google.com/uc?export=view&id=${text}`;
  }

  const driveMatch = text.match(/(?:\/d\/|id=)([A-Za-z0-9_-]{10,})/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }

  return "";
};

const googleDriveStaffFileId = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(text)) {
    return text;
  }

  const match = text.match(/(?:\/d\/|[?&]id=)([A-Za-z0-9_-]{10,})/i);
  return match && match[1] ? match[1] : "";
};

const staffImageUrl = (value) => {
  const fileId = googleDriveStaffFileId(value);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`;
  }

  return staffUrl(value);
};

const formatStaffDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return formatNepaliDate(date);
};

const buildStaffDetailsHtml = (staff, isRecordPage = false) => {
  const rawPhoto = (() => {
    const keys = [
      "Photo",
      "Passport Photo",
      "Passport Size Photo",
      "Profile Photo",
      "passportPhoto",
      "passport_photo",
    ];
    const matches = Object.keys(staff || {}).filter((candidate) =>
      keys.map(normalizeStaffFieldKey).includes(normalizeStaffFieldKey(candidate)),
    );
    for (const key of matches) {
      if (staff[key] !== undefined && staff[key] !== null && String(staff[key]).trim() !== "") {
        return staff[key];
      }
    }
    return null;
  })();
  const photoUrl = mediaUrl(rawPhoto);

  const storedDocuments = storedDocumentEntries(
    Object.keys(staff || {}).reduce((value, key) =>
      ["documents", "document", "documents uploaded"].map(normalizeStaffFieldKey)
        .includes(normalizeStaffFieldKey(key)) ? staff[key] : value, null),
  );

  const documentEntries = storedDocuments.length ? storedDocuments : String(
    staffField(staff, "Documents") ||
    staffField(staff, "Document") ||
    staffField(staff, "Documents Uploaded") || "",
  )
    .split(/\n+/)
    .map((value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) {
        return null;
      }

      const separatorIndex = trimmed.indexOf(":");
      if (separatorIndex > 0) {
        const name = trimmed.slice(0, separatorIndex).trim();
        const url = trimmed.slice(separatorIndex + 1).trim();
        return { name: name || "Open document", url };
      }

      const documentUrl = staffUrl(trimmed);
      if (!documentUrl) {
        return null;
      }

      return { name: "Open document", url: documentUrl };
    })
    .filter(Boolean)
    .map((entry) => ({
      name: entry.name,
      url: staffUrl(entry.url),
    }))
    .filter((entry) => entry.url);

  const photo = photoUrl
    ? `
    <div class="student-passport-photo">
      <img src="${escapeStaffHtml(photoUrl)}" alt="Staff photo" class="img-thumbnail" style="width:160px;height:200px;object-fit:cover;" onerror="this.parentElement.innerHTML = '<div class=&quot;text-muted p-3&quot;>Staff photo could not be loaded.</div>';"></img>
    </div>
  `
    : `
    <div class="text-muted mb-3">No photo available</div>
  `;

  const documents = documentEntries.length
    ? documentEntries
        .map((entry) => {
          const name = escapeStaffHtml(entry.name);
          const url = escapeStaffHtml(entry.url);
          const extension = String(entry.name).split(".").pop().toLowerCase();
          const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(
            extension,
          );
          const isPdf = extension === "pdf";
          const preview = isImage
            ? `<img src="${url}" alt="${name}" class="img-fluid rounded border mt-2" style="max-height:220px;object-fit:contain;" onerror="this.remove()">`
            : isPdf
              ? `<iframe src="${url}" title="${name}" class="w-100 border rounded mt-2" style="height:300px;"></iframe>`
              : "";

          return `
          <article class="border rounded-3 p-3 mb-2 bg-light-subtle">
            <div class="d-flex align-items-center justify-content-between gap-3">
              <span class="fw-semibold text-break">${name}</span>
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary flex-shrink-0">Open</a>
            </div>
            ${preview}
          </article>
        `;
        })
        .join("")
    : '<span class="text-muted">No documents uploaded.</span>';

  const valueCard = (label, value) => `
    <div class="student-detail-item">
      <span>${escapeStaffHtml(label)}</span>
      <strong>${escapeStaffHtml(value || "—")}</strong>
    </div>
  `;

  const fullName =
    staffField(staff, "Full Name") ||
    staffField(staff, "Name") ||
    "Unnamed staff";
  const jobTitle =
    staffField(staff, "Job Title") ||
    staffField(staff, "Position") ||
    staffField(staff, "Designation") ||
    "Role not assigned";
  const department =
    staffField(staff, "Department") || staffField(staff, "Section");
  const joiningDate = formatStaffDate(
    staffField(staff, "Joining Date") || staffField(staff, "Date Joined"),
  );
  const staffId =
    staffField(staff, "Staff ID") || staffField(staff, "Employee ID") || "—";
  const status =
    staffField(staff, "Staff Status") ||
    staffField(staff, "Status") ||
    "Active";
  const phone =
    staffField(staff, "Mobile Number") ||
    staffField(staff, "Contact") ||
    staffField(staff, "Phone");
  const personalAddress =
    staffField(staff, "Personal Address") || staffField(staff, "Address");
  const basicSalary =
    staffField(staff, "Basic Salary") || staffField(staff, "Salary");
  const currentUserName =
    document.getElementById("userDisplayName")?.textContent?.trim() ||
    "Cashier User";
  const infoRow = (label, value, icon) => `
    <div class="student-record-item">
      <span><i class="bi ${icon}" aria-hidden="true"></i>${escapeStaffHtml(label)}</span>
      <strong>${escapeStaffHtml(value || "—")}</strong>
    </div>
  `;

  if (isRecordPage) {
    return `
      <article class="student-record-page staff-record-page" aria-label="KCMT staff record">
        <header class="student-record-brand">
          <div class="student-record-brand-main">
            <div class="student-record-brand-logo"><img src="./assets/kumakh-logo.png" alt="KCMT logo"></div>
            <div class="student-record-brand-copy">
              <b>KCMT</b>
              <strong>Kumakh College Management System</strong>
              <span>Learn · Lead · Succeed</span>
            </div>
          </div>
          <div class="student-record-document-type">
            <b>Staff Record</b>
            <span>Issued by ${escapeStaffHtml(currentUserName)}</span>
            <span>${escapeStaffHtml(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</span>
          </div>
        </header>

        <section class="student-record-profile">
          <div class="student-record-photo">${photo}</div>
          <div class="student-record-profile-copy">
            <span class="student-profile-label">STAFF PROFILE</span>
            <h1>${escapeStaffHtml(fullName)}</h1>
            <p>${escapeStaffHtml(jobTitle)}</p>
            <div class="student-record-profile-meta">
              <span><b>Staff ID</b> ${escapeStaffHtml(staffId)}</span>
              <span><b>Department</b> ${escapeStaffHtml(department || "—")}</span>
              <span class="profile-status"><b>Status</b> ${escapeStaffHtml(status)}</span>
              <span><b>Joined</b> ${escapeStaffHtml(joiningDate)}</span>
            </div>
          </div>
          <div class="d-flex gap-2 no-print">
          <button type="button" class="btn btn-outline-secondary" data-edit-profile data-permission="staff.modify">
            <i class="bi bi-pencil me-1"></i>Edit
          </button>
          <button type="button" class="btn btn-primary student-record-print" data-preview-print-profile>
            <i class="bi bi-printer me-1"></i>Preview &amp; Print
          </button>
          </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-person-vcard" aria-hidden="true"></i> Personal Information</h2>
          <div class="student-record-grid">
            ${infoRow("Full Name", fullName, "bi-person")}
            ${infoRow("Staff ID", staffId, "bi-upc-scan")}
            ${infoRow("Gender", staffField(staff, "Gender"), "bi-gender-ambiguous")}
            ${infoRow("Date of Birth", formatStaffDate(staffField(staff, "Date of Birth")), "bi-calendar3")}
            ${infoRow("Phone", phone, "bi-telephone")}
            ${infoRow("Email", staffField(staff, "Email"), "bi-envelope")}
            ${infoRow("Personal Address", personalAddress, "bi-geo-alt")}
            ${infoRow("Status", status, "bi-check-circle")}
            ${infoRow("Blood Group", staffField(staff, "Blood Group"), "bi-droplet")}
            ${infoRow("Marital Status", staffField(staff, "Marital Status"), "bi-heart")}
            ${infoRow("Citizenship Number", staffField(staff, "Citizenship Number"), "bi-card-text")}
            ${infoRow("Personal PAN No", staffField(staff, "Personal PAN No"), "bi-credit-card")}
            ${infoRow("Home Number", staffField(staff, "Home Number"), "bi-telephone")}
            ${infoRow("Alternative Number", staffField(staff, "Alternative Number"), "bi-phone")}
            ${infoRow("Father's Name", staffField(staff, "Fathers Name") || staffField(staff, "Father Name"), "bi-person")}
            ${infoRow("Mother's Name", staffField(staff, "Mothers Name") || staffField(staff, "Mother Name"), "bi-person")}
            ${infoRow("Grandfather's Name", staffField(staff, "Grandfathers Name"), "bi-person")}
            ${infoRow("Grandmother's Name", staffField(staff, "Grandmothers Name"), "bi-person")}
            ${infoRow("Spouse Name", staffField(staff, "Spouse Name"), "bi-person-heart")}
          </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-briefcase" aria-hidden="true"></i> Employment Information</h2>
          <div class="student-record-grid">
            ${infoRow("Designation", jobTitle, "bi-person-badge")}
            ${infoRow("Department", department, "bi-building")}
            ${infoRow("Joining Date", joiningDate, "bi-calendar3")}
            ${infoRow("Employment Type", staffField(staff, "Employment Type"), "bi-clipboard-check")}
            ${infoRow("Basic Salary", basicSalary, "bi-cash-stack")}
            ${infoRow("Work Shift", staffField(staff, "Work Shift") || staffField(staff, "Shift"), "bi-clock")}
            ${infoRow("Experience", staffField(staff, "Experience"), "bi-award")}
            ${infoRow("Report To", staffField(staff, "Report To"), "bi-person-up")}
            ${infoRow("Emergency Contact", staffField(staff, "Emergency Contact"), "bi-telephone-plus")}
            ${infoRow("Qualification", staffField(staff, "Qualification"), "bi-mortarboard")}
            ${infoRow("Company Name", staffField(staff, "Company Name"), "bi-building")}
            ${infoRow("Company Address", staffField(staff, "Company Address"), "bi-geo-alt")}
            ${infoRow("Company Contact No", staffField(staff, "Company Contact No"), "bi-telephone")}
        </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-bank" aria-hidden="true"></i> Account &amp; Banking</h2>
          <div class="student-record-grid">
            ${infoRow("Account Number", staffField(staff, "Account Number"), "bi-credit-card-2-front")}
            ${infoRow("Account Name", staffField(staff, "Account Name"), "bi-person-vcard")}
            ${infoRow("Bank Name", staffField(staff, "Bank Name"), "bi-bank")}
            ${infoRow("SWIFT Code", staffField(staff, "SWIFT Code") || staffField(staff, "Swift Code"), "bi-globe2")}
          </div>
        </section>

        <section class="student-record-section">
          <h2><i class="bi bi-folder2-open" aria-hidden="true"></i> Staff Record &amp; Files</h2>
          <div class="student-record-grid">
            ${infoRow("Employee Drive Folder", staffField(staff, "Employee Drive Folder"), "bi-folder")}
            ${infoRow("Created At", staffField(staff, "Created At"), "bi-calendar-plus")}
            ${infoRow("Updated At", staffField(staff, "Updated At"), "bi-calendar-check")}
          </div>
        </section>

        <section class="student-record-section student-record-documents">
          <h2><i class="bi bi-folder2-open" aria-hidden="true"></i> Documents</h2>
          ${
            documentEntries.length
              ? `<div class="student-record-document-list">${documents}</div>`
              : `<div class="student-record-empty"><i class="bi bi-file-earmark-text" aria-hidden="true"></i><strong>No documents uploaded</strong><span>Documents will be available once submitted.</span></div>`
          }
        </section>
      </article>
    `;
  }

  return `
    <div class="profile-details-layout student-details-layout">
      <header class="student-profile-header">
        <div class="student-profile-photo">${photo}</div>
        <div class="student-profile-summary">
          <span class="student-profile-label">Staff profile</span>
          <h4>${escapeStaffHtml(fullName)}</h4>
          <p>${escapeStaffHtml(jobTitle)}</p>
          <div class="student-profile-meta">
            <span>ID: ${escapeStaffHtml(staffField(staff, "Staff ID") || staffField(staff, "Employee ID") || "—")}</span>
            <span class="profile-status">● ${escapeStaffHtml(staffField(staff, "Staff Status") || staffField(staff, "Status") || "Active")}</span>
            <span>Joined: ${escapeStaffHtml(joiningDate)}</span>
          </div>
        </div>
      </header>

      <nav class="detail-tabs" aria-label="Staff details sections">
        <button type="button" class="detail-tab active" data-detail-tab="staff-personal">Personal</button>
        <button type="button" class="detail-tab" data-detail-tab="staff-employment">Employment</button>
        <button type="button" class="detail-tab" data-detail-tab="staff-documents">Documents</button>
        <button type="button" class="detail-tab" data-detail-tab="staff-account">Account</button>
      </nav>

      <section class="student-detail-section detail-panel active" data-detail-panel="staff-personal">
        <h6>Personal information</h6>
        <div class="student-detail-grid">
          ${valueCard("Date of birth", formatStaffDate(staffField(staff, "Date of Birth")))}
          ${valueCard("Gender", staffField(staff, "Gender"))}
          ${valueCard("Blood group", staffField(staff, "Blood Group"))}
          ${valueCard("Phone", staffField(staff, "Contact") || staffField(staff, "Phone"))}
          ${valueCard("Email", staffField(staff, "Email"))}
          ${valueCard("Address", staffField(staff, "Address"))}
        </div>
      </section>

      <section class="student-detail-section detail-panel" data-detail-panel="staff-employment">
        <h6>Employment details</h6>
        <div class="student-detail-grid">
          ${valueCard("Job title", staffField(staff, "Job Title") || staffField(staff, "Position"))}
          ${valueCard("Department", department)}
          ${valueCard("Contact", staffField(staff, "Contact"))}
          ${valueCard("Email", staffField(staff, "Email"))}
          ${valueCard("Emergency contact", staffField(staff, "Emergency Contact"))}
          ${valueCard("Qualification", staffField(staff, "Qualification"))}
        </div>
      </section>

      <section class="student-detail-section detail-panel" data-detail-panel="staff-documents">
        <h6>Uploaded documents</h6>
        <div class="student-documents">${documents}</div>
      </section>

      <section class="student-detail-section detail-panel" data-detail-panel="staff-account">
        <h6>Account</h6>
        <div class="student-detail-grid">
          ${valueCard("Email", staffField(staff, "Email"))}
          ${valueCard("Contact", staffField(staff, "Contact"))}
          ${valueCard("Role", staffField(staff, "Role") || staffField(staff, "Job Title") || staffField(staff, "Position"))}
        </div>
      </section>
    </div>
  `;
};

async function openStaffDetailsPage(staff) {
  if (!staff) {
    return;
  }

  window.currentStaffDetails = staff;
  window.sessionStorage.setItem(
    "kumakhSelectedStaffId",
    staffField(staff, "Employee ID") || staffField(staff, "Staff ID") || "",
  );
  try {
    const response = await getStaff();
    if (response && response.success && Array.isArray(response.data)) {
      const selectedId = window.sessionStorage.getItem("kumakhSelectedStaffId");
      window.currentStaffDetails =
        response.data.find((record) =>
          [
            staffField(record, "Employee ID"),
            staffField(record, "Staff ID"),
          ].some((value) => String(value || "").trim() === selectedId),
        ) || staff;
    }
  } catch (error) {
    console.error("Unable to refresh selected staff details:", error);
  }
  await loadPage("staffDetails");
}

async function saveStaffRecord(payload) {
  return apiRequest("saveStaff", payload);
}

async function updateStaffRecord(payload) {
  return apiRequest("updateStaff", payload);
}

async function deleteStaffRecord(payload) {
  return apiRequest("deleteStaff", payload);
}

// ============================================================
// CLOSE STUDENT DETAILS
// ============================================================

function closeStudentDetails() {
  const modal = document.getElementById("studentDetailsModal");

  if (!modal) {
    return;
  }

  modal.classList.add("d-none");
  modal.style.display = "";
  document.body.classList.remove("modal-scroll-lock");
}

// ============================================================
// STAFF PAGE
// ============================================================

window.initializeStaffPage = async function initializeStaffPage() {
  window.currentStaffDetails = null;

  const tableBody = document.getElementById("staffTableBody");
  const search = document.getElementById("staffSearch");
  const departmentFilter = document.getElementById("staffDepartmentFilter");
  const messageElement = document.getElementById("staffPageMessage");
  const addStaffButton = document.getElementById("addStaffButton");
  const modal = document.getElementById("staffFormModal");
  const form = document.getElementById("staffForm");
  const saveButton = document.getElementById("saveStaffButton");
  const formAlert = document.getElementById("staffFormAlert");
  const photoInput = document.getElementById("staffPassportPhoto");
  const documentInput = document.getElementById("staffDocumentUpload");
  const photoInfo = document.getElementById("staffPhotoFileInfo");
  const documentInfo = document.getElementById("staffDocumentFileInfo");
  const closeButtons = document.querySelectorAll("[data-staff-modal-close]");

  if (
    !tableBody ||
    !search ||
    !messageElement ||
    !addStaffButton ||
    !modal ||
    !form ||
    !saveButton
  ) {
    console.error("Staff page elements are missing.");
    return;
  }

  let staffList = [];
  let selectedPassportPhoto = null;
  let selectedDocuments = [];
  let documentSelectionError = '';

  const setPageMessage = (text, type) => {
    messageElement.textContent = text;
    messageElement.className = `alert alert-${type} mb-3`;
  };

  const setFormAlert = (text, type) => {
    if (!text) {
      formAlert.className = "alert d-none mb-3";
      formAlert.textContent = "";
      return;
    }

    formAlert.textContent = text;
    formAlert.className = `alert alert-${type} mb-3`;
  };

  const closeModal = () => {
    modal.classList.add("d-none");
    modal.style.display = "";
    document.body.classList.remove("modal-scroll-lock");
    form.reset();
    selectedPassportPhoto = null;
    selectedDocuments = [];
    documentSelectionError = '';
    photoInfo.textContent = "No file selected.";
    documentInfo.textContent = "No documents selected.";
    setFormAlert("", "");
    saveButton.disabled = false;
    saveButton.textContent = "Save Staff";
  };

  const openModal = () => {
    modal.classList.remove("d-none");
    modal.style.display = "block";
    document.body.classList.add("modal-scroll-lock");
    setFormAlert("", "");
  };

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const data = result.includes(",") ? result.split(",")[1] : result;
        resolve({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: data,
        });
      };
      reader.onerror = () =>
        reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });

  const validateImageFile = (file) => {
    if (!file) return true;
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Passport photo must be JPG or PNG.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Passport photo must be 2MB or smaller.");
    }
    return true;
  };

  const validateDocumentFiles = (files) => {
    if (!files || !files.length) return;
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    files.forEach((file) => {
      if (
        !allowed.includes(file.type) &&
        !/\.(pdf|jpg|jpeg|png|doc|docx)$/i.test(file.name)
      ) {
        throw new Error(
          `Unsupported file type: ${file.name}. Use PDF, JPG, PNG, DOC, or DOCX.`,
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          `Document file is too large: ${file.name}. Keep each under 5MB.`,
        );
      }
    });
  };

  const filePreviewHolder = () => {
    const preview = document.getElementById("staffPhotoPreview");
    return preview || null;
  };

  const renderPassportPreview = () => {
    const preview = filePreviewHolder();
    if (!preview) return;

    if (!selectedPassportPhoto || !selectedPassportPhoto.file) {
      preview.innerHTML = '<span class="text-muted">No photo selected.</span>';
      return;
    }

    const url = URL.createObjectURL(selectedPassportPhoto.file);
    preview.innerHTML = `<img src="${url}" alt="Passport preview" style="max-width: 150px; max-height: 180px; object-fit: cover; border-radius: 12px; border: 1px solid #d7e1ee; background: #fff;" />`;
  };

  const renderDocumentList = () => {
    const list = document.getElementById("staffDocumentList");
    if (!list) return;

    if (!selectedDocuments.length) {
      list.innerHTML = '<span class="text-muted">No documents selected.</span>';
      return;
    }

    list.innerHTML = selectedDocuments
      .map(
        (file) =>
          `<li class="list-group-item small">${escapeStaffHtml(file.name)}</li>`,
      )
      .join("");
  };

  if (photoInput) {
    photoInput.addEventListener("change", () => {
      const file =
        photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
      try {
        if (!file) {
          selectedPassportPhoto = null;
          photoInfo.textContent = "No file selected.";
          renderPassportPreview();
          return;
        }
        validateImageFile(file);
        selectedPassportPhoto = { file, name: file.name };
        photoInfo.textContent = file.name;
        renderPassportPreview();
      } catch (error) {
        selectedPassportPhoto = null;
        photoInput.value = "";
        photoInfo.textContent = error.message || "Invalid file selection.";
        setFormAlert(error.message || "Invalid photo selection.", "danger");
      }
    });
  }

  if (documentInput) {
    documentInput.addEventListener("change", () => {
      const files = Array.from(documentInput.files || []);
      if (!files.length) return; // Cancelling the picker must preserve the queue.
      try {
        validateDocumentFiles(files);
        const combined = new Map(selectedDocuments.map(file => [file.name, file]));
        files.forEach(file => combined.set(file.name, file));
        selectedDocuments = [...combined.values()];
        documentSelectionError = '';
        documentInfo.textContent = `${selectedDocuments.length} document(s) ready to save. Upload to Drive happens when you submit the Staff report.`;
        setFormAlert('', '');
        renderDocumentList();
      } catch (error) {
        documentSelectionError = error.message || 'Invalid document selection.';
        documentInput.value = "";
        documentInfo.textContent =
          error.message || "Invalid document selection.";
        setFormAlert(error.message || "Invalid document selection.", "danger");
      }
    });
  }

  const getDepartmentOptions = (list) => {
    const departments = [
      ...new Set(
        list.map((staff) => staffField(staff, "Department")).filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    departmentFilter.innerHTML =
      '<option value="">All departments</option>' +
      departments
        .map(
          (dept) =>
            `<option value="${escapeStaffHtml(dept)}">${escapeStaffHtml(dept)}</option>`,
        )
        .join("");
  };

  const renderTable = (items) => {
    const rows = items
      .map((staff) => {
        const photoValue =
          staffField(staff, "Photo") ||
          staffField(staff, "Passport Photo") ||
          staffField(staff, "Passport Size Photo") ||
          "";
        const photoUrl = mediaUrl(
          staff.photo ||
          staff.photoData ||
          staff.passportPhoto ||
          staff.passport_photo ||
          photoValue,
        );
        const employeeId =
          staffField(staff, "Employee ID") ||
          staffField(staff, "EmployeeId") ||
          "—";
        const fullName =
          staffField(staff, "Full Name") ||
          staffField(staff, "Name") ||
          "Unnamed staff";
        const jobTitle =
          staffField(staff, "Job Title") ||
          staffField(staff, "Position") ||
          "—";
        const department = staffField(staff, "Department") || "—";
        const mobileNumber =
          staffField(staff, "Mobile Number") ||
          staffField(staff, "Contact") ||
          "—";
        const email = staffField(staff, "Email") || "—";
        const status = staffField(staff, "Status") || "Working";

        return `
          <tr>
            <td>
              ${photoUrl ? `<img src="${escapeStaffHtml(photoUrl)}" alt="${escapeStaffHtml(fullName)}" style="width:48px;height:48px;object-fit:cover;border-radius:12px;border:1px solid #d7e1ee;" />` : '<span class="text-muted">N/A</span>'}
            </td>
            <td>${escapeStaffHtml(employeeId)}</td>
            <td>${escapeStaffHtml(fullName)}</td>
            <td>${escapeStaffHtml(jobTitle)}</td>
            <td>${escapeStaffHtml(department)}</td>
            <td>${escapeStaffHtml(mobileNumber)}</td>
            <td>${escapeStaffHtml(email)}</td>
            <td>${escapeStaffHtml(status)}</td>
            <td class="text-end">
              <div class="d-flex gap-2 justify-content-end flex-wrap">
                <button type="button" class="btn btn-sm btn-outline-primary" data-action="view" data-staff="${encodeURIComponent(JSON.stringify(staff))}">View</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit" data-staff="${encodeURIComponent(JSON.stringify(staff))}">Edit</button>
                <button type="button" class="btn btn-sm btn-outline-warning" data-action="status" data-staff="${encodeURIComponent(JSON.stringify(staff))}">Status</button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-staff="${encodeURIComponent(JSON.stringify(staff))}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tableBody.innerHTML =
      rows ||
      `
        <tr>
          <td colspan="9" class="text-center text-muted py-4">No staff records found.</td>
        </tr>
      `;

    tableBody.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const rawStaff = decodeURIComponent(
            button.getAttribute("data-staff") || "",
          );
          const staffData = JSON.parse(rawStaff);
          const action = button.getAttribute("data-action");

          if (action === "view") {
            await openStaffDetailsPage(staffData);
            return;
          }

          if (action === "edit") {
            const formData = new FormData(form);
            const staffValues = Object.fromEntries(formData.entries());
            form.reset();
            populateStaffForm(staffData);
            openModal();
            setFormAlert(
              "You can update the staff details and save changes.",
              "info",
            );
            return;
          }

          if (action === "status") {
            const employeeId =
              staffField(staffData, "Employee ID") ||
              staffField(staffData, "EmployeeId");
            const status = await window.kumakhDialogs.prompt(
              "Enter staff status: Working or Left",
              staffField(staffData, "Status") || "Working",
            );
            if (!employeeId || !["Working", "Left"].includes(status)) return;
            const response = await updateStaffStatus({ employeeId, status });
            if (!response || !response.success)
              throw new Error(
                response?.message || "Unable to update staff status.",
              );
            await loadStaffData();
            return;
          }

          if (action === "delete") {
            const employeeId =
              staffField(staffData, "Employee ID") ||
              staffField(staffData, "EmployeeId");
            const confirmed = await window.kumakhDialogs.confirm(
              "Are you sure you want to delete this staff member?",
            );
            if (!confirmed) {
              return;
            }

            const response = await deleteStaffRecord({
              id: staffData.id || staffData["Staff ID"] || "",
              employeeId,
            });
            if (!response || !response.success) {
              setPageMessage(
                response && response.message
                  ? response.message
                  : "Unable to delete staff member.",
                "danger",
              );
              return;
            }

            setPageMessage("Staff member deleted successfully.", "success");
            await loadStaffData();
          }
        } catch (error) {
          console.error("Staff action failed:", error);
          setPageMessage(
            error.message ||
              "Something went wrong while processing the staff action.",
            "danger",
          );
        }
      });
    });
  };

  const populateStaffForm = (staff) => {
    form.dataset.editStaffId =
      staff.id || staff["Staff ID"] || staffField(staff, "Staff ID") || "";
    form.dataset.editEmployeeId =
      staffField(staff, "Employee ID") || staffField(staff, "EmployeeId") || "";
    form.fullName.value =
      staffField(staff, "Full Name") || staffField(staff, "Name") || "";
    form.address.value = staffField(staff, "Address") || "";
    form.gender.value = staffField(staff, "Gender") || "";
    form.bloodGroup.value = staffField(staff, "Blood Group") || "";
    form.mobileNumber.value =
      staffField(staff, "Mobile Number") ||
      staffField(staff, "Mobile") ||
      staffField(staff, "Contact") ||
      "";
    form.email.value = staffField(staff, "Email") || "";
    form.citizenshipNumber.value =
      staffField(staff, "Citizenship Number") || "";
    form.personalPanNo.value =
      staffField(staff, "Personal PAN No") || staffField(staff, "PAN") || "";
    form.maritalStatus.value = staffField(staff, "Marital Status") || "";
    form.homeNumber.value = staffField(staff, "Home Number") || "";
    form.alternativeNumber.value =
      staffField(staff, "Alternative Number") || "";
    form.dateOfBirth.value = staffField(staff, "Date of Birth") || "";
    form.fatherName.value =
      staffField(staff, "Fathers Name") ||
      staffField(staff, "Father Name") ||
      "";
    form.motherName.value =
      staffField(staff, "Mothers Name") ||
      staffField(staff, "Mother Name") ||
      "";
    form.grandfatherName.value = staffField(staff, "Grandfathers Name") || "";
    form.grandmotherName.value = staffField(staff, "Grandmothers Name") || "";
    form.spouseName.value = staffField(staff, "Spouse Name") || "";
    form.accountNumber.value = staffField(staff, "Account Number") || "";
    form.accountName.value = staffField(staff, "Account Name") || "";
    form.bankName.value = staffField(staff, "Bank Name") || "";
    form.swiftCode.value = staffField(staff, "SWIFT Code") || "";
    form.jobTitle.value =
      staffField(staff, "Job Title") || staffField(staff, "Position") || "";
    form.employeeId.value =
      staffField(staff, "Employee ID") || staffField(staff, "EmployeeId") || "";
    form.reportTo.value = staffField(staff, "Report To") || "";
    form.department.value = staffField(staff, "Department") || "";
    form.companyName.value = staffField(staff, "Company Name") || "";
    form.companyAddress.value = staffField(staff, "Company Address") || "";
    form.companyContactNo.value = staffField(staff, "Company Contact No") || "";
    form.joiningDate.value = staffField(staff, "Joining Date") || "";
    form.basicSalary.value = staffField(staff, "Basic Salary") || "";
    if (form.status)
      form.status.value = staffField(staff, "Status") || "Working";
    document.getElementById("staffFormTitle").textContent = "Edit Staff";
  };

  const resetForm = () => {
    form.reset();
    form.dataset.editStaffId = "";
    form.dataset.editEmployeeId = "";
    document.getElementById("staffFormTitle").textContent = "Add New Staff";
    selectedPassportPhoto = null;
    selectedDocuments = [];
    documentSelectionError = '';
    photoInput.value = "";
    documentInput.value = "";
    photoInfo.textContent = "No file selected.";
    documentInfo.textContent = "No documents selected.";
    renderPassportPreview();
    renderDocumentList();
  };

  const filterStaff = (list, term, selectedDepartment) => {
    const searchTerm = String(term || "")
      .trim()
      .toLowerCase();
    return list.filter((staff) => {
      const employeeId =
        staffField(staff, "Employee ID") ||
        staffField(staff, "EmployeeId") ||
        "";
      const name =
        staffField(staff, "Full Name") || staffField(staff, "Name") || "";
      const mobile =
        staffField(staff, "Mobile Number") ||
        staffField(staff, "Contact") ||
        "";
      const email = staffField(staff, "Email") || "";
      const department = staffField(staff, "Department") || "";
      const jobTitle =
        staffField(staff, "Job Title") || staffField(staff, "Position") || "";

      const matchesSearch =
        !searchTerm ||
        [employeeId, name, mobile, email, department, jobTitle]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);
      const matchesDepartment =
        !selectedDepartment ||
        department.toLowerCase() === selectedDepartment.toLowerCase();
      return matchesSearch && matchesDepartment;
    });
  };

  const loadStaffData = async () => {
    try {
      const response = await getStaff();
      if (!response || !response.success) {
        staffList = [];
        setPageMessage(
          response && response.message
            ? response.message
            : "Unable to load staff.",
          "warning",
        );
        renderTable([]);
        getDepartmentOptions([]);
        return;
      }

      staffList = Array.isArray(response.data) ? response.data : [];
      renderTable(filterStaff(staffList, search.value, departmentFilter.value));
      getDepartmentOptions(staffList);
      const pendingStaffId = window.sessionStorage.getItem("kumakhEditStaffId");
      if (pendingStaffId) {
        const pendingStaff = staffList.find(
          (staff) =>
            String(
              staffField(staff, "Employee ID") || staffField(staff, "Staff ID") || "",
            ).trim() === pendingStaffId,
        );
        window.sessionStorage.removeItem("kumakhEditStaffId");
        if (pendingStaff && hasPermission("staff.modify")) {
          form.reset();
          populateStaffForm(pendingStaff);
          openModal();
          setFormAlert("You can update the staff details and save changes.", "info");
        }
      }
    } catch (error) {
      console.error("Failed to load staff:", error);
      staffList = [];
      renderTable([]);
      setPageMessage(error.message || "Unable to load staff data.", "danger");
    }
  };

  const validateStaffData = (payload) => {
    const required = [
      "fullName",
      "address",
      "gender",
      "bloodGroup",
      "mobileNumber",
      "citizenshipNumber",
      "maritalStatus",
      "jobTitle",
      "employeeId",
      "department",
      "companyName",
      "companyAddress",
      "companyContactNo",
      "joiningDate",
      "basicSalary",
    ];
    const missing = required.filter(
      (field) => !String(payload[field] || "").trim(),
    );
    if (missing.length) {
      throw new Error("Please complete all required staff fields.");
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      throw new Error("Please enter a valid email address.");
    }

    if (
      payload.mobileNumber &&
      !/^[+0-9()\-\s]{7,20}$/.test(payload.mobileNumber)
    ) {
      throw new Error("Please enter a valid mobile number.");
    }

    if (
      payload.companyContactNo &&
      !/^[+0-9()\-\s]{7,20}$/.test(payload.companyContactNo)
    ) {
      throw new Error("Please enter a valid company contact number.");
    }

    if (
      !Number.isFinite(Number(payload.basicSalary)) ||
      Number(payload.basicSalary) < 0
    ) {
      throw new Error("Please enter a valid Basic Salary.");
    }

    const duplicate = staffList.some((item) => {
      const employeeId =
        staffField(item, "Employee ID") || staffField(item, "EmployeeId") || "";
      return (
        employeeId.toLowerCase() === payload.employeeId.trim().toLowerCase()
      );
    });

    if (
      duplicate &&
      (!form.dataset.editEmployeeId ||
        form.dataset.editEmployeeId.trim().toLowerCase() !==
          payload.employeeId.trim().toLowerCase())
    ) {
      throw new Error(
        "Employee ID already exists. Please use a different Employee ID.",
      );
    }
  };

  const buildStaffPayload = async () => {
    if (documentSelectionError) throw new Error(documentSelectionError + ' Select valid documents before saving.');
    const formData = new FormData(form);
    const staff = Object.fromEntries(formData.entries());
    const payload = {
      fullName: String(staff.fullName || "").trim(),
      address: String(staff.address || "").trim(),
      gender: String(staff.gender || "").trim(),
      bloodGroup: String(staff.bloodGroup || "").trim(),
      mobileNumber: String(staff.mobileNumber || "").trim(),
      email: String(staff.email || "").trim(),
      citizenshipNumber: String(staff.citizenshipNumber || "").trim(),
      personalPanNo: String(staff.personalPanNo || "").trim(),
      maritalStatus: String(staff.maritalStatus || "").trim(),
      homeNumber: String(staff.homeNumber || "").trim(),
      alternativeNumber: String(staff.alternativeNumber || "").trim(),
      dateOfBirth: String(staff.dateOfBirth || "").trim(),
      fatherName: String(staff.fatherName || "").trim(),
      motherName: String(staff.motherName || "").trim(),
      grandfatherName: String(staff.grandfatherName || "").trim(),
      grandmotherName: String(staff.grandmotherName || "").trim(),
      spouseName: String(staff.spouseName || "").trim(),
      accountNumber: String(staff.accountNumber || "").trim(),
      accountName: String(staff.accountName || "").trim(),
      bankName: String(staff.bankName || "").trim(),
      swiftCode: String(staff.swiftCode || "").trim(),
      jobTitle: String(staff.jobTitle || "").trim(),
      employeeId: String(staff.employeeId || "").trim(),
      reportTo: String(staff.reportTo || "").trim(),
      department: String(staff.department || "").trim(),
      companyName: String(staff.companyName || "").trim(),
      companyAddress: String(staff.companyAddress || "").trim(),
      companyContactNo: String(staff.companyContactNo || "").trim(),
      joiningDate: String(staff.joiningDate || "").trim(),
      basicSalary: Number(staff.basicSalary),
      status: String(staff.status || "Working").trim(),
    };

    validateStaffData(payload);

    let photoPayload = null;
    if (selectedPassportPhoto && selectedPassportPhoto.file) {
      validateImageFile(selectedPassportPhoto.file);
      photoPayload = await readFileAsBase64(selectedPassportPhoto.file);
    }

    let documentPayload = [];
    if (selectedDocuments.length) {
      validateDocumentFiles(selectedDocuments);
      documentPayload = await Promise.all(
        selectedDocuments.map(async (file) => readFileAsBase64(file)),
      );
    }

    const existingEmployeeId =
      form.dataset.editEmployeeId && String(form.dataset.editEmployeeId).trim();
    const existingStaffId =
      form.dataset.editStaffId && String(form.dataset.editStaffId).trim();
    return {
      id: existingStaffId || "",
      staff: payload,
      passportPhoto: photoPayload,
      documents: documentPayload,
      originalEmployeeId: existingEmployeeId || "",
    };
  };

  saveButton.addEventListener("click", async () => {
    try {
      setFormAlert("", "");
      saveButton.disabled = true;
      saveButton.textContent = "Saving staff...";

      const payload = await buildStaffPayload();
      const existingEmployeeId =
        form.dataset.editEmployeeId &&
        String(form.dataset.editEmployeeId).trim();
      const action = existingEmployeeId ? "updateStaff" : "saveStaff";
      const response = await apiRequest(action, payload);

      if (!response || !response.success) {
        throw new Error(
          response && response.message
            ? response.message
            : "Unable to save staff member.",
        );
      }

      setPageMessage(
        existingEmployeeId
          ? "Staff member updated successfully."
          : "Staff member added successfully.",
        "success",
      );
      closeModal();
      await loadStaffData();
    } catch (error) {
      console.error("Save staff failed:", error);
      setFormAlert(error.message || "Unable to save staff member.", "danger");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Staff";
    }
  });

  addStaffButton.addEventListener("click", () => {
    resetForm();
    openModal();
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  search.addEventListener("input", () => {
    renderTable(filterStaff(staffList, search.value, departmentFilter.value));
  });

  departmentFilter.addEventListener("change", () => {
    renderTable(filterStaff(staffList, search.value, departmentFilter.value));
  });

  if (document.getElementById("staffPhotoPreview") === null) {
    const previewWrap = document.createElement("div");
    previewWrap.id = "staffPhotoPreview";
    previewWrap.className = "mt-3";
    photoInfo.insertAdjacentElement("afterend", previewWrap);
  }

  if (document.getElementById("staffDocumentList") === null) {
    const docWrap = document.createElement("div");
    docWrap.id = "staffDocumentList";
    docWrap.className = "list-group mt-2";
    documentInfo.insertAdjacentElement("afterend", docWrap);
  }

  await loadStaffData();
  resetForm();
};

// ============================================================
// STUDENTS PAGE
// ============================================================

window.initializeStudentsPage = async function initializeStudentsPage() {
  window.currentStudentDetails = null;

  const tableBody = document.getElementById("studentsTableBody");

  const search = document.getElementById("studentSearch");

  const courseFilter = document.getElementById("studentCourseFilter");

  const addModal = document.getElementById("addStudentModal");

  const addForm = document.getElementById("addStudentForm");

  if (!tableBody || !search || !courseFilter || !addModal || !addForm) {
    console.error("Students page elements are missing.");

    return;
  }

  const requestId = ++studentsPageRequest;

  let students = [];
  let step = 1;
  let courses = [];

  // --------------------------------------------------------
  // FORM FIELD HELPER
  // --------------------------------------------------------

  const fields = (name) => {
    const field = addForm.elements[name];

    return field || null;
  };

  // --------------------------------------------------------
  // MESSAGE HELPER
  // --------------------------------------------------------

  const message = (text, type) => {
    setStudentMessage(document.getElementById("addStudentMessage"), text, type);
  };

  // --------------------------------------------------------
  // MODAL HELPER
  // --------------------------------------------------------

  const showModal = (modal, visible) => {
    if (!modal) {
      return;
    }

    modal.classList.toggle("d-none", !visible);

    modal.style.display = visible ? "block" : "";

    document.body.classList.toggle("modal-scroll-lock", visible);
  };

  // ========================================================
  // STEP NAVIGATION
  // ========================================================

  const updateStep = () => {
    document.querySelectorAll(".student-form-step").forEach((panel, index) => {
      panel.classList.toggle("d-none", index + 1 !== step);
    });

    for (let index = 1; index <= 4; index += 1) {
      const indicator = document.getElementById(`studentStepIndicator${index}`);

      if (!indicator) {
        continue;
      }

      indicator.classList.toggle("bg-primary", index === step);

      indicator.classList.toggle("text-white", index === step);

      indicator.classList.toggle("text-muted", index !== step);
    }

    const backButton = document.getElementById("studentBackButton");

    const nextButton = document.getElementById("studentNextButton");

    const saveButton = document.getElementById("saveStudentButton");

    if (backButton) {
      backButton.classList.toggle("d-none", step === 1);
    }

    if (nextButton) {
      nextButton.classList.toggle("d-none", step === 4);
    }

    if (saveButton) {
      saveButton.classList.toggle("d-none", step !== 4);
    }
  };

  // ========================================================
  // VALIDATE CURRENT STEP
  // ========================================================

  const validateStep = () => {
    const panel = document.getElementById(`studentFormStep${step}`);

    if (!panel) {
      return true;
    }

    const requiredFields = [...panel.querySelectorAll("[required]")];

    for (const control of requiredFields) {
      if (!control.checkValidity()) {
        control.reportValidity();

        return false;
      }
    }

    // ------------------------------------------------------
    // STEP 3 - COURSE
    // ------------------------------------------------------

    if (step === 3) {
      const courseField = fields("course");

      if (!courseField) {
        return true;
      }

      const course = String(courseField.value || "").trim();

      if (!course) {
        message("Please select a course loaded from the local database.", "danger");

        courseField.focus();

        return false;
      }
    }

    // ------------------------------------------------------
    // STEP 4 - PHOTO
    // ------------------------------------------------------

    if (step === 4) {
      const photoField = fields("passportPhoto");

      if (photoField && !photoField.files[0] && !addForm.dataset.editRegistrationNumber) {
        message("Passport photo is required.", "danger");

        return false;
      }
    }

    return true;
  };

  // ========================================================
  // RENDER STUDENTS
  // ========================================================

  const renderStudents = () => {
    const query = search.value.trim().toLowerCase();

    const selectedCourse = courseFilter.value;

    const statusFilter = document.getElementById("studentStatusFilter");
    const selectedStatus = statusFilter ? statusFilter.value : "";
    const filtered = students.filter((student) => {
      const matchesSearch = ["Full Name", "Course"].some((key) =>
        studentField(student, key).toLowerCase().includes(query),
      );

      const matchesCourse =
        !selectedCourse || studentField(student, "Course") === selectedCourse;
      const matchesStatus =
        !selectedStatus ||
        studentField(student, "Status").toLowerCase() ===
          selectedStatus.toLowerCase();

      return matchesSearch && matchesCourse && matchesStatus;
    });

    tableBody.innerHTML = filtered.length
      ? filtered
          .map((student) => {
            const index = students.indexOf(student);

            return `
                   <tr>

                     <td>
                       ${escapeStudentHtml(
                         studentField(student, "Registration Number") || "—",
                       )}
                     </td>
                     <td>
                       ${escapeStudentHtml(
                         studentField(student, "Full Name") || "—",
                       )}
                     </td>

                     <td>
                       ${escapeStudentHtml(
                         studentField(student, "Course") || "—",
                       )}
                     </td>
                     <td>${escapeStudentHtml(studentField(student, "Status") || "Active")}</td>

                     <td class="text-end">

                       <button
                         type="button"
                         class="btn btn-sm btn-outline-primary"
                         data-student-index="${index}"
                       >
                         View
                       </button>

                       ${
                         hasPermission("students.modify")
                           ? `
                       <button type="button" class="btn btn-sm btn-outline-secondary ms-1" data-student-edit-index="${index}">
                         Edit
                       </button>
                       `
                           : ""
                       }
                       ${
                         hasPermission("students.modify") || isAdministrator()
                           ? `
                         <select class="form-select form-select-sm d-inline-block w-auto ms-1" data-student-status-index="${index}" aria-label="Change student status">
                           <option value="Active" ${studentField(student, "Status").toLowerCase() === "active" ? "selected" : ""}>Active</option>
                           <option value="Passed" ${["passed", "pass out"].includes(studentField(student, "Status").toLowerCase()) ? "selected" : ""}>Passed</option>
                         </select>
                         ${
                           isAdministrator()
                             ? `
                         <button
                           type="button"
                           class="btn btn-sm btn-outline-danger ms-1"
                           data-delete-student-index="${index}"
                         >
                           Delete
                         </button>
                         `
                             : ""
                         }
                       `
                           : ""
                       }

                     </td>

                   </tr>
                  `;
          })
          .join("")
      : `
              <tr>

                <td
                colspan="5"
                  class="text-center text-muted py-4"
                >
                  No students found.
                </td>

              </tr>
            `;
  };

  const populateStudentForm = (student) => {
    const mappings = {
      registrationNumber: ["Registration Number", "Student ID"],
      joiningDate: ["Joining Date"],
      fullName: ["Full Name", "Name"],
      studentContact: ["Student Contact", "Student Contact Number", "Contact"],
      dateOfBirth: ["Date of Birth"],
      maritalStatus: ["Marital Status"],
      gender: ["Gender"],
      address: ["Address", "Personal Address"],
      parentsName: ["Parents Name", "Parent Name"],
      relationship: ["Relationship"],
      parentsContact: ["Parents Contact", "Parent Contact"],
      course: ["Course"],
      courseDuration: ["Course Duration", "Duration"],
      registrationFee: ["Registration Fee"],
      trainingCourseFee: ["Training Course Fee", "Course Fee"],
      discount: ["Discount"],
      status: ["Status"],
    };
    Object.entries(mappings).forEach(([name, keys]) => {
      const field = fields(name);
      if (field) field.value = keys.map((key) => studentField(student, key)).find(Boolean) || "";
    });
    const photo = fields("passportPhoto");
    if (photo) photo.required = false;
    const title = document.getElementById("addStudentTitle");
    if (title) title.textContent = "Edit Student";
    addForm.dataset.editRegistrationNumber =
      studentField(student, "Registration Number") || studentField(student, "Student ID") || "";
    addForm.dataset.editStudentId = studentField(student, "Student ID") || student.id || "";
    step = 1;
    updateStep();
    showModal(addModal, true);
  };

  // ========================================================
  // REFRESH STUDENTS
  // ========================================================

  const refresh = async () => {
    try {
      const result = await getStudents();

      if (requestId !== studentsPageRequest) {
        return;
      }

      if (!result || !result.success) {
        showStudentPageMessage(
          `Unable to load students: ${result?.message || "Unknown error"}`,
          "danger",
        );

        tableBody.innerHTML = `
            <tr>

              <td
                colspan="5"
                class="text-center text-danger py-4"
              >
                Unable to load students.
              </td>

            </tr>
          `;

        return;
      }

      students = Array.isArray(result.data) ? result.data : [];

      renderStudents();
      const pendingStudentId = window.sessionStorage.getItem("kumakhEditStudentId");
      if (pendingStudentId) {
        const pendingStudent = students.find(
          (student) =>
            String(
              studentField(student, "Registration Number") ||
                studentField(student, "Student ID") ||
                "",
            ).trim() === pendingStudentId,
        );
        window.sessionStorage.removeItem("kumakhEditStudentId");
        if (pendingStudent && hasPermission("students.modify")) {
          populateStudentForm(pendingStudent);
        }
      }
    } catch (error) {
      console.error("Student loading error:", error);

      showStudentPageMessage(
        error.message || "Unable to load students.",
        "danger",
      );

      tableBody.innerHTML = `
          <tr>

            <td
              colspan="5"
              class="text-center text-danger py-4"
            >
              Unable to load students.
            </td>

          </tr>
        `;
    }
  };

  // ========================================================
  // SEARCH
  // ========================================================

  search.addEventListener("input", renderStudents);

  // ========================================================
  // COURSE FILTER
  // ========================================================

  courseFilter.addEventListener("change", renderStudents);
  const statusFilter = document.getElementById("studentStatusFilter");
  if (statusFilter) statusFilter.addEventListener("change", renderStudents);

  // ========================================================
  // VIEW STUDENT
  // ========================================================

  tableBody.addEventListener("change", async (event) => {
    const statusButton = event.target.closest("[data-student-status-index]");
    if (statusButton && statusButton.tagName === "SELECT") {
      const student = students[Number(statusButton.dataset.studentStatusIndex)];
      const studentId = studentField(student, "Student ID") || student.id;
      const status = statusButton.value;
      if (!studentId || !["Active", "Passed"].includes(status)) return;
      statusButton.disabled = true;
      try {
        const result = await updateStudentStatus({
          studentId,
          status,
        });
        if (!result || !result.success)
          throw new Error(
            result?.message || "Unable to update student status.",
          );
        student.Status = status;
        showStudentPageMessage(
          "Student status updated successfully.",
          "success",
        );
        renderStudents();
      } catch (error) {
        showStudentPageMessage(
          error.message || "Unable to update student status.",
          "danger",
        );
        statusButton.value = studentField(student, "Status") || "Active";
        statusButton.disabled = false;
      }
      return;
    }

  });

  tableBody.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-student-edit-index]");
    if (editButton) {
      if (!hasPermission("students.modify")) return;
      populateStudentForm(students[Number(editButton.dataset.studentEditIndex)]);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-student-index]");
    if (deleteButton) {
      if (!isAdministrator()) return;
      const student = students[Number(deleteButton.dataset.deleteStudentIndex)];
      const studentId = studentField(student, "Student ID");
      if (!studentId) {
        showStudentPageMessage(
          "This student has no Student ID and cannot be deleted safely.",
          "danger",
        );
        return;
      }
      if (
        !await window.kumakhDialogs.confirm(
          `Delete ${studentField(student, "Full Name") || "this student"}? This cannot be undone.`,
        )
      )
        return;
      deleteButton.disabled = true;
      try {
        const session = getSession() || {};
        const result = await deleteStudent({
          studentId,
          userId: session.userId,
          username: session.username,
          role: session.role,
        });
        if (!result || !result.success)
          throw new Error(result?.message || "Could not delete student.");
        showStudentPageMessage("Student deleted successfully.", "success");
        await refresh();
      } catch (error) {
        showStudentPageMessage(
          error.message || "Could not delete student.",
          "danger",
        );
        deleteButton.disabled = false;
      }
      return;
    }

    const button = event.target.closest("[data-student-index]");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.studentIndex);

    const student = students[index];

    if (!student) {
      return;
    }

    openStudentDetailsPage(student);
  });

  // ========================================================
  // STUDENT DETAILS CLOSE
  // ========================================================

  document.querySelectorAll("[data-student-modal-close]").forEach((button) => {
    button.addEventListener("click", closeStudentDetails);
  });

  // ========================================================
  // ADD STUDENT MODAL CLOSE
  // ========================================================

  const closeAdd = () => {
    showModal(addModal, false);
  };

  document
    .querySelectorAll("[data-add-student-modal-close]")
    .forEach((button) => {
      button.addEventListener("click", closeAdd);
    });

  // ========================================================
  // OPEN ADD STUDENT
  // ========================================================

  const addStudentButton = document.getElementById("addStudentButton");

  if (addStudentButton) {
    addStudentButton.addEventListener("click", () => {
      addForm.reset();
      delete addForm.dataset.editRegistrationNumber;
      delete addForm.dataset.editStudentId;
      const photoField = fields("passportPhoto");
      if (photoField) photoField.required = true;
      const title = document.getElementById("addStudentTitle");
      if (title) title.textContent = "Add New Student";
      step = 1;

      updateStep();

      const messageElement = document.getElementById("addStudentMessage");

      if (messageElement) {
        messageElement.textContent = "";

        messageElement.className = "alert d-none mb-4";
      }

      showModal(addModal, true);

      // Always open the popup at the beginning of the active step rather
      // than preserving a scroll position from a previous edit.
      const formBody = addModal?.querySelector(".student-form-body");
      if (formBody) formBody.scrollTop = 0;
    });
  }

  // ========================================================
  // NEXT BUTTON
  // ========================================================

  const nextButton = document.getElementById("studentNextButton");

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      if (validateStep()) {
        if (step < 4) {
          step += 1;
        }

        updateStep();
      }
    });
  }

  // ========================================================
  // BACK BUTTON
  // ========================================================

  const backButton = document.getElementById("studentBackButton");

  if (backButton) {
    backButton.addEventListener("click", () => {
      if (step > 1) {
        step -= 1;

        updateStep();
      }
    });
  }

  // ========================================================
  // COURSE CHANGE
  // ========================================================

  const courseField = fields("course");

  if (courseField) {
    courseField.addEventListener("change", () => {
      const selected = courses.find(
        (course) => studentField(course, "Course Name") === courseField.value,
      );

      const durationField = fields("courseDuration");

      const feeField = fields("trainingCourseFee");

      if (durationField) {
        durationField.value = selected
          ? studentField(selected, "Duration")
          : "";
      }

      if (feeField) {
        feeField.value = selected ? studentField(selected, "Total Fee") : "";
      }
    });
  }

  // ========================================================
  // PASSPORT PHOTO
  // ========================================================

  const passportPhotoField = fields("passportPhoto");

  if (passportPhotoField) {
    passportPhotoField.addEventListener("change", () => {
      const file = passportPhotoField.files[0];

      const allowed = ["image/jpeg", "image/png", "image/webp"];

      if (
        file &&
        (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024)
      ) {
        message(
          "Photo must be JPG, JPEG, PNG or WebP and no larger than 5 MB.",
          "danger",
        );

        passportPhotoField.value = "";

        return;
      }

      const preview = document.getElementById("passportPhotoPreview");

      const previewContainer = document.getElementById(
        "passportPhotoPreviewContainer",
      );

      const noPreview = document.getElementById("passportPhotoNoPreview");

      if (previewContainer) {
        previewContainer.classList.toggle("d-none", !file);
      }

      if (noPreview) {
        noPreview.classList.toggle("d-none", Boolean(file));
      }

      if (file && preview) {
        if (preview.dataset.objectUrl) {
          URL.revokeObjectURL(preview.dataset.objectUrl);
        }

        const objectUrl = URL.createObjectURL(file);

        preview.src = objectUrl;

        preview.dataset.objectUrl = objectUrl;
      }
    });
  }

  // ========================================================
  // DOCUMENTS
  // ========================================================

  const documentsField = fields("documents");

  if (documentsField) {
    documentsField.addEventListener("change", () => {
      const allowed = [
        "application/pdf",

        "image/jpeg",

        "image/png",

        "image/webp",

        "application/msword",

        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      const files = [...documentsField.files];

      const invalidFile = files.find(
        (file) => !allowed.includes(file.type) || file.size > 10 * 1024 * 1024,
      );

      if (invalidFile) {
        message(
          "Documents must be PDF, JPG, JPEG, PNG, WebP, DOC or DOCX and no larger than 10 MB each.",
          "danger",
        );

        documentsField.value = "";

        const list = document.getElementById("studentDocumentList");

        if (list) {
          list.textContent = "No documents selected.";
        }

        return;
      }

      const list = document.getElementById("studentDocumentList");

      if (!list) {
        return;
      }

      list.innerHTML = files.length
        ? files.map((file) => escapeStudentHtml(file.name)).join("<br>")
        : "No documents selected.";
    });
  }

  // ========================================================
  // SAVE STUDENT
  // ========================================================

  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // ----------------------------------------------------
    // Only submit on step 4
    // ----------------------------------------------------

    if (step !== 4 || !validateStep()) {
      return;
    }

    // ----------------------------------------------------
    // Check all required fields normally
    // ----------------------------------------------------

    const requiredControls = [...addForm.querySelectorAll("[required]")];

    for (const control of requiredControls) {
      if (!control.checkValidity()) {
        control.reportValidity();

        return;
      }
    }

    const save = document.getElementById("saveStudentButton");

    if (!save) {
      console.error("saveStudentButton not found.");

      return;
    }

    save.disabled = true;

    try {
      // ==================================================
      // PHOTO
      // ==================================================

      const photoField = fields("passportPhoto");

      const photoFile =
        photoField && photoField.files ? photoField.files[0] : null;

      if (!photoFile && !addForm.dataset.editRegistrationNumber) {
        throw new Error("Passport photo is required.");
      }

      // ==================================================
      // DOCUMENTS
      // ==================================================

      const documentsField = fields("documents");

      const selectedDocumentFiles =
        documentsField && documentsField.files ? [...documentsField.files] : [];

      // ==================================================
      // TOTAL UPLOAD SIZE
      // ==================================================

      const totalUploadBytes =
        (photoFile ? photoFile.size : 0) +
        selectedDocumentFiles.reduce((total, file) => total + file.size, 0);

      if (totalUploadBytes > MAX_STUDENT_UPLOAD_BYTES) {
        throw new Error(
          "The selected files are too large to upload together. Please keep the total size below 20 MB.",
        );
      }

      // ==================================================
      // UPLOAD PHOTO
      // ==================================================

      message("Uploading photo...", "info");

      const photo = await readStudentFile(photoFile);

      // ==================================================
      // UPLOAD DOCUMENTS
      // ==================================================

      message("Uploading documents...", "info");

      const documents = await Promise.all(
        selectedDocumentFiles.map(readStudentFile),
      );

      // ==================================================
      // COLLECT STUDENT DATA
      // ==================================================

      const fieldNames = [
        "registrationNumber",
        "studentContact",

        "joiningDate",

        "fullName",

        "dateOfBirth",

        "maritalStatus",

        "gender",

        "address",

        "parentsName",

        "relationship",

        "parentsContact",

        "course",

        "courseDuration",

        "registrationFee",

        "trainingCourseFee",

        "discount",
        "status",
      ];

      const studentData = {};

      fieldNames.forEach((name) => {
        const field = fields(name);

        studentData[name] = field ? field.value : "";
      });

      // ==================================================
      // PAYLOAD
      // ==================================================

      const payload = {
        action: addForm.dataset.editRegistrationNumber ? "updateStudent" : "addStudent",

        student: {
          ...studentData,

          registrationFee: Number(studentData.registrationFee) || 0,

          trainingCourseFee: Number(studentData.trainingCourseFee) || 0,

          discount: Number(studentData.discount) || 0,
        },

        passportPhoto: photo
          ? {
              fileName: photo.fileName,

              mimeType: photo.mimeType,

              base64: photo.base64,
            }
          : null,

        documents: documents.filter(Boolean).map((document) => ({
          fileName: document.fileName,

          mimeType: document.mimeType,

          base64: document.base64,
        })),
      };

      // ==================================================
      // SAVE
      // ==================================================

      message("Saving student...", "info");

      const saveStudentApi = addForm.dataset.editRegistrationNumber
        ? updateStudent
        : addStudent;
      if (typeof saveStudentApi !== "function") {
        throw new Error("Student save API function is not available.");
      }
      if (addForm.dataset.editRegistrationNumber) {
        payload.student.id = addForm.dataset.editStudentId;
      }
      const result = await saveStudentApi(payload);

      if (!result || !result.success) {
        throw new Error(result?.message || "Could not save student.");
      }

      // ==================================================
      // RESET FORM
      // ==================================================

      addForm.reset();

      const documentList = document.getElementById("studentDocumentList");

      if (documentList) {
        documentList.textContent = "No documents selected.";
      }

      const previewContainer = document.getElementById(
        "passportPhotoPreviewContainer",
      );

      if (previewContainer) {
        previewContainer.classList.add("d-none");
      }

      const noPreview = document.getElementById("passportPhotoNoPreview");

      if (noPreview) {
        noPreview.classList.remove("d-none");
      }

      const preview = document.getElementById("passportPhotoPreview");

      if (preview && preview.dataset.objectUrl) {
        URL.revokeObjectURL(preview.dataset.objectUrl);

        delete preview.dataset.objectUrl;
      }

      if (preview) {
        preview.removeAttribute("src");
      }

      // ==================================================
      // CLOSE MODAL
      // ==================================================

      closeAdd();
      delete addForm.dataset.editRegistrationNumber;
      delete addForm.dataset.editStudentId;
      const photoInput = fields("passportPhoto");
      if (photoInput) photoInput.required = true;
      const formTitle = document.getElementById("addStudentTitle");
      if (formTitle) formTitle.textContent = "Add New Student";

      // ==================================================
      // SUCCESS MESSAGE
      // ==================================================

      showStudentPageMessage("Student saved successfully.", "success");

      // ==================================================
      // REFRESH STUDENTS
      // ==================================================

      await refresh();
    } catch (error) {
      console.error("Save student error:", error);

      message(error.message || "Unable to save student.", "danger");
    } finally {
      save.disabled = false;
    }
  });

  // ========================================================
  // LOAD COURSES
  // ========================================================

  try {
    if (typeof getCourses !== "function") {
      throw new Error("getCourses API function is not available.");
    }

    const coursesResult = await getCourses();

    if (requestId !== studentsPageRequest) {
      return;
    }

    const courseMessage = document.getElementById("studentCourseMessage");

    if (!coursesResult || !coursesResult.success) {
      if (courseMessage) {
        courseMessage.textContent = `Courses unavailable: ${
          coursesResult?.message || "Unknown error"
        }`;
      }
    } else {
      courses = Array.isArray(coursesResult.data) ? coursesResult.data : [];

      courses.forEach((course) => {
        const name = studentField(course, "Course Name");

        if (!name) {
          return;
        }

        // ------------------------------------------------
        // COURSE FILTER
        // ------------------------------------------------

        const alreadyInFilter = [...courseFilter.options].some(
          (option) => option.value === name,
        );

        if (!alreadyInFilter) {
          courseFilter.insertAdjacentHTML(
            "beforeend",
            `
                  <option
                    value="${escapeStudentHtml(name)}"
                  >
                    ${escapeStudentHtml(name)}
                  </option>
                `,
          );
        }

        // ------------------------------------------------
        // COURSE FORM SELECT
        // ------------------------------------------------

        if (courseField) {
          const alreadyInCourse = [...courseField.options].some(
            (option) => option.value === name,
          );

          if (!alreadyInCourse) {
            courseField.insertAdjacentHTML(
              "beforeend",
              `
                    <option
                      value="${escapeStudentHtml(name)}"
                      data-course-id="${escapeStudentHtml(studentField(course, "Course ID") || course.courseId || course.id || "")}"
                    >
                      ${escapeStudentHtml(name)}
                    </option>
                  `,
            );
          }
        }
      });
    }
  } catch (error) {
    console.error("Course loading error:", error);

    const courseMessage = document.getElementById("studentCourseMessage");

    if (courseMessage) {
      courseMessage.textContent = `Courses unavailable: ${error.message}`;
    }
  }

  // ========================================================
  // INITIALIZE STUDENT PAGE
  // ========================================================

  updateStep();

  await refresh();
};

// ============================================================
// COURSE PAGE
// ============================================================

window.initializeCoursePage = async function initializeCoursePage() {
  const tableBody = document.getElementById("courseTableBody");

  if (!tableBody) {
    return;
  }

  try {
    if (typeof getCourses !== "function") {
      throw new Error("getCourses API function is not available.");
    }

    const result = await getCourses();

    if (!document.getElementById("courseTableBody")) {
      return;
    }

    if (!result || !result.success) {
      tableBody.innerHTML = `
          <tr>

            <td
              colspan="4"
              class="text-center text-danger py-4"
            >
              Unable to load courses.
            </td>

          </tr>
        `;

      const message = document.getElementById("coursePageMessage");

      if (message) {
        message.textContent = `Unable to load courses: ${
          result?.message || "Unknown API error"
        }`;

        message.className = "alert alert-danger mb-3";
      }

      return;
    }

    const courses = Array.isArray(result.data) ? result.data : [];

    if (!courses.length) {
      tableBody.innerHTML = `
          <tr>

            <td
              colspan="4"
              class="text-center text-muted py-4"
            >
              No courses found.
            </td>

          </tr>
        `;

      return;
    }

    tableBody.innerHTML = courses
      .map(
        (course, index) => `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  ${escapeStudentHtml(
                    studentField(course, "Course Name") || "—",
                  )}
                </td>

                <td>
                  ${escapeStudentHtml(studentField(course, "Duration") || "—")}
                </td>

                <td>
                  ${escapeStudentHtml(
                    formatStudentMoney(studentField(course, "Total Fee")),
                  )}
                </td>

              </tr>
            `,
      )
      .join("");
  } catch (error) {
    console.error("Course page error:", error);

    tableBody.innerHTML = `
        <tr>

          <td
            colspan="4"
            class="text-center text-danger py-4"
          >
            Unable to load courses.
          </td>

        </tr>
      `;
  }
};

// ============================================================
// ADMIN COURSE MANAGEMENT
// ============================================================

window.initializeCoursePage = async function initializeCoursePage() {
  const tableBody = document.getElementById("courseTableBody");
  const addButton = document.getElementById("addCourseButton");
  const saveButton = document.getElementById("saveCourseButton");
  const modal = document.getElementById("courseModal");
  const form = document.getElementById("courseForm");
  const session = getSession();
  const canAdd = hasPermission("courses.add");
  const canModify = hasPermission("courses.modify");
  const canDelete = hasPermission("courses.delete");
  const canManage = canAdd || canModify || canDelete;
  if (!tableBody) return;

  document.querySelectorAll(".course-admin-column").forEach((element) => {
    element.classList.toggle("d-none", !canManage);
  });
  addButton?.classList.toggle("d-none", !canAdd);
  if (saveButton) saveButton.removeAttribute("data-permission");

  const closeModal = () => {
    modal?.classList.remove("show");
    if (modal) modal.style.display = "none";
  };
  const openModal = (course) => {
    if (!modal || !form) return;
    document.getElementById("courseModalTitle").textContent = course
      ? "Edit Course"
      : "Add Course";
    if (saveButton) {
      saveButton.hidden = course ? !canModify : !canAdd;
      saveButton.textContent = course ? "Save Changes" : "Save Course";
    }
    document.getElementById("courseId").value = course
      ? course["Course ID"] || course.courseId || course.id || ""
      : "";
    document.getElementById("courseId").dataset.row = course
      ? course._row || ""
      : "";
    document.getElementById("courseName").value = course
      ? course["Course Name"] || course.courseName || ""
      : "";
    document.getElementById("courseDuration").value = course
      ? course.Duration || course.duration || ""
      : "";
    document.getElementById("courseTotalFee").value = course
      ? course["Total Fee"] || course.totalFee || ""
      : "";
    modal.classList.add("show");
    modal.style.display = "block";
  };
  document
    .getElementById("closeCourseModal")
    ?.addEventListener("click", closeModal);
  document
    .getElementById("cancelCourseButton")
    ?.addEventListener("click", closeModal);
  addButton?.addEventListener("click", () => openModal(null));

  const render = (courses) => {
    if (!courses.length) {
      tableBody.innerHTML = `<tr><td colspan="${canManage ? 6 : 5}" class="text-center text-muted py-4">No courses found.</td></tr>`;
      return;
    }
    tableBody.innerHTML = courses
      .map((course, index) => {
        const id = course["Course ID"] || course.courseId || course.id || "";
        const row = course._row || "";
        const name =
          course["Course Name"] || course.courseName || course.Name || "";
        const duration = course.Duration || course.duration || "";
        const fee = course["Total Fee"] ?? course.totalFee ?? "";
        const status = String(course.Status || course.status || "Active");
        return `<tr>
        <td>${index + 1}</td>
        <td>${escapeStudentHtml(name || "—")}</td>
        <td>${escapeStudentHtml(duration || "—")}</td>
        <td>${escapeStudentHtml(formatStudentMoney(fee))}</td>
        <td>${escapeStudentHtml(status)}</td>
        ${
          canManage
            ? `<td class="course-admin-column">
          ${
            canModify
              ? `<button type="button" class="btn btn-sm btn-outline-primary me-1" data-course-action="edit" data-course-row="${escapeStudentHtml(row)}" data-course-id="${escapeStudentHtml(id)}">Edit</button>`
              : ""
          }${
            canDelete
              ? ` <button type="button" class="btn btn-sm btn-outline-danger" data-course-action="delete" data-course-row="${escapeStudentHtml(row)}" data-course-id="${escapeStudentHtml(id)}">Delete</button>`
              : ""
          }
        </td>`
            : ""
        }
      </tr>`;
      })
      .join("");
  };

  let courses = [];
  const load = async () => {
    const result = await getCourses();
    if (!result || !result.success)
      throw new Error(result?.message || "Unable to load courses.");
    courses = Array.isArray(result.data) ? result.data : [];
    render(courses);
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      courseId: document.getElementById("courseId").value.trim(),
      row: document.getElementById("courseId").dataset.row || "",
      courseName: document.getElementById("courseName").value.trim(),
      duration: document.getElementById("courseDuration").value.trim(),
      totalFee: document.getElementById("courseTotalFee").value,
      userRole: session.role,
    };
    try {
      if (payload.courseId && !canModify) {
        throw new Error("You do not have permission to edit courses.");
      }
      if (!payload.courseId && !canAdd) {
        throw new Error("You do not have permission to add courses.");
      }
      const result = payload.courseId
        ? await updateCourse(payload)
        : await saveCourse(payload);
      if (!result || !result.success)
        throw new Error(result?.message || "Unable to save course.");
      closeModal();
      if (saveButton) saveButton.textContent = "Save Course";
      await load();
    } catch (error) {
      document.getElementById("coursePageMessage").textContent = error.message;
      document.getElementById("coursePageMessage").className =
        "alert alert-danger mb-3";
    }
  });

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-course-action]");
    if (!button) return;
    const action = button.dataset.courseAction;
    if ((action === "edit" && !canModify) || (action === "delete" && !canDelete)) {
      return;
    }
    const rowKey = String(button.dataset.courseRow || "").trim();
    const course =
      (rowKey
        ? courses.find((item) => String(item._row || "").trim() === rowKey)
        : null) ||
      courses.find(
        (item) =>
          String(item["Course ID"] || item.courseId || "").trim() ===
          String(button.dataset.courseId || "").trim() ||
          String(item.id || "").trim() === String(button.dataset.courseId || "").trim(),
      );
    if (!course) return;
    if (button.dataset.courseAction === "edit") {
      document.getElementById("courseId").dataset.row = course._row || "";
      openModal(course);
      return;
    }
    if (button.dataset.courseAction === "delete") {
      if (!await window.kumakhDialogs.confirm(`Delete "${course["Course Name"] || course.courseName || course.Name || "this course"}"? Existing students may prevent deletion.`)) {
        return;
      }
      try {
        const result = await deleteCourse({
          courseId: course["Course ID"] || course.courseId || course.id,
          id: course["Course ID"] || course.courseId || course.id,
          row: course._row || "",
          userRole: session.role,
        });
        if (!result || !result.success) {
          throw new Error(result?.message || "Unable to delete course.");
        }
        await load();
      } catch (error) {
        const message = document.getElementById("coursePageMessage");
        if (message) {
          message.textContent = error.message;
          message.className = "alert alert-danger mb-3";
        }
      }
    }
  });

  try {
    await load();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Unable to load courses.</td></tr>`;
    const message = document.getElementById("coursePageMessage");
    if (message) {
      message.textContent = error.message;
      message.className = "alert alert-danger mb-3";
    }
  }
};

// ============================================================
// NAVIGATION
// ============================================================

window.initializeSettingsPage = function initializeSettingsPage() {
  window.initializeSoftwareUpdate?.();
  const form = document.getElementById("settingsForm");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const message = document.getElementById("settingsMessage");

  if (!form) {
    return;
  }

  if (apiUrlInput && window.kumakhApi) {
    window.kumakhApi.getApiUrl().then((url) => { apiUrlInput.value = url; }).catch((error) => { message.textContent = error.message; });
  }

  const fontFamily = document.getElementById("appFontFamily");
  const fontSize = document.getElementById("appFontSize");
  const displaySize = document.getElementById("appDisplaySize");
  const resetAppearance = document.getElementById("resetAppearanceButton");
  const syncAppearanceFields = (preferences) => {
    if (fontFamily) fontFamily.value = preferences.fontFamily;
    if (fontSize) fontSize.value = preferences.fontSize;
    if (displaySize) displaySize.value = preferences.displaySize;
  };
  const saveAppearance = () => {
    const preferences = {
      fontFamily: fontFamily?.value || "system",
      fontSize: fontSize?.value || "medium",
      displaySize: displaySize?.value || "100",
    };
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences));
    applyAppearancePreferences(preferences);
  };
  syncAppearanceFields(getAppearancePreferences());
  [fontFamily, fontSize, displaySize]
    .filter(Boolean)
    .forEach((control) => control.addEventListener("change", saveAppearance));
  resetAppearance?.addEventListener("click", () => {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    const preferences = applyAppearancePreferences({ ...DEFAULT_APPEARANCE });
    syncAppearanceFields(preferences);
  });

  /* Compact Settings: the existing APIs and permission keys remain the source of truth. */
  const credentialsSection = document.getElementById("credentialsSection");
  const systemUserForm = document.getElementById("systemUserForm");
  const systemUsersBody = document.getElementById("systemUsersBody");
  const systemUserMessage = document.getElementById("systemUserMessage");
  const session = getSession();
  const isAdmin = isAdministrator(session);
  const canViewUsers = hasPermission("users.view");
  const canAddUsers = hasPermission("users.add");
  const canModifyUsers = hasPermission("users.modify");
  let systemUsers = [];
  const accessControlSection = document.getElementById("accessControlSection");
  const systemRoleForm = document.getElementById("systemRoleForm");
  const systemRolesBody = document.getElementById("systemRolesBody");
  const systemRoleMessage = document.getElementById("systemRoleMessage");
  const permissionTargetType = document.getElementById("permissionTargetType");
  const permissionTargetId = document.getElementById("permissionTargetId");
  const permissionMatrixBody = document.getElementById("permissionMatrixBody");
  const savePermissionMatrixButton = document.getElementById("savePermissionMatrixButton");
  const accountSection = document.getElementById("accountSection");
  const accountForm = document.getElementById("accountForm");
  const accountMessage = document.getElementById("accountMessage");
  let systemRoles = [];
  let permissionMatrix = { permissions: [], rolePermissions: [], userPermissions: [] };

  // Superseded expanded settings UI retained below only as implementation history.
  // The compact modal workflow is initialized after this block.
  if (false) {

  const setRoleMessage = (text, success = false) => {
    if (!systemRoleMessage) return;
    systemRoleMessage.textContent = text || "";
    systemRoleMessage.className = `small ${text ? (success ? "text-success" : "text-danger") : ""}`;
  };

  const renderRoles = () => {
    if (!systemRolesBody) return;
    systemRolesBody.innerHTML = systemRoles.length
      ? systemRoles.map((role) => `
          <tr>
            <td>${escapeStudentHtml(String(role["Role Name"] || ""))}</td>
            <td>${escapeStudentHtml(String(role.Description || ""))}</td>
            <td>${escapeStudentHtml(String(role.Status || ""))}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-primary me-1" data-edit-system-role="${escapeStudentHtml(String(role["Role ID"] || ""))}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-delete-system-role="${escapeStudentHtml(String(role["Role ID"] || ""))}">Delete</button>
            </td>
          </tr>`).join("")
      : '<tr><td colspan="4" class="text-muted">No roles found.</td></tr>';
  };

  const renderUserRoleOptions = () => {
    const select = document.getElementById("systemUserRole");
    if (!select) return;
    const selected = select.value || "CASHIER";
    select.innerHTML = systemRoles
      .filter((role) => String(role.Status || "Active").toLowerCase() === "active")
      .map((role) => {
        const value = String(role["Role Name"] || "").toUpperCase();
        return `<option value="${escapeStudentHtml(value)}">${escapeStudentHtml(value)}</option>`;
      })
      .join("");
    if (Array.from(select.options).some((option) => option.value === selected)) {
      select.value = selected;
    }
  };

  const renderPermissionTargets = () => {
    if (!permissionTargetId) return;
    const isUser = permissionTargetType?.value === "user";
    const entries = isUser
      ? systemUsers.map((user) => [user.userId, `${user.fullName || user.username} (${user.username})`])
      : systemRoles.map((role) => [role["Role ID"], role["Role Name"]]);
    permissionTargetId.innerHTML = entries
      .map(([value, label]) => `<option value="${escapeStudentHtml(String(value || ""))}">${escapeStudentHtml(String(label || ""))}</option>`)
      .join("");
    renderPermissionMatrix();
  };

  const renderPermissionMatrix = () => {
    if (!permissionMatrixBody) return;
    const targetId = permissionTargetId?.value || "";
    const targetType = permissionTargetType?.value || "role";
    const assignments = targetType === "user"
      ? permissionMatrix.userPermissions
      : permissionMatrix.rolePermissions;
    const targetColumn = targetType === "user" ? "User ID" : "Role ID";
    const targetRole = systemRoles.find((role) => String(role["Role ID"] || "") === targetId);
    const targetUser = systemUsers.find((user) => String(user.userId || "") === targetId);
    const protectedTarget =
      (targetRole && String(targetRole["Role Name"] || "").toUpperCase() === "ADMIN") ||
      (targetUser && String(targetUser.userId || "") === "USR-0001");
    const allowed = {};
    assignments
      .filter((row) => String(row[targetColumn] || "") === targetId)
      .forEach((row) => {
        allowed[row["Permission Key"]] = String(row.Allowed).toLowerCase() === "true";
      });
    const grouped = {};
    permissionMatrix.permissions.forEach((permission) => {
      const moduleName = permission.Module || "other";
      grouped[moduleName] = grouped[moduleName] || [];
      grouped[moduleName].push(permission);
    });
    permissionMatrixBody.innerHTML = Object.keys(grouped).flatMap((moduleName) => {
      const actions = grouped[moduleName];
      return actions.map((permission) => `
        <tr>
          <td>${escapeStudentHtml(String(permission["Permission Key"] || ""))}</td>
          ${["view", "add", "modify", "delete"].map((action) => {
            const key = `${moduleName}.${action}`;
            const exists = actions.some((item) => item["Permission Key"] === key);
            const checked = protectedTarget || allowed[key];
            return `<td>${exists ? `<input class="form-check-input permission-toggle" type="checkbox" data-permission-key="${key}" ${checked ? "checked" : ""} ${protectedTarget ? "disabled" : ""}>` : "—"}</td>`;
          }).join("")}
        </tr>`);
    }).join("");
  };

  const loadAccessControl = async () => {
    if (!canViewUsers || !window.kumakhApi || !accessControlSection) return;
    accessControlSection.classList.remove("d-none");
    try {
      const [rolesResponse, permissionsResponse, usersResponse] = await Promise.all([
        window.kumakhApi.getRolesForAdmin({}),
        window.kumakhApi.getPermissionMatrix({}),
        window.kumakhApi.getUsersForAdmin({}),
      ]);
      if (!rolesResponse?.success) throw new Error(rolesResponse?.message || "Unable to load roles.");
      if (!permissionsResponse?.success) throw new Error(permissionsResponse?.message || "Unable to load permissions.");
      if (!usersResponse?.success) throw new Error(usersResponse?.message || "Unable to load users.");
      systemRoles = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
      permissionMatrix = permissionsResponse.data || permissionMatrix;
      systemUsers = Array.isArray(usersResponse.data) ? usersResponse.data : systemUsers;
      renderRoles();
      renderUserRoleOptions();
      renderPermissionTargets();
    } catch (error) {
      setRoleMessage(error.message);
    }
  };

  const setUserMessage = (text, success = false) => {
    if (!systemUserMessage) return;
    systemUserMessage.textContent = text || "";
    systemUserMessage.className = `small ${text ? (success ? "text-success" : "text-danger") : ""}`;
  };

  const setAccountMessage = (text, success = false) => {
    if (!accountMessage) return;
    accountMessage.textContent = text || "";
    accountMessage.className = `small ${text ? (success ? "text-success" : "text-danger") : ""}`;
  };

  if (accountSection && accountForm && isAdmin && session) {
    accountSection.classList.remove("d-none");
    document.getElementById("accountUsername").value = session.username || "";
    document.getElementById("accountFullName").value = session.fullName || "";
    accountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = event.submitter;
      if (submitButton) submitButton.disabled = true;
      try {
        const response = await window.kumakhApi.saveSystemUser({
          userId: session.userId,
          username: document.getElementById("accountUsername").value.trim(),
          password: document.getElementById("accountPassword").value,
          fullName: document.getElementById("accountFullName").value.trim(),
          employeeId: session.employeeId || "",
          role: "ADMIN",
          status: "Active",
        });
        if (!response?.success) {
          throw new Error(response?.message || "Unable to update administrator account.");
        }
        setAccountMessage(
          "Account updated. Log in again if you changed the username or password.",
          true,
        );
        document.getElementById("accountPassword").value = "";
        const updatedSession = {
          ...session,
          username: document.getElementById("accountUsername").value.trim(),
          fullName: document.getElementById("accountFullName").value.trim(),
        };
        window.sessionStorage.setItem("kumakhSession", JSON.stringify(updatedSession));
      } catch (error) {
        setAccountMessage(error.message);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  const renderUsers = () => {
    if (!systemUsersBody) return;
    systemUsersBody.innerHTML = systemUsers.length
      ? systemUsers.map((user) => `
          <tr>
            <td>${escapeStudentHtml(String(user.username || ""))}</td>
            <td>${escapeStudentHtml(String(user.fullName || ""))}</td>
            <td>${escapeStudentHtml(String(user.role || ""))}</td>
            <td>${escapeStudentHtml(String(user.status || ""))}</td>
            <td class="small">${escapeStudentHtml(Array.isArray(user.permissions) ? user.permissions.join(", ") : "")}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-primary me-1" data-edit-system-user="${escapeStudentHtml(String(user.username || ""))}">Edit</button>
              <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-reset-system-user="${escapeStudentHtml(String(user.username || ""))}">Reset password</button>
              <button type="button" class="btn btn-sm btn-outline-warning me-1" data-toggle-system-user="${escapeStudentHtml(String(user.username || ""))}">${String(user.status || "").toLowerCase() === "active" ? "Disable" : "Enable"}</button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-delete-system-user="${escapeStudentHtml(String(user.userId || ""))}">Delete</button>
            </td>
          </tr>`).join("")
      : '<tr><td colspan="6" class="text-muted">No users found.</td></tr>';
  };

  const loadUsers = async () => {
    if (!canViewUsers || !window.kumakhApi) return;
    try {
      const response = await window.kumakhApi.getUsersForAdmin({ currentRole: session.role });
      if (!response || !response.success) {
        throw new Error((response && response.message) || "Unable to load login credentials.");
      }
      systemUsers = Array.isArray(response.data) ? response.data : [];
      renderUsers();
    } catch (error) {
      setUserMessage(error.message);
      if (systemUsersBody) {
        systemUsersBody.innerHTML = `<tr><td colspan="6" class="text-danger">${escapeStudentHtml(error.message)}</td></tr>`;
      }
    }
  };

  if (credentialsSection && systemUserForm && canViewUsers) {
    credentialsSection.classList.remove("d-none");
    loadUsers();

    systemUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = event.submitter;
      if (submitButton) submitButton.disabled = true;
      try {
        const response = await window.kumakhApi.saveSystemUser({
          currentRole: session.role,
          userId: document.getElementById("systemUserId").value,
          username: document.getElementById("systemUserUsername").value.trim(),
          password: document.getElementById("systemUserPassword").value,
          fullName: document.getElementById("systemUserFullName").value.trim(),
          employeeId: document.getElementById("systemUserEmployeeId").value.trim(),
          role: document.getElementById("systemUserRole").value,
          status: document.getElementById("systemUserStatus").value,
        });
        if (!response || !response.success) {
          throw new Error((response && response.message) || "Unable to save login credentials.");
        }
        setUserMessage(response.message || "Login credentials saved.", true);
        systemUserForm.reset();
        document.getElementById("systemUserId").value = "";
        document.getElementById("systemUserRole").value = "CASHIER";
        document.getElementById("systemUserStatus").value = "Active";
        await loadUsers();
      } catch (error) {
        setUserMessage(error.message);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    document.getElementById("clearSystemUserButton")?.addEventListener("click", () => {
      systemUserForm.reset();
      document.getElementById("systemUserId").value = "";
      document.getElementById("systemUserRole").value = "CASHIER";
      document.getElementById("systemUserStatus").value = "Active";
      setUserMessage("");
    });

    systemUsersBody?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-system-user]");
      const resetButton = event.target.closest("[data-reset-system-user]");
      const toggleButton = event.target.closest("[data-toggle-system-user]");
      const deleteButton = event.target.closest("[data-delete-system-user]");
      const username =
        button?.dataset.editSystemUser ||
        resetButton?.dataset.resetSystemUser ||
        toggleButton?.dataset.toggleSystemUser;
      const user = systemUsers.find((item) => item.username === username);
      if (deleteButton) {
        window.kumakhApi.deleteSystemUser({ userId: deleteButton.dataset.deleteSystemUser })
          .then((response) => {
            if (!response?.success) throw new Error(response?.message || "Unable to delete user.");
            return loadUsers();
          })
          .catch((error) => setUserMessage(error.message));
        return;
      }
      if (!user) return;
      if (toggleButton) {
        window.kumakhApi.saveSystemUser({
          currentRole: session.role,
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          employeeId: user.employeeId,
          role: user.role,
          status: String(user.status).toLowerCase() === "active" ? "Inactive" : "Active",
        }).then((response) => {
          if (!response?.success) throw new Error(response?.message || "Unable to update user.");
          return loadUsers();
        }).catch((error) => setUserMessage(error.message));
        return;
      }
      if (resetButton) {
        document.getElementById("systemUserUsername").value = user.username || "";
        document.getElementById("systemUserId").value = user.userId || "";
        document.getElementById("systemUserFullName").value = user.fullName || "";
        document.getElementById("systemUserEmployeeId").value = user.employeeId || "";
        document.getElementById("systemUserRole").value = user.role || "CASHIER";
        document.getElementById("systemUserStatus").value = user.status || "Active";
        document.getElementById("systemUserPassword").value = "";
        document.getElementById("systemUserPassword").focus();
        setUserMessage("Enter a new password and save.", true);
        return;
      }
      document.getElementById("systemUserUsername").value = user.username || "";
      document.getElementById("systemUserId").value = user.userId || "";
      document.getElementById("systemUserFullName").value = user.fullName || "";
      document.getElementById("systemUserEmployeeId").value = user.employeeId || "";
      document.getElementById("systemUserRole").value = user.role || "CASHIER";
      document.getElementById("systemUserStatus").value = user.status || "Active";
      document.getElementById("systemUserPassword").value = "";
      setUserMessage("Edit the user and save to update the record.", true);
    });
  }

  if (systemRoleForm && canViewUsers) {
    systemRoleForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const response = await window.kumakhApi.saveSystemRole({
          roleId: document.getElementById("systemRoleId").value,
          roleName: document.getElementById("systemRoleName").value.trim(),
          description: document.getElementById("systemRoleDescription").value.trim(),
        });
        if (!response?.success) throw new Error(response?.message || "Unable to save role.");
        setRoleMessage(response.message || "Role saved.", true);
        systemRoleForm.reset();
        await loadAccessControl();
      } catch (error) {
        setRoleMessage(error.message);
      }
    });
    document.getElementById("clearSystemRoleButton")?.addEventListener("click", () => {
      systemRoleForm.reset();
      setRoleMessage("");
    });
    systemRolesBody?.addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit-system-role]");
      const deleteButton = event.target.closest("[data-delete-system-role]");
      if (editButton) {
        const role = systemRoles.find((item) => item["Role ID"] === editButton.dataset.editSystemRole);
        if (!role) return;
        document.getElementById("systemRoleId").value = role["Role ID"] || "";
        document.getElementById("systemRoleName").value = role["Role Name"] || "";
        document.getElementById("systemRoleDescription").value = role.Description || "";
      }
      if (deleteButton) {
        try {
          const response = await window.kumakhApi.deleteSystemRole({ roleId: deleteButton.dataset.deleteSystemRole });
          if (!response?.success) throw new Error(response?.message || "Unable to delete role.");
          await loadAccessControl();
        } catch (error) {
          setRoleMessage(error.message);
        }
      }
    });
    permissionTargetType?.addEventListener("change", renderPermissionTargets);
    permissionTargetId?.addEventListener("change", renderPermissionMatrix);
    savePermissionMatrixButton?.addEventListener("click", async () => {
      const targetId = permissionTargetId?.value || "";
      const targetType = permissionTargetType?.value || "role";
      try {
        const toggles = Array.from(permissionMatrixBody?.querySelectorAll(".permission-toggle") || []);
        await Promise.all(toggles.map((toggle) => window.kumakhApi.savePermissionAssignment({
          targetType,
          targetId,
          permissionKey: toggle.dataset.permissionKey,
          allowed: toggle.checked,
        })));
        setRoleMessage("Permissions saved successfully.", true);
        await loadAccessControl();
      } catch (error) {
        setRoleMessage(error.message);
      }
    });
    loadAccessControl();
  }

  }

  const settingsTabs = document.querySelectorAll("[data-settings-tab]");
  const settingsPanes = document.querySelectorAll("[data-settings-pane]");
  const userModal = document.getElementById("systemUserModal");
  const roleModal = document.getElementById("systemRoleModal");
  const permissionModal = document.getElementById("permissionModal");
  const accountModal = document.getElementById("accountModal");
  const permissionSearch = document.getElementById("permissionSearch");
  const permissionModalMessage = document.getElementById("permissionModalMessage");
  let permissionTarget = null;

  const showSettingsModal = (modal) => {
    if (!modal) return;
    modal.classList.remove("d-none");
    document.body.classList.add("modal-scroll-lock");
    window.setTimeout(() => modal.querySelector("input, select, button")?.focus(), 20);
  };
  const closeSettingsModal = (modal) => {
    if (!modal) return;
    modal.classList.add("d-none");
    if (!document.querySelector(".settings-modal:not(.d-none)")) document.body.classList.remove("modal-scroll-lock");
  };
  document.querySelectorAll("[data-close-settings-modal]").forEach((button) => button.addEventListener("click", () => closeSettingsModal(button.closest(".settings-modal"))));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.querySelectorAll(".settings-modal:not(.d-none)").forEach(closeSettingsModal); });
  settingsTabs.forEach((tab) => tab.addEventListener("click", () => {
    const target = tab.dataset.settingsTab;
    settingsTabs.forEach((item) => item.classList.toggle("active", item === tab));
    settingsPanes.forEach((pane) => pane.classList.toggle("active", pane.dataset.settingsPane === target));
  }));

  const isProtectedAdmin = (target) => String(target?.role || target?.["Role Name"] || "").toUpperCase() === "ADMIN" || String(target?.userId || "") === "USR-0001" || String(target?.username || "").toLowerCase() === "admin";
  const friendlyModule = (moduleName) => ({ cafe: "Café / POS", paymentout: "Payment Out", courses: "Courses" }[String(moduleName).toLowerCase()] || String(moduleName || "Other").replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const setUserMessageCompact = (text, success = false) => { const node = document.getElementById("systemUserMessage"); if (node) { node.textContent = text || ""; node.className = `small mt-2 ${text ? (success ? "text-success" : "text-danger") : ""}`; } };
  const setRoleMessageCompact = (text, success = false) => { const node = document.getElementById("systemRoleMessage"); if (node) { node.textContent = text || ""; node.className = `small mt-2 ${text ? (success ? "text-success" : "text-danger") : ""}`; } };
  const accessSummary = (user) => {
    if (isProtectedAdmin(user)) return "Full Access";
    const modules = [...new Set((user.permissions || []).map((key) => String(key).split(".")[0]))];
    return modules.length ? `${modules.length} Module${modules.length === 1 ? "" : "s"}` : "No access";
  };
  const renderUserRoleOptionsCompact = () => {
    const select = document.getElementById("systemUserRole"); const filter = document.getElementById("systemUserRoleFilter");
    const activeRoles = systemRoles.filter((role) => String(role.Status || "Active").toLowerCase() === "active");
    const options = activeRoles.map((role) => String(role["Role Name"] || "").toUpperCase()).filter(Boolean);
    if (select) select.innerHTML = options.map((role) => `<option value="${escapeStudentHtml(role)}">${escapeStudentHtml(role)}</option>`).join("");
    if (filter) { const selected = filter.value; filter.innerHTML = `<option value="">All roles</option>${options.map((role) => `<option value="${escapeStudentHtml(role)}">${escapeStudentHtml(role)}</option>`).join("")}`; filter.value = selected; }
  };
  const getFilteredUsers = () => {
    const search = String(document.getElementById("systemUserSearch")?.value || "").toLowerCase(); const role = document.getElementById("systemUserRoleFilter")?.value || ""; const status = document.getElementById("systemUserStatusFilter")?.value || "";
    return systemUsers.filter((user) => (!search || `${user.fullName} ${user.username}`.toLowerCase().includes(search)) && (!role || String(user.role).toUpperCase() === role) && (!status || String(user.status).toLowerCase() === status));
  };
  const renderUsersCompact = () => {
    const body = document.getElementById("systemUsersBody"); if (!body) return;
    const users = getFilteredUsers();
    body.innerHTML = users.length ? users.map((user) => { const protectedUser = isProtectedAdmin(user); return `<tr data-manage-system-user="${escapeStudentHtml(String(user.userId || ""))}"><td><div class="user-cell"><span class="user-avatar">${escapeStudentHtml(String(user.fullName || user.username || "?").slice(0, 1).toUpperCase())}</span><div><strong>${escapeStudentHtml(String(user.fullName || user.username || ""))}</strong><small>${escapeStudentHtml(String(user.username || ""))}</small></div></div></td><td><span class="role-pill">${escapeStudentHtml(String(user.role || ""))}</span></td><td><span class="status-badge ${String(user.status).toLowerCase() === "active" ? "is-active" : "is-inactive"}">${escapeStudentHtml(String(user.status || ""))}</span></td><td><span class="access-summary">${protectedUser ? '<i class="bi bi-lock-fill"></i> ' : ""}${escapeStudentHtml(accessSummary(user))}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-manage-system-user="${escapeStudentHtml(String(user.userId || ""))}">Manage Access</button><div class="dropdown d-inline-block"><button class="btn btn-sm btn-light border ms-1" data-user-menu="${escapeStudentHtml(String(user.userId || ""))}" title="More actions"><i class="bi bi-three-dots-vertical"></i></button><div class="settings-action-menu d-none" data-user-actions="${escapeStudentHtml(String(user.userId || ""))}"><button data-edit-system-user="${escapeStudentHtml(String(user.userId || ""))}">Edit User</button><button data-reset-system-user="${escapeStudentHtml(String(user.userId || ""))}">Reset Password</button>${protectedUser ? "" : `<button data-toggle-system-user="${escapeStudentHtml(String(user.userId || ""))}">${String(user.status).toLowerCase() === "active" ? "Disable User" : "Enable User"}</button><button class="danger" data-delete-system-user="${escapeStudentHtml(String(user.userId || ""))}">Delete User</button>`}</div></div></td></tr>`; }).join("") : '<tr><td colspan="5" class="text-muted text-center py-4">No users match these filters.</td></tr>';
  };
  const renderRolesCompact = () => { const body = document.getElementById("systemRolesBody"); if (!body) return; body.innerHTML = systemRoles.length ? systemRoles.map((role) => { const roleName = String(role["Role Name"] || "").toUpperCase(); const protectedRole = roleName === "ADMIN"; const active = String(role.Status || "Active").toLowerCase() === "active"; const count = systemUsers.filter((user) => String(user.role).toUpperCase() === roleName).length; return `<tr><td><span class="role-pill">${escapeStudentHtml(roleName)}</span></td><td>${escapeStudentHtml(String(role.Description || "—"))}</td><td>${count} User${count === 1 ? "" : "s"}</td><td><span class="status-badge ${active ? "is-active" : "is-inactive"}">${escapeStudentHtml(active ? "Active" : "Inactive")}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-manage-system-role="${escapeStudentHtml(String(role["Role ID"] || ""))}">${protectedRole ? "View Access" : "Edit Access"}</button>${protectedRole ? "" : `<button class="btn btn-sm btn-light border ms-1" data-edit-system-role="${escapeStudentHtml(String(role["Role ID"] || ""))}" title="Edit role"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-light border ms-1" data-toggle-system-role="${escapeStudentHtml(String(role["Role ID"] || ""))}">${active ? "Disable" : "Enable"}</button><button class="btn btn-sm btn-outline-danger ms-1" data-delete-system-role="${escapeStudentHtml(String(role["Role ID"] || ""))}">Delete</button>`}</td></tr>`; }).join("") : '<tr><td colspan="5" class="text-muted text-center py-4">No roles found.</td></tr>'; };
  const loadManagement = async () => { if (!canViewUsers || !window.kumakhApi) return; try { const [rolesResponse, permissionsResponse, usersResponse] = await Promise.all([window.kumakhApi.getRolesForAdmin({}), window.kumakhApi.getPermissionMatrix({}), window.kumakhApi.getUsersForAdmin({})]); if (!rolesResponse?.success || !permissionsResponse?.success || !usersResponse?.success) throw new Error(rolesResponse?.message || permissionsResponse?.message || usersResponse?.message || "Unable to load access management."); systemRoles = rolesResponse.data || []; permissionMatrix = permissionsResponse.data || permissionMatrix; systemUsers = usersResponse.data || []; document.getElementById("credentialsSection")?.classList.remove("d-none"); document.getElementById("accessControlSection")?.classList.remove("d-none"); renderUserRoleOptionsCompact(); renderUsersCompact(); renderRolesCompact(); } catch (error) { setUserMessageCompact(error.message); setRoleMessageCompact(error.message); } };
  const openUserForm = (user = null, reset = false) => { const form = document.getElementById("systemUserForm"); form.reset(); document.getElementById("systemUserId").value = user?.userId || ""; document.getElementById("systemUserEmployeeId").value = user?.employeeId || ""; document.getElementById("systemUserUsername").value = user?.username || ""; document.getElementById("systemUserFullName").value = user?.fullName || ""; document.getElementById("systemUserRole").value = user?.role || "CASHIER"; document.getElementById("systemUserStatus").value = user?.status || "Active"; const isNew = !user; document.getElementById("systemUserModalTitle").textContent = reset ? "Reset Password" : isNew ? "Create New User" : "Edit User"; document.getElementById("systemUserModalSubtitle").textContent = reset ? `Set a new password for ${user.fullName || user.username}.` : isNew ? "Create an account, then manage its permissions separately." : "Update account details and status."; document.getElementById("saveSystemUserButton").textContent = reset ? "Reset Password" : isNew ? "Create User" : "Save Changes"; document.getElementById("systemUserPassword").required = isNew || reset; document.getElementById("systemUserConfirmWrap").classList.toggle("d-none", !isNew && !reset); document.getElementById("systemUserPasswordHelp").textContent = isNew || reset ? "At least 6 characters." : "Leave blank to keep the current password."; showSettingsModal(userModal); };
  const getAllowedPermissions = () => { const target = permissionTarget; if (!target) return {}; if (isProtectedAdmin(target.item)) return Object.fromEntries((permissionMatrix.permissions || []).map((permission) => [permission["Permission Key"], true])); const source = target.type === "user" ? permissionMatrix.userPermissions : permissionMatrix.rolePermissions; const column = target.type === "user" ? "User ID" : "Role ID"; return Object.fromEntries(source.filter((row) => String(row[column]) === target.id).map((row) => [row["Permission Key"], String(row.Allowed).toLowerCase() === "true"])); };
  const renderPermissionModal = () => { const body = document.getElementById("permissionMatrixBody"); if (!body || !permissionTarget) return; const allowed = getAllowedPermissions(); const protectedTarget = isProtectedAdmin(permissionTarget.item); const groups = {}; (permissionMatrix.permissions || []).forEach((permission) => { const module = String(permission.Module || "other"); (groups[module] ||= []).push(permission); }); body.innerHTML = Object.entries(groups).map(([module, actions]) => { const keys = actions.map((item) => item["Permission Key"]); const enabled = keys.some((key) => allowed[key]); return `<section class="permission-module" data-permission-module="${escapeStudentHtml(module)}"><div class="permission-module-head"><div><h6>${escapeStudentHtml(friendlyModule(module))}</h6><small>Module access</small></div><label class="module-switch"><input type="checkbox" class="module-toggle" data-module="${escapeStudentHtml(module)}" ${enabled ? "checked" : ""} ${protectedTarget ? "disabled" : ""}><span></span><b>${enabled ? "Enabled" : "Disabled"}</b></label></div><div class="permission-actions">${actions.map((permission) => { const key = permission["Permission Key"]; const action = String(permission.Action || key.split(".")[1] || ""); const blocked = !protectedTarget && action !== "view" && !allowed[`${module}.view`]; return `<label class="permission-check"><input class="permission-toggle" type="checkbox" data-permission-key="${escapeStudentHtml(key)}" data-module="${escapeStudentHtml(module)}" data-action="${escapeStudentHtml(action)}" ${allowed[key] ? "checked" : ""} ${protectedTarget || blocked ? "disabled" : ""}><span>${escapeStudentHtml(action.replace(/\b\w/g, (letter) => letter.toUpperCase()))}</span></label>`; }).join("")}</div></section>`; }).join(""); body.querySelectorAll(".permission-toggle").forEach((toggle) => toggle.addEventListener("change", () => { const moduleSelector = CSS.escape(toggle.dataset.module); const actions = [...body.querySelectorAll(`.permission-toggle[data-module="${moduleSelector}"]`)]; if (!toggle.checked && toggle.dataset.action === "view") actions.filter((item) => item.dataset.action !== "view").forEach((item) => { item.checked = false; item.disabled = true; }); if (toggle.checked && toggle.dataset.action !== "view") { const view = body.querySelector(`.permission-toggle[data-module="${moduleSelector}"][data-action="view"]`); if (view) { view.checked = true; actions.filter((item) => item.dataset.action !== "view").forEach((item) => { item.disabled = false; }); } } if (toggle.checked && toggle.dataset.action === "view") actions.filter((item) => item.dataset.action !== "view").forEach((item) => { item.disabled = false; }); const moduleToggle = body.querySelector(`.module-toggle[data-module="${moduleSelector}"]`); if (moduleToggle) { moduleToggle.checked = actions.some((item) => item.checked); moduleToggle.nextElementSibling?.nextElementSibling && (moduleToggle.nextElementSibling.nextElementSibling.textContent = moduleToggle.checked ? "Enabled" : "Disabled"); } })); body.querySelectorAll(".module-toggle").forEach((toggle) => toggle.addEventListener("change", () => { body.querySelectorAll(`.permission-toggle[data-module="${CSS.escape(toggle.dataset.module)}"]`).forEach((action) => { action.checked = toggle.checked; action.disabled = !toggle.checked && action.dataset.action !== "view"; }); toggle.nextElementSibling?.nextElementSibling && (toggle.nextElementSibling.nextElementSibling.textContent = toggle.checked ? "Enabled" : "Disabled"); })); filterPermissions(); };
  const filterPermissions = () => { const query = String(permissionSearch?.value || "").trim().toLowerCase(); document.querySelectorAll(".permission-module").forEach((module) => { module.hidden = Boolean(query) && !module.textContent.toLowerCase().includes(query); }); };
  const openPermissionModal = (type, item) => { permissionTarget = { type, item, id: type === "user" ? item.userId : item["Role ID"] }; const protectedTarget = isProtectedAdmin(item); document.getElementById("permissionModalTitle").textContent = protectedTarget ? "Full System Access" : "Manage Permissions"; document.getElementById("permissionModalMeta").textContent = type === "user" ? `${item.fullName || item.username} • ${item.role} • ${item.status} • ${accessSummary(item)}` : `${item["Role Name"]} • ${item.Description || "Access role"}${protectedTarget ? " • Full Access" : ""}`; document.getElementById("savePermissionMatrixButton").classList.toggle("d-none", protectedTarget); document.getElementById("selectAllPermissions").disabled = protectedTarget; document.getElementById("clearAllPermissions").disabled = protectedTarget; permissionSearch.value = ""; permissionModalMessage.textContent = protectedTarget ? "The administrator always retains unrestricted access." : ""; renderPermissionModal(); showSettingsModal(permissionModal); };
  document.getElementById("addSystemUserButton")?.addEventListener("click", () => openUserForm()); document.getElementById("addSystemRoleButton")?.addEventListener("click", () => { document.getElementById("systemRoleForm").reset(); document.getElementById("systemRoleId").value = ""; document.getElementById("systemRoleModalTitle").textContent = "Create Role"; showSettingsModal(roleModal); });
  ["systemUserSearch", "systemUserRoleFilter", "systemUserStatusFilter"].forEach((id) => document.getElementById(id)?.addEventListener(id === "systemUserSearch" ? "input" : "change", renderUsersCompact));
  document.getElementById("systemUsersBody")?.addEventListener("click", async (event) => { const action = event.target.closest("button"); if (!action) { const rowId = event.target.closest("tr")?.dataset.manageSystemUser; const rowUser = systemUsers.find((item) => String(item.userId) === String(rowId)); if (rowUser) openPermissionModal("user", rowUser); return; } const id = action.dataset.manageSystemUser || action.dataset.editSystemUser || action.dataset.resetSystemUser || action.dataset.toggleSystemUser || action.dataset.deleteSystemUser || action.dataset.userMenu; const user = systemUsers.find((item) => String(item.userId) === String(id)); if (!user) return; if (action.dataset.userMenu) { document.querySelectorAll("[data-user-actions]").forEach((menu) => menu.classList.add("d-none")); document.querySelector(`[data-user-actions="${CSS.escape(id)}"]`)?.classList.toggle("d-none"); return; } if (action.dataset.manageSystemUser) return openPermissionModal("user", user); if (action.dataset.editSystemUser) return openUserForm(user); if (action.dataset.resetSystemUser) return openUserForm(user, true); if (action.dataset.toggleSystemUser) { if (!await window.kumakhDialogs.confirm(`Are you sure you want to ${String(user.status).toLowerCase() === "active" ? "disable" : "enable"} ${user.fullName || user.username}?`)) return; try { const response = await window.kumakhApi.saveSystemUser({ userId: user.userId, username: user.username, fullName: user.fullName, employeeId: user.employeeId || "", role: user.role, status: String(user.status).toLowerCase() === "active" ? "Inactive" : "Active" }); if (!response?.success) throw new Error(response?.message || "Unable to update user."); setUserMessageCompact(response.message, true); await loadManagement(); } catch (error) { setUserMessageCompact(error.message); } return; } if (action.dataset.deleteSystemUser) { if (!await window.kumakhDialogs.confirm(`Delete ${user.fullName || user.username}? This cannot be undone.`)) return; try { const response = await window.kumakhApi.deleteSystemUser({ userId: user.userId }); if (!response?.success) throw new Error(response?.message || "Unable to delete user."); setUserMessageCompact(response.message, true); await loadManagement(); } catch (error) { setUserMessageCompact(error.message); } } });
  document.getElementById("systemUserForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const id = document.getElementById("systemUserId").value; const password = document.getElementById("systemUserPassword").value; const confirm = document.getElementById("systemUserConfirmPassword").value; if ((!id || confirm) && password !== confirm) return setUserMessageCompact("Passwords do not match."); const button = document.getElementById("saveSystemUserButton"); button.disabled = true; try { const response = await window.kumakhApi.saveSystemUser({ userId: id, username: document.getElementById("systemUserUsername").value.trim(), password, fullName: document.getElementById("systemUserFullName").value.trim(), employeeId: document.getElementById("systemUserEmployeeId").value.trim(), role: document.getElementById("systemUserRole").value, status: document.getElementById("systemUserStatus").value }); if (!response?.success) throw new Error(response?.message || "Unable to save user."); closeSettingsModal(userModal); setUserMessageCompact(response.message, true); await loadManagement(); } catch (error) { setUserMessageCompact(error.message); } finally { button.disabled = false; } });
  document.getElementById("systemRolesBody")?.addEventListener("click", async (event) => { const action = event.target.closest("button"); if (!action) return; const id = action.dataset.manageSystemRole || action.dataset.editSystemRole || action.dataset.toggleSystemRole || action.dataset.deleteSystemRole; const role = systemRoles.find((item) => String(item["Role ID"]) === String(id)); if (!role) return; if (action.dataset.manageSystemRole) return openPermissionModal("role", role); try { if (action.dataset.deleteSystemRole) { if (!await window.kumakhDialogs.confirm(`Delete the ${role["Role Name"]} role?`)) return; const response = await window.kumakhApi.deleteSystemRole({ roleId: id }); if (!response?.success) throw new Error(response?.message || "Unable to delete role."); await loadManagement(); return; } if (action.dataset.toggleSystemRole) { const response = await window.kumakhApi.saveSystemRole({ roleId: id, roleName: role["Role Name"], description: role.Description || "", status: String(role.Status || "Active").toLowerCase() === "active" ? "Inactive" : "Active" }); if (!response?.success) throw new Error(response?.message || "Unable to update role status."); await loadManagement(); return; } document.getElementById("systemRoleForm").reset(); document.getElementById("systemRoleId").value = role["Role ID"] || ""; document.getElementById("systemRoleName").value = role["Role Name"] || ""; document.getElementById("systemRoleDescription").value = role.Description || ""; document.getElementById("systemRoleStatus").value = role.Status || "Active"; document.getElementById("systemRoleModalTitle").textContent = "Edit Role"; showSettingsModal(roleModal); } catch (error) { setRoleMessageCompact(error.message); } });
  document.getElementById("systemRoleForm")?.addEventListener("submit", async (event) => { event.preventDefault(); try { const response = await window.kumakhApi.saveSystemRole({ roleId: document.getElementById("systemRoleId").value, roleName: document.getElementById("systemRoleName").value.trim(), description: document.getElementById("systemRoleDescription").value.trim(), status: document.getElementById("systemRoleStatus").value }); if (!response?.success) throw new Error(response?.message || "Unable to save role."); closeSettingsModal(roleModal); setRoleMessageCompact(response.message, true); await loadManagement(); } catch (error) { setRoleMessageCompact(error.message); } });
  permissionSearch?.addEventListener("input", filterPermissions); document.getElementById("selectAllPermissions")?.addEventListener("click", () => { document.querySelectorAll(".permission-toggle").forEach((item) => { item.checked = true; }); document.querySelectorAll(".module-toggle").forEach((item) => { item.checked = true; item.nextElementSibling?.nextElementSibling && (item.nextElementSibling.nextElementSibling.textContent = "Enabled"); }); }); document.getElementById("clearAllPermissions")?.addEventListener("click", () => { document.querySelectorAll(".permission-toggle, .module-toggle").forEach((item) => { item.checked = false; }); document.querySelectorAll(".module-toggle").forEach((item) => { item.nextElementSibling?.nextElementSibling && (item.nextElementSibling.nextElementSibling.textContent = "Disabled"); }); });
  document.getElementById("savePermissionMatrixButton")?.addEventListener("click", async () => { if (!permissionTarget) return; const button = document.getElementById("savePermissionMatrixButton"); button.disabled = true; try { await Promise.all([...document.querySelectorAll("#permissionMatrixBody .permission-toggle")].map((toggle) => window.kumakhApi.savePermissionAssignment({ targetType: permissionTarget.type, targetId: permissionTarget.id, permissionKey: toggle.dataset.permissionKey, allowed: toggle.checked }))); permissionModalMessage.textContent = "Permissions saved successfully."; permissionModalMessage.className = "small me-auto text-success"; await loadManagement(); } catch (error) { permissionModalMessage.textContent = error.message; permissionModalMessage.className = "small me-auto text-danger"; } finally { button.disabled = false; } });
  if (accountSection && isAdmin && session) { accountSection.classList.remove("d-none"); const syncAccount = () => { document.getElementById("accountUsernameText").textContent = session.username || "—"; document.getElementById("accountFullNameText").textContent = session.fullName || "—"; }; syncAccount(); const openAccount = (passwordMode) => { document.getElementById("accountForm").reset(); document.getElementById("accountProfileFields").classList.toggle("d-none", passwordMode); document.getElementById("accountPasswordFields").classList.toggle("d-none", !passwordMode); document.getElementById("accountModalTitle").textContent = passwordMode ? "Change Password" : "Edit Profile"; document.getElementById("accountModalSubtitle").textContent = passwordMode ? "Confirm your current password before choosing a new one." : "Update your username and full name."; document.getElementById("accountModalUsername").value = session.username || ""; document.getElementById("accountModalFullName").value = session.fullName || ""; accountModal.dataset.passwordMode = String(passwordMode); showSettingsModal(accountModal); }; document.getElementById("editMyProfileButton")?.addEventListener("click", () => openAccount(false)); document.getElementById("changeMyPasswordButton")?.addEventListener("click", () => openAccount(true)); document.getElementById("accountForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const passwordMode = accountModal.dataset.passwordMode === "true"; const newPassword = document.getElementById("accountNewPassword").value; if (passwordMode && (!document.getElementById("accountCurrentPassword").value || !newPassword || newPassword !== document.getElementById("accountConfirmPassword").value)) { document.getElementById("accountMessage").textContent = "Enter your current password and matching new password."; document.getElementById("accountMessage").className = "small mt-3 text-danger"; return; } try { const response = await window.kumakhApi.saveSystemUser({ userId: session.userId, username: passwordMode ? session.username : document.getElementById("accountModalUsername").value.trim(), fullName: passwordMode ? session.fullName : document.getElementById("accountModalFullName").value.trim(), employeeId: session.employeeId || "", role: "ADMIN", status: "Active", password: passwordMode ? newPassword : "", currentPassword: passwordMode ? document.getElementById("accountCurrentPassword").value : "" }); if (!response?.success) throw new Error(response?.message || "Unable to update account."); if (!passwordMode) { session.username = document.getElementById("accountModalUsername").value.trim(); session.fullName = document.getElementById("accountModalFullName").value.trim(); window.sessionStorage.setItem("kumakhSession", JSON.stringify(session)); syncAccount(); } closeSettingsModal(accountModal); document.getElementById("accountMessage").textContent = passwordMode ? "Password changed successfully." : "Profile updated successfully."; document.getElementById("accountMessage").className = "small mt-3 text-success"; } catch (error) { document.getElementById("accountMessage").textContent = error.message; document.getElementById("accountMessage").className = "small mt-3 text-danger"; } }); }
  if (canViewUsers) loadManagement();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (!apiUrlInput || !window.kumakhApi) {
        throw new Error("Database connection is not available.");
      }
      await window.kumakhApi.setApiUrl(apiUrlInput.value, document.getElementById("reportsTokenInput")?.value);
      if (document.getElementById("reportsTokenInput")) document.getElementById("reportsTokenInput").value = "";
      message.className = "small text-success";
      message.textContent = "Report destination saved successfully.";
    } catch (error) {
      message.className = "small text-danger";
      message.textContent = error.message;
    }
  });
};

function attachNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      if (page === "cafe") {
        window.location.href = PAGE_MAP.cafe;
        return;
      }

      if (!page) {
        return;
      }

      const workspaceTitle = document.getElementById("workspaceTitle");
      if (workspaceTitle) {
        workspaceTitle.textContent =
          button.textContent.trim() || "College Operations";
      }

      loadPage(page);
    });
  });

  // ----------------------------------------------------------
  // BACK TO DASHBOARD
  // ----------------------------------------------------------

  const backButton = document.getElementById("backButton");

  if (backButton) {
    backButton.addEventListener("click", () => {
      loadPage("dashboard");
    });
  }
}

function initializeSidebarToggle() {
  const sidebar = document.getElementById("appSidebar");
  const toggle = document.getElementById("sidebarLogoToggle");
  if (!sidebar || !toggle || toggle.dataset.ready === "true") {
    return;
  }

  toggle.dataset.ready = "true";
  document.querySelectorAll(".nav-item").forEach((button) => {
    const label = button.textContent.trim();
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  });
  sidebar.classList.remove("is-collapsed");
  localStorage.removeItem("kumakhSidebarCollapsed-v2");
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "College navigation");
  toggle.setAttribute("title", "College navigation");
}

function initializeLogout() {
  const logoutButton = document.getElementById("logoutButton");
  if (!logoutButton || logoutButton.dataset.ready === "true") return;

  logoutButton.dataset.ready = "true";
  logoutButton.addEventListener("click", () => {
    window.sessionStorage.removeItem("kumakhSession");
    window.location.href = "login.html";
  });
}

// ============================================================
// APPLICATION START
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  applyAppearancePreferences();

  initializeSidebarToggle();
  initializeLogout();

  const authenticated = applySessionState();

  let splashDismissed = false;
  let splashFailsafe;
  const hideSplash = () => {
    const splash = document.getElementById("appSplash");
    if (!splash || splashDismissed) return;
    splashDismissed = true;
    window.clearTimeout(splashFailsafe);
    splash.classList.add("is-hidden");
    if (splash.tagName === "DIALOG" && splash.open) {
      splash.close();
    }
    window.setTimeout(() => {
      if (splash.isConnected) splash.remove();
    }, 520);
  };
  const dismissSplash = () => {
    const splash = document.getElementById("appSplash");
    if (!splash || splashDismissed) return;
    hideSplash();
  };
  splashFailsafe = window.setTimeout(hideSplash, 8000);

  if (!authenticated) {
    dismissSplash();
    return;
  }

  attachNavigation();
  applyRoleNavigation();

  await loadPage("dashboard");

  dismissSplash();
});
