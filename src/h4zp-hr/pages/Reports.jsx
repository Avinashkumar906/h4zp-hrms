import React from 'react';
import { ymLabel } from '../lib/format';
import { monthStarted, totalExperienceMonths, leaveEntitlement } from '../lib/payroll';
import { Select } from '../components/ui';

export default function Reports({ db, results, months, monthIdx, setMonthIdx, store, can }) {
  const mo = months[monthIdx]; const S = db.settings;
  const on = db.staff.map((s) => ({ s, r: results[s.id][monthIdx] })).filter((x) => x.r.onPayroll);
  const dl = (name, head, rows) => store.downloadCsv(`H4ZP-${name}.csv`, [head, ...rows]);
  const reports = [
    ['Staff master', 'Everyone on record with job, contact, PCC and qualification details.', 'staff', () => dl('staff-master', ['Emp ID', 'Name', 'Designation', 'Department', 'Status', 'Date of joining', 'Confirmed from', 'Date of leaving', 'Gender', 'Mobile', 'Email', 'Qualification', 'Experience (months)', 'PCC status', 'PCC valid till', 'Reports to'],
      db.staff.map((s) => [s.emp_id, s.name, s.designation, s.department, s.status, s.doj, s.confirm_date, s.dol, s.gender, s.mobile, s.email, s.qualification, totalExperienceMonths(s), s.pcc_status, s.pcc_valid_till, db.directory.find((p) => p.id === s.reports_to)?.name || '']))],
    [`Salary register — ${ymLabel(mo.ym, true)}`, 'Every earning and deduction for the month.', 'payroll', () => dl(`salary-register-${mo.ym}`, ['S.No', 'Emp ID', 'Name', 'Paid days', 'LOP', 'Fixed salary', 'Basic', 'HRA', 'Conveyance', 'Special', 'OT', 'Arrears', 'Bonus', 'Incentive', 'Other', 'Reimbursement', 'Total earnings', 'PF', 'ESI', 'PT', 'TDS', 'Advance', 'Other ded', 'Loan', 'Total ded', 'Net payable', 'Brought fwd', 'Total payable', 'Status', 'Paid', 'Due c/f'],
      on.map(({ s, r }, i) => [i + 1, s.emp_id, s.name, r.paid, r.lop, r.gross, r.basic, r.hra, r.conv, r.special, r.otPay, r.arrears, r.bonus, r.incentive, r.otherEarn, r.reimb, r.totEarn, r.pfEE, r.esiEE, r.pt, r.tds, r.advance, r.otherDed, r.loanDed, r.ded, r.net, r.prevDue, r.totPay, r.payment.status, r.paidAmt, r.closeDue]))],
    [`PF & ESI challan data — ${ymLabel(mo.ym, true)}`, 'Wages and contributions per member for the EPFO and ESIC portals.', 'payroll', () => dl(`pf-esi-${mo.ym}`, ['Emp ID', 'Name', 'UAN', 'PF wages', 'PF employee', 'EPS employer', 'EPF employer', 'EDLI + admin', 'ESI no.', 'ESI wages', 'ESI employee', 'ESI employer'],
      on.filter(({ r }) => r.pfWages > 0 || r.esiWages > 0).map(({ s, r }) => [s.emp_id, s.name, s.uan, r.pfWages, r.pfEE, r.eps, r.erEPF, r.edli, s.esi_no, r.esiWages, r.esiEE, r.erESI]))],
    [`Bank transfer list — ${ymLabel(mo.ym, true)}`, 'Name, account, IFSC and amount for the bank.', 'payroll', () => dl(`bank-transfer-${mo.ym}`, ['S.No', 'Emp ID', 'Name', 'Bank', 'Account no.', 'IFSC', 'Amount'],
      on.filter(({ r }) => r.totPay > 0).map(({ s, r }, i) => [i + 1, s.emp_id, s.name, s.bank_name, s.bank_ac ? `'${s.bank_ac}` : '', s.ifsc, r.totPay]))],
    [`Attendance summary — ${ymLabel(mo.ym, true)}`, 'Present, leave, absent and paid days per person.', 'attendance', () => dl(`attendance-${mo.ym}`, ['Emp ID', 'Name', 'Days employed', 'P', 'A', 'CL', 'SL', 'EL', 'HD', 'LWP', 'WO', 'HO', 'CL adjusted', 'EL adjusted', 'LOP', 'Paid days', 'OT days'],
      on.map(({ s, r }) => [s.emp_id, s.name, r.emp, r.cnt.P, r.cnt.A, r.cnt.CL, r.cnt.SL, r.cnt.EL, r.cnt.HD, r.cnt.LWP, r.cnt.WO, r.cnt.HO, r.clAdj, r.elAdj, r.lop, r.paid, r.ot]))],
    ['Leave balances', 'Entitled, taken and balance for CL, SL and EL.', 'leave', () => dl('leave-balances', ['Emp ID', 'Name', 'Status', 'CL entitled', 'CL balance', 'SL entitled', 'SL taken', 'EL entitled', 'EL balance'],
      db.staff.map((s) => { const R = results[s.id]; return [s.emp_id, s.name, s.status, leaveEntitlement(s, 'CL', S), R[11].clClose, leaveEntitlement(s, 'SL', S), R.reduce((t, r) => t + r.cnt.SL, 0), leaveEntitlement(s, 'EL', S), R[11].elClose]; }))],
    ['Payments — year to date', 'Every salary with status, date, mode and UTR.', 'payroll', () => dl('payments-ytd', ['Month', 'Emp ID', 'Name', 'Net payable', 'Brought fwd', 'Total payable', 'Status', 'Paid', 'Due c/f', 'Date', 'Mode', 'UTR', 'This month salary'],
      months.flatMap((m, i) => (monthStarted(m) ? db.staff.map((s) => ({ s, r: results[s.id][i] })).filter((x) => x.r.onPayroll).map(({ s, r }) => [ymLabel(m.ym), s.emp_id, s.name, r.net, r.prevDue, r.totPay, r.payment.status, r.paidAmt, r.closeDue, r.payment.date, r.payment.mode, r.payment.utr, r.thisSalary]) : [])))],
    ['Expense claims', 'All claims with status and the salary month they are paid in.', 'expenses', () => dl('expenses', ['Date', 'Employee', 'Category', 'Details', 'Bill no.', 'Amount', 'Status', 'Paid with'],
      db.records.filter((r) => r.kind === 'expense').map((r) => [r.data.date, db.directory.find((p) => p.id === r.staff_id)?.name, r.data.category, r.data.description, r.data.bill_no, r.data.amount, r.data.status, r.data.pay_ym]))],
  ].filter((r) => can.view(r[2]));
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Reports</h1><p className="hr-muted">Downloads open in Excel. Monthly reports use the month chosen here.</p></div>
        <Select value={monthIdx} onChange={(v) => setMonthIdx(Number(v))} options={months.map((m, i) => ({ value: i, label: ymLabel(m.ym, true) }))} aria-label="Month" /></header>
      <div className="hr-reports">{reports.map(([t, d, , fn]) => <div key={t} className="hr-panel"><h2>{t}</h2><p className="hr-muted">{d}</p><button className="hr-btn" onClick={fn}>Download</button></div>)}</div>
      {reports.length === 0 && <p className="hr-muted">Your login has no report areas switched on.</p>}
    </div>
  );
}
