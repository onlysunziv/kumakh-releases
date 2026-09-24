const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
test('payment form matches student ID and refreshes totals and voucher after successive saves', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', style: {}, dataset: {}, classList: { add() {}, remove() {} }, showModal() {}, close() {}, reset() {}, addEventListener() {} });
    return elements.get(id);
  };
  const student = { registration_number: 'KCMT-033', full_name: 'SANJU KC', id: 'student-1', 'Student ID': 'student-1', course_name: 'PIZZA', registration_fee: 1000, training_course_fee: 18000 };
  const payments = [{ student_id: 'student-1', amount: 9000 }, { student_id: 'other', amount: 7000 }];
  const receipts = [];
  const context = vm.createContext({
    document: { getElementById: element },
    window: { KumakhVouchers: { studentReceipt: data => receipts.push(data) } },
    initializePaymentTypeSelector() {}, initializeCustomerDueSection: async () => {},
    escapeStudentHtml: String, formatNepaliCurrency: String,
    getStudents: async () => ({ success: true, data: [student] }),
    getStudentPayments: async () => ({ success: true, data: payments.map(row => ({ ...row })) }),
    saveStudentPayment: async payload => {
      assert.equal(payload.studentId, 'student-1');
      payments.push({ student_id: payload.studentId, amount: payload.amount });
      return { success: true, data: { id: 'receipt-1', amount: payload.amount, course_fee: 19000, total_paid: payments.filter(row => row.student_id === 'student-1').reduce((sum, row) => sum + row.amount, 0) } };
    }, console,
  });
  const source = fs.readFileSync(path.join(__dirname, '../frontend/js/app.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('async function initializePaymentsPage()'), source.indexOf('async function initializeCustomerDueSection')), context);
  await context.initializePaymentsPage();
  element('paymentStudent').value = 'SANJU KC';
  element('paymentStudent').oninput();
  assert.equal(element('paymentTotalPaid').value, '9000.00');
  element('paymentAmount').value = '1000';
  await element('studentPaymentForm').onsubmit({ preventDefault() {} });
  assert.equal(receipts[0].alreadyPaid, 9000);
  assert.equal(receipts[0].totalPaid, 10000);
  assert.equal(receipts[0].dueAmount, 9000);
  assert.equal(receipts[0].paymentId, 'receipt-1');
  element('paymentStudent').value = 'KCMT-033';
  element('paymentStudent').oninput();
  assert.equal(element('paymentTotalPaid').value, '10000.00');
  await element('studentPaymentForm').onsubmit({ preventDefault() {} });
  assert.equal(receipts[1].alreadyPaid, 10000);
  assert.equal(receipts[1].totalPaid, 11000);
  assert.equal(element('paymentTotalPaid').value, '11000.00');
});

