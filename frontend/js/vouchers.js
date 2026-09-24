(function () {
  if (window.KumakhVouchers) return;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const number = (value) => Number(String(value ?? 0).replace(/,/g, "")) || 0;
  const money = (value) => `NPR ${number(value).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (value) => { const valueDate = value ? new Date(value) : new Date(); return Number.isNaN(valueDate.valueOf()) ? String(value || "—") : valueDate.toLocaleDateString("en-GB"); };
  const amountWords = (value) => { const n = Math.floor(number(value)); if (!n) return "Zero rupees only."; const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]; const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]; const words = (x) => x < 20 ? ones[x] : x < 100 ? `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ""}` : x < 1000 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${words(x % 100)}` : ""}` : x < 100000 ? `${words(Math.floor(x / 1000))} Thousand${x % 1000 ? ` ${words(x % 1000)}` : ""}` : x < 10000000 ? `${words(Math.floor(x / 100000))} Lakh${x % 100000 ? ` ${words(x % 100000)}` : ""}` : `${words(Math.floor(x / 10000000))} Crore${x % 10000000 ? ` ${words(x % 10000000)}` : ""}`; return `${words(n)} rupees only.`; };
  const shell = ({ title, number: documentNumber, date: documentDate, body, cafe = false, className = "" }) => { const overlay = document.createElement("section"); overlay.className = "kumakh-voucher-overlay"; overlay.innerHTML = `<div class="kumakh-voucher__actions"><button class="btn btn-primary btn-sm" type="button" data-print>Print</button><button class="btn btn-outline-secondary btn-sm" type="button" data-close>Close</button></div><article class="kumakh-voucher ${cafe ? "kumakh-cafe-receipt" : ""} ${className}"><header class="kumakh-voucher__head"><div class="kumakh-voucher__brand"><img src="./assets/kumakh-logo.png" alt="Kumakh College"><div><b>${cafe ? "KCMT CAFE" : "KUMAKH COLLEGE"}</b><small>TULSIPUR 5, BP CHWOK DANG</small><small>Contact: 082-590291, 523473 / 9845016712</small></div></div><div class="kumakh-voucher__number">${escapeHtml(cafe ? "Receipt No." : "Document No.")}<b>${escapeHtml(documentNumber || "—")}</b><span>${escapeHtml(date(documentDate))}</span></div></header><div class="kumakh-voucher__title"><h2>${escapeHtml(title)}</h2></div>${body}</article>`; document.body.appendChild(overlay); overlay.querySelector("[data-print]").onclick = () => window.print(); overlay.querySelector("[data-close]").onclick = () => overlay.remove(); return overlay; };
  const studentReceipt = (data) => shell({ title: "Fee Collection Receipt", number: data.paymentId || data.paymentID || `KCMT-FEE-${Date.now()}`, date: data.paymentDate, body: `<div class="kumakh-voucher__grid"><div class="kumakh-voucher__card"><div class="kumakh-voucher__label">Received from</div><strong>${escapeHtml(data.studentName)}</strong><p>Reg. No.: ${escapeHtml(data.studentId)}</p><p>Program: ${escapeHtml(data.course || "—")}</p></div><div class="kumakh-voucher__card"><div class="kumakh-voucher__label">Payment information</div><p>Date: <strong>${escapeHtml(date(data.paymentDate))}</strong></p><p>Payment mode: <strong>${escapeHtml(data.paymentMode || "Cash")}</strong></p><p>Fee type: <strong>${escapeHtml(data.paymentType || "Course Fee")}</strong></p></div></div><table><thead><tr><th>#</th><th>Particulars</th><th class="num">Amount (NPR)</th></tr></thead><tbody><tr><td>1</td><td>${escapeHtml(data.paymentType || "Course Fee")}</td><td class="num">${money(data.amount)}</td></tr></tbody></table><div class="kumakh-voucher__bottom"><div class="kumakh-voucher__summary"><div><span>Remarks</span><strong>${escapeHtml(data.remarks || "—")}</strong></div><div><span>Total fee</span><strong>${money(data.totalFee)}</strong></div><div><span>Already paid before this receipt</span><strong>${money(data.alreadyPaid)}</strong></div><div><span>Total paid to date</span><strong>${money(data.totalPaid)}</strong></div><div><span>Remaining due</span><strong>${money(data.dueAmount)}</strong></div><div class="total"><span>Received this payment</span><strong>${money(data.amount)}</strong></div></div><div class="kumakh-voucher__summary"><div class="kumakh-voucher__label">Receipt note</div><div>This receipt confirms the fee payment received by Kumakh College.</div></div></div><div class="kumakh-voucher__words"><strong>Amount in words:</strong> ${escapeHtml(amountWords(data.amount))}</div><div class="kumakh-voucher__signatures"><span>Received by (Accounts)</span><span>Authorised signature</span></div>` });
  let cafeTemplatePromise;
  const cafeReceipt = async (data) => {
    if (!cafeTemplatePromise) {
      const templatePath = window.location.pathname.includes("/pages/")
        ? "../pages/voucher.html"
        : "./pages/voucher.html";
      const loadTemplateFromUrl = () => fetch(new URL(templatePath, window.location.href).href, { cache: "no-cache" }).then((response) => {
          if (!response.ok) throw new Error(`Unable to load café bill template (${response.status}).`);
          return response.text();
        });
      cafeTemplatePromise = (window.kumakhApp && typeof window.kumakhApp.readPage === "function"
        ? window.kumakhApp.readPage("voucher.html").catch(() => loadTemplateFromUrl())
        : loadTemplateFromUrl())
        .then((html) => {
          const parsed = new DOMParser().parseFromString(html, "text/html");
          const template = parsed.querySelector(".cafe-voucher");
          if (!template) throw new Error("The café bill template does not contain a café voucher.");
          return template;
        })
        .catch((error) => {
          cafeTemplatePromise = null;
          throw error;
        });
    }
    const template = (await cafeTemplatePromise).cloneNode(true);
    template.classList.add("kumakh-voucher", "kumakh-cafe-receipt");
    const setText = (selector, value) => {
      const element = template.querySelector(selector);
      if (element) element.textContent = value;
    };
    setText(".document-number strong", data.receiptId || data["Receipt ID"] || data.saleId || data.saleID || `CAFE-${Date.now()}`);
    const meta = template.querySelectorAll(".cafe-meta-row span:last-child");
    [date(data.saleDate), data.cashier || "—", data.tableNo ? `Dine-in · ${data.tableNo}` : "Takeaway"].forEach((value, index) => {
      if (meta[index]) meta[index].textContent = value;
    });
    const customer = template.querySelector(".cafe-customer");
    if (customer) customer.textContent = data.customerName || "Walk-in";
    const tbody = template.querySelector(".table-area tbody");
    if (tbody) {
      tbody.innerHTML = (data.items || []).map((item) => `<tr><td>${escapeHtml(item.name)}<br><small>@ ${number(item.price).toFixed(2)}</small></td><td class="text-end">${escapeHtml(item.qty)}</td><td class="text-end">${(number(item.price) * number(item.qty)).toFixed(2)}</td></tr>`).join("") || '<tr><td colspan="3">No items found.</td></tr>';
    }
    const summaryLabels = template.querySelectorAll('.summary-row > span:first-child');
    if (summaryLabels[1]) summaryLabels[1].textContent = 'Discount';
    if (summaryLabels[2]) summaryLabels[2].textContent = 'VAT (13% incl.)';
    const summaryValues = [
      data.subtotal, data.discountAmount || 0, data.vatAmount || 0,
      data.total, data.tenderedAmount || 0, data.dueAmount || 0, data.changeAmount || 0,
    ].map((value) => money(value));
    template.querySelectorAll(".summary-row > span:last-child, .grand-total strong, .payment-value").forEach((element, index) => {
      if (summaryValues[index]) element.textContent = summaryValues[index];
    });
    const wrapper = document.createElement("section");
    wrapper.className = "kumakh-voucher-overlay";
    wrapper.innerHTML = '<div class="kumakh-voucher__actions"><button class="btn btn-primary btn-sm" type="button" data-print>Print</button><button class="btn btn-outline-secondary btn-sm" type="button" data-close>Close</button></div>';
    wrapper.appendChild(template);
    document.body.appendChild(wrapper);
    wrapper.querySelector("[data-print]").onclick = () => {
      requestAnimationFrame(() => window.print());
    };
    wrapper.querySelector("[data-close]").onclick = () => wrapper.remove();
    return wrapper;
  };
  let purchaseTemplatePromise;
  const purchaseInvoice = async (data, { display = true } = {}) => {
    if (!purchaseTemplatePromise) {
      const templatePath = window.location.pathname.includes("/pages/")
        ? "../pages/voucher.html"
        : "./pages/voucher.html";
      const loadTemplate = () =>
        fetch(new URL(templatePath, window.location.href).href, {
          cache: "no-cache",
        }).then((response) => {
          if (!response.ok) {
            throw new Error(`Unable to load purchase voucher template (${response.status}).`);
          }
          return response.text();
        });
      purchaseTemplatePromise = (
        window.kumakhApp && typeof window.kumakhApp.readPage === "function"
          ? window.kumakhApp.readPage("voucher.html").catch(() => loadTemplate())
          : loadTemplate()
      )
        .then((html) => {
          const parsed = new DOMParser().parseFromString(html, "text/html");
          const template = parsed.querySelector(".purchase-voucher");
          if (!template) {
            throw new Error("The voucher template does not contain a purchase voucher.");
          }
          return {
            template,
            styles: [...parsed.querySelectorAll("style")].map((style) => style.textContent).join("\n"),
          };
        })
        .catch((error) => {
          purchaseTemplatePromise = null;
          throw error;
        });
    }

    const { template: source, styles } = await purchaseTemplatePromise;
    const template = source.cloneNode(true);
    const setText = (selector, value) => {
      const element = template.querySelector(selector);
      if (element) element.textContent = value;
    };
    const formatDate = date(data.purchaseDate);
    const formatMoney = (value) => number(value).toLocaleString("en-NP", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const amountValue = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const grandTotal = Math.max(0, amountValue(data.grandTotal));
    const paidAmount = Math.min(
      grandTotal,
      Math.max(0, amountValue(data.paidAmount)),
    );
    const dueAmount = Number((grandTotal - paidAmount).toFixed(2));

    setText(".document-title h2", "Purchase Voucher");
    setText(".document-number strong", `${data.purchaseId || data.billId || "—"} · ${formatDate}`);
    setText(".vendor-card .info-name", data.vendorName || "—");
    const vendorDetails = template.querySelectorAll(".vendor-card p");
    if (vendorDetails[0]) vendorDetails[0].textContent = data.address || "—";
    if (vendorDetails[1]) vendorDetails[1].textContent = `PAN: ${data.panVat || "—"}`;
    if (vendorDetails[2]) vendorDetails[2].textContent = data.contact || "—";
    const referenceDetails = template.querySelectorAll(".reference-card p");
    if (referenceDetails[0]) referenceDetails[0].textContent = `Purchase ID: ${data.purchaseId || data.billId || "—"}`;
    if (referenceDetails[1]) referenceDetails[1].textContent = `Invoice: ${data.invoiceNo || "—"}`;
    if (referenceDetails[2]) referenceDetails[2].textContent = `Purchase date: ${formatDate}`;
    if (referenceDetails[3]) referenceDetails[3].textContent = `Status: ${data.paymentStatus || "—"}`;

    const body = template.querySelector(".voucher-table tbody");
    if (body) {
      body.innerHTML = (data.items || []).map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name || "—")}</td>
          <td class="text-end">${escapeHtml(item.quantity)}</td>
          <td class="text-end">${escapeHtml(item.unit || "—")}</td>
          <td class="text-end">${formatMoney(item.unitPrice)}</td>
          <td class="text-end">${formatMoney(item.discount || 0)}</td>
          <td class="text-end">${formatMoney(item.amount)}</td>
        </tr>
      `).join("") || '<tr><td colspan="7">No purchase items found.</td></tr>';
    }

    const paymentValues = [
      data.paymentMethod || "—",
      data.invoiceNo || "—",
      data.paymentStatus || "—",
    ];
    template.querySelectorAll(".payment-row .payment-value").forEach((element, index) => {
      if (paymentValues[index] !== undefined) element.textContent = paymentValues[index];
    });
    const summaryValues = [
      formatMoney(data.subtotal),
      formatMoney(data.discount),
      formatMoney(data.tax),
      formatMoney(paidAmount),
      formatMoney(dueAmount),
    ];
    template.querySelectorAll(".summary-row span:last-child").forEach((element, index) => {
      if (summaryValues[index] !== undefined) element.textContent = summaryValues[index];
    });
    const grandTotalElement = template.querySelector(".grand-total strong");
    if (grandTotalElement) grandTotalElement.textContent = `Rs ${formatMoney(grandTotal)}`;
    const remarks = template.querySelector("[data-purchase-remarks]");
    if (remarks) remarks.textContent = data.remarks || "—";

    const wrapper = document.createElement("section");
    wrapper.className = "kumakh-voucher-overlay";
    const style = document.createElement("style");
    style.textContent = styles;
    wrapper.appendChild(style);
    wrapper.innerHTML += '<div class="kumakh-voucher__actions"><button class="btn btn-primary btn-sm" type="button" data-print>Print</button><button class="btn btn-outline-secondary btn-sm" type="button" data-close>Close</button></div>';
    wrapper.appendChild(template);
    const logo = wrapper.querySelector(".college-logo");
    if (logo) logo.src = "./assets/kumakh-logo.png";
    if (display) {
      document.body.appendChild(wrapper);
      wrapper.querySelector("[data-print]").onclick = () => window.print();
      wrapper.querySelector("[data-close]").onclick = () => wrapper.remove();
    }
    return wrapper;
  };
  const paymentVoucher = (data) => {
    const payeeName = data.payeeName || data.employeeName || data.staffName || "—";
    const payeeId = data.payeeId || data.employeeId || data.staffId || "—";
    const payroll = data.payrollDetails;
    const details = payroll
      ? `<tr><td>Payroll month</td><td class="num">${escapeHtml(payroll.payrollMonth || "—")}</td></tr><tr><td>Designation</td><td class="num">${escapeHtml(payroll.designation || "—")}</td></tr><tr><td>Basic salary</td><td class="num">${money(payroll.basicSalary)}</td></tr><tr><td>Days worked</td><td class="num">${escapeHtml(payroll.daysWorked)}</td></tr><tr><td>Earned salary</td><td class="num">${money(payroll.earnedSalary)}</td></tr><tr><td>Bonus</td><td class="num">${money(payroll.bonus)}</td></tr><tr><td>Allowance</td><td class="num">${money(payroll.allowance)}</td></tr><tr><td>Total earning</td><td class="num">${money(payroll.totalEarning)}</td></tr><tr><td>Deduction</td><td class="num">${money(payroll.deduction)}</td></tr><tr><td>TDS</td><td class="num">${money(payroll.tds)}</td></tr><tr><td><strong>Net salary</strong></td><td class="num"><strong>${money(payroll.netSalary)}</strong></td></tr><tr><td><strong>Amount paid</strong></td><td class="num"><strong>${money(payroll.totalPaid)}</strong></td></tr><tr><td><strong>Amount due</strong></td><td class="num"><strong>${money(payroll.dueSalary)}</strong></td></tr>`
      : `<tr><td>Previous outstanding</td><td class="num">${money(data.previousDue)}</td></tr><tr><td><strong>Amount paid</strong></td><td class="num"><strong>${money(data.paidAmount)}</strong></td></tr>${number(data.advanceAmount) ? `<tr><td><strong>Staff advance recorded</strong></td><td class="num"><strong>${money(data.advanceAmount)}</strong></td></tr>` : ""}<tr><td>Remaining outstanding</td><td class="num">${money(data.remainingDue)}</td></tr>`;
    const totalLabel = payroll ? "Net salary" : "Total paid";
    const totalValue = payroll ? payroll.netSalary : data.paidAmount;
    return shell({ title: payroll ? "Salary Payroll Voucher" : "Payment Voucher", className: payroll ? "kumakh-salary-voucher kumakh-payment-voucher" : "kumakh-payment-voucher", number: data.voucherNo || `KCMT-PV-${Date.now()}`, date: data.paymentDate, body: `<div class="kumakh-voucher__grid"><div class="kumakh-voucher__card"><div class="kumakh-voucher__label">Paid to · ${escapeHtml(data.paymentType || "Payment out")}</div><strong>${escapeHtml(payeeName)}</strong><p>Staff ID: ${escapeHtml(payeeId)}</p>${data.panVatNo ? `<p>PAN/VAT: ${escapeHtml(data.panVatNo)}</p>` : ""}</div><div class="kumakh-voucher__card"><div class="kumakh-voucher__label">Reference</div><p>Payment method: <strong>${escapeHtml(data.paymentMethod || "—")}</strong></p><p>Payment date: <strong>${escapeHtml(date(data.paymentDate))}</strong></p><p>Status: <strong>Paid</strong></p></div></div><div class="kumakh-salary-voucher__section-title">Salary calculation</div><table class="kumakh-salary-voucher__table"><thead><tr><th>Description</th><th class="num">Amount / Value</th></tr></thead><tbody>${details}</tbody></table><div class="kumakh-voucher__bottom"><div class="kumakh-voucher__summary"><div class="kumakh-voucher__label">Remarks</div><div>${escapeHtml(data.remarks || "—")}</div>${!payroll ? `<div class="kumakh-voucher__words"><strong>Amount in words:</strong> ${escapeHtml(amountWords(data.paidAmount))}</div>` : ""}</div><div class="kumakh-voucher__summary"><div class="total"><span>${totalLabel}</span><strong>${money(totalValue)}</strong></div></div></div><div class="kumakh-voucher__signatures"><span>Prepared by</span><span>Received by</span><span>Authorised by</span></div>` });
  };
  window.KumakhVouchers = { studentReceipt, cafeReceipt, purchaseInvoice, paymentVoucher };
})();
