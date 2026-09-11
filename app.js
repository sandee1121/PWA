const ids = ["filamentUsed", "spoolPrice", "spoolWeight", "printHours", "printMinutes", "electricityRate", "printerWatts", "laborCost", "overheadCost", "profitMargin"];
const resetIds = ["customerName", "customerContact", "itemName", "quantity", ...ids];
const get = id => Math.max(0, Number(document.getElementById(id).value) || 0);
const money = value => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const customerFields = ["customerName", "customerContact"];
let latestWhatsappUrl = "";
const setFieldError = (id, hasError) => document.getElementById(id).closest("label").classList.toggle("field-error", hasError);
function updatePrintAvailability() {
  const name = document.getElementById("customerName").value.trim();
  const mobile = document.getElementById("customerContact").value.replace(/\D/g, "");
  document.getElementById("printBill").disabled = !(name && mobile.length >= 10);
}
function nextInvoiceDetails(now = new Date()) {
  const monthKey = now.toISOString().slice(0, 7).replace("-", "");
  const sequenceKey = `karthikeyaInvoiceSequence-${monthKey}`;
  const previousSequence = localStorage.getItem(sequenceKey);
  const sequence = previousSequence === null ? 0 : Number(previousSequence) + 1;
  return { sequenceKey, sequence, billNumber: `KD-${monthKey}-${String(sequence).padStart(3, "0")}` };
}
function refreshInvoicePreview() { document.getElementById("invoiceNumberPreview").textContent = nextInvoiceDetails().billNumber; }
function showInternalJobLog() {
  if (latestWhatsappUrl) document.getElementById("whatsappModal").hidden = false;
}
window.showInternalJobLog = showInternalJobLog;

function downloadPdf(filename, lines, targetWindow = window) {
  const clean = value => String(value).replace(/₹/g, "INR ").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
  const content = ["BT", "/F1 18 Tf", "72 760 Td", `(${clean(lines[0])}) Tj`, "/F1 10 Tf"];
  lines.slice(1).forEach((line, index) => {
    content.push(index === 0 ? "0 -32 Td" : "0 -18 Td", `(${clean(line)}) Tj`);
  });
  content.push("ET");
  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = targetWindow.URL.createObjectURL(new targetWindow.Blob([pdf], { type: "application/pdf" }));
  const link = targetWindow.document.createElement("a");
  link.href = url; link.download = filename; targetWindow.document.body.append(link); link.click(); link.remove();
  setTimeout(() => targetWindow.URL.revokeObjectURL(url), 1000);
}

function calculate() {
  const material = get("filamentUsed") * get("spoolPrice") / Math.max(1, get("spoolWeight"));
  const hours = get("printHours") + get("printMinutes") / 60;
  const electricity = hours * get("printerWatts") / 1000 * get("electricityRate");
  const other = get("laborCost") + get("overheadCost");
  const production = material + electricity + other;
  const profit = production * get("profitMargin") / 100;
  const unitTotal = production + profit;
  const quantity = Math.max(1, get("quantity"));
  const total = unitTotal * quantity;
  document.getElementById("materialCost").textContent = money(material);
  document.getElementById("electricityCost").textContent = money(electricity);
  document.getElementById("otherCost").textContent = money(other);
  document.getElementById("productionCost").textContent = money(production);
  document.getElementById("profitCost").textContent = money(profit);
  document.getElementById("quoteTotal").textContent = total.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  document.getElementById("marginLabel").textContent = `${get("profitMargin")}%`;
  return { material, electricity, other, production, profit, unitTotal, total, quantity };
}
ids.forEach(id => document.getElementById(id).addEventListener("input", calculate));
document.getElementById("quantity").addEventListener("input", calculate);
customerFields.forEach(id => document.getElementById(id).addEventListener("input", () => { setFieldError(id, false); updatePrintAvailability(); }));
document.getElementById("copyQuote").addEventListener("click", async () => {
  const c = calculate();
  const text = `3D Print Quote\nRate per piece: ${money(c.unitTotal)}\nQuantity: ${c.quantity}\nTotal quote: ${money(c.total)}`;
  try { await navigator.clipboard.writeText(text); document.getElementById("copyStatus").textContent = "Quote copied to clipboard"; }
  catch { document.getElementById("copyStatus").textContent = "Unable to copy — select the values manually."; }
});
document.getElementById("resetCalculator").addEventListener("click", () => {
  resetIds.forEach(id => { document.getElementById(id).value = 0; });
  document.getElementById("whatsappEnabled").checked = false;
  document.getElementById("sendLatestWhatsapp").hidden = true;
  latestWhatsappUrl = "";
  document.getElementById("copyStatus").textContent = "All values reset to zero";
  calculate();
});
function openBill() {
  const c = calculate();
  const customerName = document.getElementById("customerName").value.trim();
  const customerContact = document.getElementById("customerContact").value.trim();
  const invalidMobile = customerContact.replace(/\D/g, "").length < 10;
  setFieldError("customerName", !customerName);
  setFieldError("customerContact", !customerContact || invalidMobile);
  if (!customerName || !customerContact) {
    document.getElementById("copyStatus").textContent = "Customer name and mobile number are required.";
    document.getElementById(!customerName ? "customerName" : "customerContact").focus();
    return;
  }
  if (invalidMobile) {
    document.getElementById("copyStatus").textContent = "Enter a valid 10-digit mobile number.";
    document.getElementById("customerContact").focus();
    return;
  }
  const quantity = Math.max(1, get("quantity"));
  const lineAmount = c.total;
  const printHours = get("printHours") + get("printMinutes") / 60;
  const now = new Date();
  const invoice = nextInvoiceDetails(now);
  const billNumber = invoice.billNumber;
  localStorage.setItem(invoice.sequenceKey, String(invoice.sequence));
  refreshInvoicePreview();
  const whatsappEnabled = document.getElementById("whatsappEnabled").checked;
  const itemName = document.getElementById("itemName").value.trim() || "3D printed part";
  const internalLog = JSON.parse(localStorage.getItem("karthikeyaInvoiceLog") || "[]");
  internalLog.push({ invoiceNumber: billNumber, createdAt: now.toISOString(), customerName, customerContact, itemName, quantity, materialCost: c.material, electricityCost: c.electricity, laborCost: get("laborCost"), overheadCost: get("overheadCost"), productionCost: c.production, profit: c.profit * quantity, invoiceAmount: lineAmount });
  localStorage.setItem("karthikeyaInvoiceLog", JSON.stringify(internalLog));
  const bill = window.open("", "_blank");
  if (!bill) {
    document.getElementById("copyStatus").textContent = "Please allow pop-ups, then try Print bill again.";
    return;
  }
  const specification = `${get("filamentUsed")} g filament · ${printHours.toFixed(2)} h print`;
  const rows = `<tr><td>1</td><td></td><td></td><td></td><td></td><td></td></tr>`;
  const whatsappText = encodeURIComponent(`3D Print Bill\n\nFilament: ${money(c.material)}\nElectricity: ${money(c.electricity)}\nLabor & overhead: ${money(c.other)}\nProduction cost: ${money(c.production)}\nProfit (${get("profitMargin")}%): ${money(c.profit)}\n\nTotal amount: ${money(c.total)}`);
  bill.document.write(`<!doctype html><html><head><title>3D Print Bill</title><style>body{font:14px Arial,sans-serif;color:#172019;margin:48px;max-width:760px}header{border-bottom:2px solid #172019;padding-bottom:12px;font-weight:800;letter-spacing:.1em}header b{background:#172019;color:#d9f35a;padding:6px;margin-right:8px}h1{margin:36px 0 6px;font-size:30px}.meta{color:#687068;font-size:12px;margin:0 0 28px}table{width:100%;border-collapse:collapse}th{background:#172019;color:white;text-align:left;padding:11px;font-size:11px}td{padding:13px 11px;border-bottom:1px solid #d5d8d4}th:last-child,td:last-child{text-align:right}.total td{border-top:2px solid #172019;border-bottom:0;font-size:17px;font-weight:bold;padding-top:17px}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:35px}.actions button,.actions a{padding:11px 15px;background:#172019;color:#fff;border:0;font:bold 12px Arial;cursor:pointer;text-decoration:none}.actions .whatsapp{background:#1f9d58}.actions .return{background:#eef0e9;color:#172019}@media print{.actions{display:none}body{margin:15mm}}</style></head><body><header><b>▦</b> PRINTCOST</header><h1>3D Print Bill</h1><p class="meta">Bill generated: ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p><table><thead><tr><th>Description</th><th>Details</th><th>Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><td colspan="2">TOTAL AMOUNT</td><td>${money(c.total)}</td></tr></tfoot></table><div class="actions"><button onclick="window.print()">Print or Save as PDF</button><a class="whatsapp" href="https://wa.me/?text=${whatsappText}" target="_blank" rel="noopener">Send to WhatsApp</a><button class="return" onclick="window.close()">← Return to calculator</button></div></body></html>`);
  bill.document.close();
  bill.document.title = `${billNumber} — Karthikeya Designs Invoice`;
  bill.document.querySelector("h1").textContent = "Invoice";
  const billHeader = bill.document.querySelector("header");
  billHeader.textContent = "";
  const logo = bill.document.createElement("img");
  logo.src = new URL("karthikeya-designs-logo.png", window.location.href).href;
  logo.alt = "Karthikeya Designs logo";
  logo.style.cssText = "width:38px;height:38px;object-fit:cover;vertical-align:middle;margin-right:10px;border-radius:7px";
  billHeader.append(logo, "KARTHIKEYA DESIGNS");
  const meta = bill.document.querySelector(".meta");
  meta.textContent = `Invoice no.: ${billNumber}  •  Date & time: ${now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
  const customer = bill.document.createElement("div");
  customer.className = "customer";
  customer.append("Customer: ", customerName, bill.document.createElement("br"), "Contact: ", customerContact);
  if (whatsappEnabled) {
    const whatsapp = bill.document.createElement("span");
    whatsapp.textContent = "  WhatsApp";
    whatsapp.style.cssText = "display:inline-block;margin-left:10px;padding:2px 7px;border-radius:10px;background:#1f9d58;color:#fff;font-size:10px;font-weight:bold";
    customer.append(whatsapp);
  }
  customer.style.cssText = "background:#f0f2ec;padding:12px;margin:20px 0 28px;line-height:1.65";
  meta.after(customer);
  const line = bill.document.querySelector("tbody tr");
  ["1", itemName, specification, money(c.unitTotal), quantity, money(lineAmount)].forEach((value, index) => { line.cells[index].textContent = value; });
  const table = bill.document.querySelector("table");
  table.querySelector("thead tr").innerHTML = "<th>S.No</th><th>Item Name</th><th>Specification</th><th>Rate</th><th>Qty</th><th>Amount</th>";
  table.querySelector("tfoot tr td:last-child").textContent = money(lineAmount);
  const thankYou = bill.document.createElement("p");
  thankYou.textContent = "Thanks for the purchase !!! Welcome Again !!!";
  thankYou.style.cssText = "margin-top:42px;text-align:center;color:#5b625c;font-size:11px;font-weight:bold";
  table.after(thankYou);
  bill.document.querySelector(".whatsapp")?.remove();
  const saveButton = bill.document.querySelector(".actions button");
  saveButton.textContent = "Print / Save Exact PDF";
  saveButton.onclick = null;
  saveButton.setAttribute("onclick", "window.print()");
  const whatsappButton = bill.document.createElement("a");
  const whatsappMessage = encodeURIComponent(`Karthikeya Designs — Internal Job Log\nInvoice no.: ${billNumber}\nDate: ${now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}\nCustomer: ${customerName}\nMobile: ${customerContact}\nItem: ${itemName}\nSpecification: ${specification}\nQuantity: ${quantity}\nRate per piece: ${money(c.unitTotal)}\nInvoice amount: ${money(lineAmount)}\n\nInternal costs\nMaterial: ${money(c.material * quantity)}\nElectricity: ${money(c.electricity * quantity)}\nLabor: ${money(get("laborCost") * quantity)}\nOverhead: ${money(get("overheadCost") * quantity)}\nProduction cost: ${money(c.production * quantity)}\nProfit: ${money(c.profit * quantity)}`);
  whatsappButton.href = `https://wa.me/917382473073?text=${whatsappMessage}`;
  whatsappButton.target = "_blank";
  whatsappButton.rel = "noopener";
  whatsappButton.textContent = "Open WhatsApp with job log";
  whatsappButton.style.cssText = "padding:11px 15px;background:#1f9d58;color:#fff;font:bold 12px Arial;text-decoration:none";
  saveButton.after(whatsappButton);
  const latestWhatsapp = document.getElementById("sendLatestWhatsapp");
  latestWhatsapp.hidden = false;
  latestWhatsappUrl = whatsappButton.href;
  document.getElementById("whatsappInvoice").textContent = billNumber;
  document.getElementById("whatsappCustomer").textContent = customerName;
  document.getElementById("whatsappAmount").textContent = money(lineAmount);
  document.getElementById("whatsappProfit").textContent = money(c.profit * quantity);
  latestWhatsapp.onclick = showInternalJobLog;
  latestWhatsapp.textContent = "Send latest job log on WhatsApp";
  const returnButton = bill.document.querySelector(".actions .return");
  returnButton.onclick = () => { bill.opener?.showInternalJobLog(); bill.opener?.focus(); bill.close(); };
  bill.focus();
}
document.getElementById("printBill").addEventListener("click", () => {
  const customerName = document.getElementById("customerName").value.trim();
  const customerContact = document.getElementById("customerContact").value.trim();
  const invalidMobile = customerContact.replace(/\D/g, "").length < 10;
  setFieldError("customerName", !customerName);
  setFieldError("customerContact", !customerContact || invalidMobile);
  if (!customerName || !customerContact || invalidMobile) {
    document.getElementById("copyStatus").textContent = "Enter the required customer details before printing.";
    const missingId = !customerName ? "customerName" : "customerContact";
    document.getElementById(missingId).focus();
    return;
  }
  const c = calculate();
  const quantity = Math.max(1, get("quantity"));
  document.getElementById("confirmCustomer").textContent = customerName;
  document.getElementById("confirmMobile").textContent = customerContact;
  document.getElementById("confirmItem").textContent = document.getElementById("itemName").value.trim() || "3D printed part";
  document.getElementById("confirmRate").textContent = money(c.unitTotal);
  document.getElementById("confirmQuantity").textContent = quantity;
  document.getElementById("confirmTotal").textContent = money(c.total);
  document.getElementById("confirmModal").hidden = false;
});
document.getElementById("cancelConfirm").addEventListener("click", () => { document.getElementById("confirmModal").hidden = true; });
document.getElementById("approveConfirm").addEventListener("click", () => { document.getElementById("confirmModal").hidden = true; openBill(); });
document.getElementById("cancelWhatsapp").addEventListener("click", () => { document.getElementById("whatsappModal").hidden = true; });
document.getElementById("approveWhatsapp").addEventListener("click", () => {
  document.getElementById("whatsappModal").hidden = true;
  if (latestWhatsappUrl) window.open(latestWhatsappUrl, "_blank", "noopener");
});
calculate();
updatePrintAvailability();
refreshInvoicePreview();
