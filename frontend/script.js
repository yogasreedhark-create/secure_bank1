/* ============================================================
   Integrated script.js - unified and fixed
   ============================================================ */

/** Storage keys */
const EMPLOYEES_KEY = "secureBankEmployees";       // map keyed by empId
const CUR_USER_KEY  = "secureBankCurrentUser";     // current logged in empId
const SESSION_KEY   = "sbk_session";

/* ----------------- Utility ----------------- */
function clean(v){ return String(v || '').trim().replace(/\s+/g,' '); }
function navTo(page){ window.location.href = page; }
function setCurrentUser(empId){ if(!empId) localStorage.removeItem(CUR_USER_KEY); else localStorage.setItem(CUR_USER_KEY, String(empId)); }
function getCurrentUser(){ return String(localStorage.getItem(CUR_USER_KEY) || ""); }
function loadAllEmployees(){ try { return JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || "{}"); } catch { return {}; } }
function saveAllEmployees(obj){ localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(obj || {})); }

/* ----------------- ID generator ----------------- */
function generateEmployeeId(){
  return "EMP" + Math.floor(100000 + Math.random() * 900000);
}

/* ----------------- Basic guards ----------------- */
function ensureLoggedInElseRedirect(){
  const cur = getCurrentUser();
  if(!cur){
    alert("Please login first.");
    window.location.href = "index.html";
    throw new Error("Not logged in");
  }
}

/* ----------------- Registration ----------------- */
function registerEmployee(){
  const empIdEl = document.getElementById('regEmpId');
  const empId = clean(empIdEl?.value || generateEmployeeId());

  const firstname = clean(document.getElementById('regFirstname').value);
  const lastname  = clean(document.getElementById('regLastname').value);
  const email     = clean(document.getElementById('regEmail').value);
  const password  = String(document.getElementById('regPassword').value || "");
  const confirm   = String(document.getElementById('regConfirm').value || "");
  const address   = clean(document.getElementById('regAddress').value);
  const contact   = clean(document.getElementById('regContact').value);

  if(!firstname || !lastname || !email || !password || !confirm || !address || !contact) {
    alert("All fields are required.");
    return;
  }
  if(password !== confirm){ alert("Passwords do not match."); return; }
  if(!/^\d{10}$/.test(contact)){ alert("Contact must be 10 digits."); return; }

  const employees = loadAllEmployees();
  if(employees[empId]){ alert("Employee ID exists. Try again."); return; }

  // create employee record
  employees[empId] = {
    empId,
    firstname,
    lastname,
    email,
    password, // demo only (do NOT store plain passwords in production)
    balance: 1000,
    transactions: [],
    customers: [],
    loans: [],
    kycStatus: "Not Submitted",
    created: new Date().toLocaleString()
  };
  saveAllEmployees(employees);
  alert("Registration successful! Please login.");
  window.location.href = "index.html";
}

/* ----------------- Login ----------------- */
async function sha256Hex(text){
  const enc = new TextEncoder();
  const data = enc.encode(String(text || ''));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function loginWithEmpIdAndPassword(){
  const empId = clean((document.getElementById('empLoginId') || {}).value || "");
  const password = String((document.getElementById('empLoginPassword') || {}).value || "");

  if(!empId || !password){ alert("Enter Employee ID and password."); return; }

  const employees = loadAllEmployees();
  const emp = employees[empId];
  if(!emp){ alert("Employee not found. Register first."); return; }

  let ok = false;
  if(typeof emp.password === 'string' && emp.password.length > 0) ok = (password === emp.password);

  if(!ok && emp.passwordHash){
    const h = await sha256Hex(password);
    ok = (h === emp.passwordHash);
  }

  if(!ok){ alert("Invalid password."); return; }

  // login success
  setCurrentUser(empId);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ employeeId: empId, signedInAt: new Date().toISOString() }));
  // redirect to dashboard
  window.location.href = "dashboard.html";
}

/* ----------------- Deposit ----------------- */
function addMoney(){
  try{
    ensureLoggedInElseRedirect();
    const amt = Number((document.getElementById('add-amt') || {}).value || 0);
    if(!amt || amt <= 0) return alert("Enter a valid amount.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    employees[cur] = employees[cur] || { empId: cur, balance:0, transactions:[], customers:[], loans:[], kycStatus:"Not Submitted" };
    employees[cur].balance = Number(employees[cur].balance || 0) + amt;
    employees[cur].transactions = employees[cur].transactions || [];
    employees[cur].transactions.push({ type: "Deposit", amount: Number(amt), time: new Date().toLocaleString() });
    saveAllEmployees(employees);
    alert("Deposit successful.");
    window.location.href = "dashboard.html";
  }catch(e){ console.error(e); }
}

/* ----------------- Withdraw ----------------- */
function withdrawMoney(){
  try{
    ensureLoggedInElseRedirect();
    const amt = Number((document.getElementById('withdraw-amt') || {}).value || 0);
    if(!amt || amt <= 0) return alert("Enter a valid amount.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    if(!employees[cur]) return alert("Account not found.");
    if(Number(employees[cur].balance || 0) < amt) return alert("Insufficient balance.");
    employees[cur].balance = Number(employees[cur].balance || 0) - amt;
    employees[cur].transactions = employees[cur].transactions || [];
    employees[cur].transactions.push({ type: "Withdraw", amount: Number(amt), time: new Date().toLocaleString() });
    saveAllEmployees(employees);
    alert("Withdrawal successful.");
    window.location.href = "dashboard.html";
  }catch(e){ console.error(e); }
}

/* ----------------- Transfer ----------------- */
function transferMoney(){
  try{
    ensureLoggedInElseRedirect();
    const receiver = clean((document.getElementById('transfer-user') || {}).value || "");
    const amt = Number((document.getElementById('transfer-amt') || {}).value || 0);
    if(!receiver || !amt || amt <= 0) return alert("Enter valid transfer details.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    if(!employees[cur]) return alert("Sender account not found.");
    if(Number(employees[cur].balance || 0) < amt) return alert("Insufficient balance.");

    // create receiver if not exists
    if(!employees[receiver]){
      employees[receiver] = { empId: receiver, email: "", password: "temp", balance: 1000, transactions: [], customers: [], loans: [], kycStatus: "Not Submitted", created: new Date().toLocaleString() };
    }

    employees[cur].balance -= amt;
    employees[receiver].balance = Number(employees[receiver].balance || 0) + amt;

    employees[cur].transactions = employees[cur].transactions || [];
    employees[receiver].transactions = employees[receiver].transactions || [];

    employees[cur].transactions.push({ type: "Transfer to " + receiver, amount: Number(amt), time: new Date().toLocaleString() });
    employees[receiver].transactions.push({ type: "Received from " + cur, amount: Number(amt), time: new Date().toLocaleString() });

    saveAllEmployees(employees);
    alert("Transfer successful.");
    window.location.href = "dashboard.html";
  }catch(e){ console.error(e); }
}

/* ----------------- Transaction List page ----------------- */
document.addEventListener("DOMContentLoaded", function(){
  if(location.pathname.includes('transactions.html')){
    try{
      ensureLoggedInElseRedirect();
      const cur = getCurrentUser();
      const employees = loadAllEmployees();
      const txns = (employees[cur] && employees[cur].transactions) ? employees[cur].transactions.slice().reverse() : [];
      const list = document.getElementById('txn-list');
      if(!list) return;
      list.innerHTML = "";
      if(txns.length === 0) list.innerHTML = "<li>No transactions yet.</li>";
      txns.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${t.type}</strong><br>Amount: ₹${Number(t.amount || 0)}<br><small>${t.time}</small>`;
        list.appendChild(li);
      });
    }catch(e){ console.error(e); }
  }
});

/* ----------------- Customer CRUD ----------------- */
function registerCustomer(){
  try{
    ensureLoggedInElseRedirect();
    const ssn = clean((document.getElementById('custSSN') || {}).value || "");
    const name = clean((document.getElementById('custName') || {}).value || "");
    const acc  = clean((document.getElementById('custAcc') || {}).value || "");
    const accType = clean((document.getElementById('custAccType') || {}).value || "");
    const balance = Number((document.getElementById('custBalance') || {}).value || 0);
    const aadhaar = clean((document.getElementById('custAadhaar') || {}).value || "");
    const pan = clean((document.getElementById('custPan') || {}).value || "");
    const address = clean((document.getElementById('custAddress') || {}).value || "");

    if(!ssn || !name || !acc) return alert("SSN, Name and Account Number required.");

    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    employees[cur] = employees[cur] || { customers: [] };
    employees[cur].customers = employees[cur].customers || [];

    if(employees[cur].customers.find(c=>c.ssn === ssn)) return alert("Customer with this SSN already exists.");

    employees[cur].customers.push({ ssn, name, acc, accType, balance, aadhaar, pan, address, created: new Date().toLocaleString() });
    saveAllEmployees(employees);
    alert("Customer registered.");
    loadCustomerList();
  }catch(e){ console.error(e); }
}

function loadCustomerList(){
  try{
    ensureLoggedInElseRedirect();
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const list = document.getElementById('customer-list');
    if(!list) return;
    list.innerHTML = "";
    (employees[cur].customers || []).forEach(c => {
      const li = document.createElement('li');
      li.style.marginBottom = "8px";
      li.innerHTML = `<strong>${c.name}</strong> — SSN: ${c.ssn} — Acc: ${c.acc} — Bal: ₹${c.balance}`;
      list.appendChild(li);
    });
  }catch(e){ console.error(e); }
}

if(location.pathname.includes('customers.html')){
  document.addEventListener('DOMContentLoaded', loadCustomerList);
}

/* Edit customer */
function searchCustomerForEdit(){
  try{
    ensureLoggedInElseRedirect();
    const ssn = clean((document.getElementById('editSearchSSN') || {}).value || "");
    if(!ssn) return alert("Enter SSN.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const cust = (employees[cur].customers || []).find(c=>c.ssn === ssn);
    if(!cust) return alert("Not found.");
    document.getElementById('editCustomerSection').style.display = 'block';
    document.getElementById('editCName').value = cust.name;
    document.getElementById('editAccNum').value = cust.acc;
    document.getElementById('editAadhaar').value = cust.aadhaar || "";
    document.getElementById('editAddress').value = cust.address || "";
    document.getElementById('editBalance').value = cust.balance || 0;
    document.getElementById('editCustomerSection').dataset.editingSsn = ssn;
  }catch(e){ console.error(e); }
}

function updateCustomer(){
  try{
    const ssn = document.getElementById('editCustomerSection').dataset.editingSsn;
    if(!ssn) return alert("No customer selected.");
    const name = clean((document.getElementById('editCName') || {}).value || "");
    const address = clean((document.getElementById('editAddress') || {}).value || "");
    const balance = Number((document.getElementById('editBalance') || {}).value || 0);
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const idx = (employees[cur].customers || []).findIndex(c=>c.ssn === ssn);
    if(idx === -1) return alert("Customer not found.");
    employees[cur].customers[idx].name = name;
    employees[cur].customers[idx].address = address;
    employees[cur].customers[idx].balance = balance;
    saveAllEmployees(employees);
    alert("Customer updated.");
    document.getElementById('editCustomerSection').style.display = 'none';
    loadCustomerList();
  }catch(e){ console.error(e); }
}

/* Delete customer */
function searchCustomerForDelete(){
  try{
    ensureLoggedInElseRedirect();
    const ssn = clean((document.getElementById('deleteSearchSSN') || {}).value || "");
    if(!ssn) return alert("Enter SSN.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const cust = (employees[cur].customers || []).find(c=>c.ssn === ssn);
    if(!cust) return alert("Not found.");
    document.getElementById('deleteCustomerSection').style.display = 'block';
    document.getElementById('delCName').value = cust.name;
    document.getElementById('delAccNum').value = cust.acc;
    document.getElementById('deleteCustomerSection').dataset.deletingSsn = ssn;
  }catch(e){ console.error(e); }
}

function deleteCustomer(){
  try{
    const ssn = document.getElementById('deleteCustomerSection').dataset.deletingSsn;
    if(!ssn) return alert("No customer selected.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    employees[cur].customers = (employees[cur].customers || []).filter(c=>c.ssn !== ssn);
    saveAllEmployees(employees);
    alert("Customer deleted.");
    document.getElementById('deleteCustomerSection').style.display = 'none';
    loadCustomerList();
  }catch(e){ console.error(e); }
}

/* ----------------- Loans & EMI ----------------- */
function loadCIBIL(){
  try{
    ensureLoggedInElseRedirect();
    const score = Math.floor(Math.random()*(850-620+1))+620;
    const eligible = score>=800?1000000:score>=750?700000:score>=700?400000:score>=650?200000:50000;
    if(document.getElementById('cibilScore')) document.getElementById('cibilScore').innerText = score;
    if(document.getElementById('eligibleAmount')) document.getElementById('eligibleAmount').innerText = "₹" + eligible.toLocaleString();
  }catch(e){ console.error(e); }
}
if(location.pathname.includes('loan_request.html')) document.addEventListener("DOMContentLoaded", loadCIBIL);

function calculateEMI(){
  const P = Number((document.getElementById('loanAmount') || {}).value || 0);
  const R = Number((document.getElementById('loanRate') || {}).value || 0)/12/100;
  const N = Number((document.getElementById('loanMonths') || {}).value || 0);
  if(!P||!R||!N) return alert("Enter valid loan details.");
  const EMI = (P*R*Math.pow(1+R,N))/(Math.pow(1+R,N)-1);
  document.getElementById('emiValue').innerText = "₹" + EMI.toFixed(2);
}

function submitLoanForCustomer(){
  try{
    ensureLoggedInElseRedirect();
    const ssn = clean((document.getElementById('loanSSN') || {}).value || "");
    const amount = Number((document.getElementById('loanApplyAmount') || {}).value || 0);
    if(!ssn||!amount) return alert("Enter SSN and amount.");
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const cust = (employees[cur].customers || []).find(c=>c.ssn===ssn);
    if(!cust) return alert("Customer not found.");
    const loan = { id: 'LN'+Math.floor(10000+Math.random()*90000), ssn, name:cust.name, amount, status: 'Requested', time: new Date().toLocaleString() };
    employees[cur].loans = employees[cur].loans || [];
    employees[cur].loans.push(loan);
    saveAllEmployees(employees);
    alert("Loan request submitted.");
  }catch(e){ console.error(e); }
}

/* ----------------- KYC ----------------- */
function submitKYC(){
  try{
    ensureLoggedInElseRedirect();
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const front = (document.getElementById('aadhar-front') || {}).files || [];
    const back = (document.getElementById('aadhar-back') || {}).files || [];
    const selfie = (document.getElementById('selfie-photo') || {}).files || [];
    if(!front.length || !back.length || !selfie.length) return alert("Upload all documents.");
    employees[cur].kycStatus = "Pending";
    saveAllEmployees(employees);
    updateKYCStatusUI("Pending");
    alert("KYC submitted. Verifying...");
    setTimeout(()=> {
      employees[cur].kycStatus = "Verified";
      saveAllEmployees(employees);
      updateKYCStatusUI("Verified");
      alert("KYC Verified!");
    }, 3500);
  }catch(e){ console.error(e); }
}

function updateKYCStatusUI(status){
  const badge = document.getElementById('kyc-status');
  const p1 = document.getElementById('step1'), p2 = document.getElementById('step2'), p3 = document.getElementById('step3');
  if(!badge) return;
  p1 && (p1.style.opacity = 0.3); p2 && (p2.style.opacity = 0.3); p3 && (p3.style.opacity = 0.3);
  if(status === "Not Submitted"){ badge.innerText="Not Submitted"; badge.style.background="#777"; }
  if(status === "Pending"){ badge.innerText="Pending Review"; badge.style.background="orange"; p1 && (p1.style.opacity=1); p2 && (p2.style.opacity=1); }
  if(status === "Verified"){ badge.innerText="Verified"; badge.style.background="green"; p1 && (p1.style.opacity=1); p2 && (p2.style.opacity=1); p3 && (p3.style.opacity=1); }
}

/* on profile load show username and kyc */
if(location.pathname.includes('profile.html')){
  document.addEventListener('DOMContentLoaded', ()=>{
    try{
      ensureLoggedInElseRedirect();
      const cur = getCurrentUser();
      const employees = loadAllEmployees();
      const emp = employees[cur];
      if(!emp) return logout();
      document.getElementById('username').innerText = emp.email || emp.empId;
      updateKYCStatusUI(emp.kycStatus || "Not Submitted");
    }catch(e){ console.error(e); }
  });
}

/* ----------------- FAQ BOT ----------------- */
function askBot(){
  const q = (document.getElementById('chat-input') || {}).value || "";
  const box = document.getElementById('chat-box');
  if(!q) return;
  const userDiv = document.createElement('div'); userDiv.className='user-msg'; userDiv.innerText = q;
  box.appendChild(userDiv);

  let ans = "Sorry, I don't understand. Try 'how to withdraw' or 'loan process'.";
  const ql = q.toLowerCase();
  if(ql.includes("withdraw")) ans = "To withdraw: go to Withdraw, enter amount, click Withdraw.";
  if(ql.includes("deposit")) ans = "To deposit: go to Deposit, enter amount, click Add Money.";
  if(ql.includes("transfer")) ans = "To transfer: go to Transfer, enter receiver username & amount, click Transfer.";
  if(ql.includes("loan")) ans = "For loans: go to Loan page, check CIBIL, use EMI calculator and submit request.";
  if(ql.includes("kyc")) ans = "KYC: go to KYC page, upload Aadhaar front/back & selfie, submit to verify.";

  const botDiv = document.createElement('div'); botDiv.className='bot-msg'; botDiv.innerText = ans;
  box.appendChild(botDiv);
  (document.getElementById('chat-input') || {}).value = "";
  box.scrollTop = box.scrollHeight;
}

/* ----------------- PDF Export ----------------- */
function downloadPDF(){
  try{
    ensureLoggedInElseRedirect();
    const cur = getCurrentUser();
    const employees = loadAllEmployees();
    const txns = (employees[cur] && employees[cur].transactions) ? employees[cur].transactions : [];
    if(!txns.length) return alert("No transactions to export.");
    if(typeof jsPDF === "undefined"){
      let text = `Transaction Statement - ${cur}\n\n`;
      txns.forEach((t,i)=> text += `${i+1}. ${t.type} | ₹${t.amount} | ${t.time}\n`);
      const w = window.open("", "_blank");
      w.document.write("<pre>"+text+"</pre>");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Transaction Statement - ${cur}`,20,20);
    let y = 40;
    txns.forEach((t,i)=>{ doc.text(`${i+1}. ${t.type} | ₹${t.amount} | ${t.time}`, 20, y); y+=8; if(y>270){ doc.addPage(); y = 20; } });
    doc.save(`${cur}_statement.pdf`);
  }catch(e){ console.error(e); }
}

/* ----------------- Logout & Dark Mode ----------------- */
function logout(){ setCurrentUser(""); localStorage.removeItem(SESSION_KEY); window.location.href = "index.html"; }
function toggleDarkMode(){ document.body.classList.toggle('dark-mode'); }

/* ----------------- Simple redirect if root accessed in some setups ----------------- */
document.addEventListener('DOMContentLoaded', () => {
  // If user opens root file named differently, keep default behavior — nothing forced here.
});
