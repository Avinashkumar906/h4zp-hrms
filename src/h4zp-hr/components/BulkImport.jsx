// Bulk add / update staff from an Excel CSV, and export the staff list in the same format.
import React, { useRef, useState } from 'react';
import { EMPTY_STAFF, STATUSES, PCC_STATUSES } from '../lib/defaults';
import { Modal, Badge } from './ui';
import { downloadCsv } from '../lib/store';
import { todayIso } from '../lib/format';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// [CSV heading, field, kind]
export const COLUMNS = [
  ['Emp ID', 'emp_id'], ['Full Name', 'name'], ['Gender', 'gender'], ['Date of Birth', 'dob', 'date'], ['Designation', 'designation'], ['Department', 'department'],
  ['Sub Department', 'sub_department'], ['Employment Type', 'employment_type'], ['Status', 'status', 'status'], ['Date of Joining', 'doj', 'date'],
  ['Confirmed From', 'confirm_date', 'date'], ['Date of Leaving', 'dol', 'date'], ['Mobile', 'mobile'], ['Email', 'email'], ['Address', 'address'],
  ['Qualification', 'qualification'], ['Previous Experience (years)', 'prev_exp_years', 'num'], ['Monthly Gross', 'gross', 'num'], ['Night Salary', 'night_salary', 'num'],
  ['Deduct PF (Y/N)', 'deduct_pf', 'yn'], ['Deduct ESI (Auto/Y/N)', 'deduct_esi', 'esi'], ['Deduct TDS (Y/N)', 'deduct_tds', 'yn'], ['Shift', 'shift'],
  ['Weekly Off (Fixed/Flexible/Roster)', 'wo_mode', 'wo'], ['Off Days (e.g. Sun or Sat+Sun)', 'wo_days', 'days'], ['Attendance By (HR/Self)', 'attendance_mode', 'att'],
  ['Reports To (Emp ID)', 'reports_to', 'boss'], ['PAN', 'pan', 'upper'], ['Aadhaar', 'aadhaar'], ['Bank Name', 'bank_name'], ['Bank A/c No', 'bank_ac'], ['IFSC', 'ifsc', 'upper'],
  ['UAN', 'uan'], ['PF Number', 'pf_no'], ['ESI Number', 'esi_no'], ['Payment Mode', 'payment_mode'], ['PCC Status', 'pcc_status', 'pcc'], ['PCC Valid Till', 'pcc_valid_till', 'date'],
  ['Emergency Contact', 'emergency'], ['Remarks', 'remarks'],
];

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function parseDate(v) {
  v = String(v || '').trim(); if (!v) return '';
  let m;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return ok(y4(+m[3]), +m[2], +m[1]);
  if ((m = v.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/,]*(\d{2,4})$/))) return ok(y4(+m[3]), MON.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]);
  return null;
  function y4(y) { return y < 100 ? 2000 + y : y; }
  function ok(y, mo, d) { const dt = new Date(Date.UTC(y, mo - 1, d)); return mo >= 1 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null; }
}

/** Turn CSV rows into planned changes: [{row, emp_id, name, action, staff, changes, errors}] */
export function planImport(rows, db, nextId) {
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const idx = COLUMNS.map(([label, key]) => [key, head.findIndex((h) => h === label.toLowerCase() || h.split(' (')[0] === label.split(' (')[0].toLowerCase()), COLUMNS.find((c) => c[1] === key)[2]]);
  const byEmp = Object.fromEntries(db.staff.map((s) => [s.emp_id.toUpperCase(), s]));
  const issued = [];
  return rows.slice(1).map((cells, i) => {
    const errors = [], vals = {};
    for (const [key, col, kind] of idx) {
      if (col < 0) continue; let v = (cells[col] ?? '').trim(); if (v === '') continue;
      if (kind === 'date') { const d = parseDate(v); if (d === null) { errors.push(`${key}: "${v}" is not a date`); continue; } v = d; }
      else if (kind === 'num') { const n = Number(v.replace(/[₹,\s]/g, '')); if (isNaN(n)) { errors.push(`${key}: "${v}" is not a number`); continue; } v = n; }
      else if (kind === 'yn') { v = /^y(es)?$/i.test(v) ? 'Y' : /^n(o)?$/i.test(v) ? 'N' : null; if (!v) { errors.push(`${key} must be Y or N`); continue; } }
      else if (kind === 'esi') { v = /^a/i.test(v) ? 'Auto' : /^y/i.test(v) ? 'Y' : /^n/i.test(v) ? 'N' : null; if (!v) { errors.push('Deduct ESI must be Auto, Y or N'); continue; } }
      else if (kind === 'status') { const m = STATUSES.find((x) => x.toLowerCase() === v.toLowerCase()); if (!m) { errors.push(`Status "${v}" is not one of ${STATUSES.join(', ')}`); continue; } v = m; }
      else if (kind === 'pcc') { const m = PCC_STATUSES.find((x) => x.toLowerCase().replace(/[–-]/g, '') === v.toLowerCase().replace(/[–-]/g, '')); if (!m) { errors.push(`PCC Status "${v}" not recognised`); continue; } v = m; }
      else if (kind === 'wo') { v = /^fl/i.test(v) ? 'flexible' : /^r/i.test(v) ? 'roster' : /^fi/i.test(v) ? 'fixed' : /^d/i.test(v) ? '' : null; if (v === null) { errors.push('Weekly Off must be Fixed, Flexible or Roster'); continue; } }
      else if (kind === 'days') { const ds = v.split(/[,;/+&\s]+/).filter(Boolean).map((x) => DAYS.indexOf(x.slice(0, 3).toLowerCase())); if (ds.some((d) => d < 0)) { errors.push(`Off Days "${v}" not recognised`); continue; } v = [...new Set(ds)].sort(); }
      else if (kind === 'att') v = /^s/i.test(v) ? 'self' : 'hr';
      else if (kind === 'upper') v = v.toUpperCase();
      else if (kind === 'boss') { const b = byEmp[v.toUpperCase()]; if (!b) { errors.push(`Reports To: no employee ${v}`); continue; } v = b.id; }
      vals[key] = v;
    }
    let emp = String(vals.emp_id || '').toUpperCase(); const cur = emp && byEmp[emp];
    if (!emp) { emp = nextId(issued); issued.push(emp); }
    if (!cur && !vals.name) errors.push('Full Name is needed for a new employee');
    if (vals.wo_days && !vals.wo_mode && !cur?.wo_mode) vals.wo_mode = 'fixed';
    if (vals.attendance_mode === 'self' && cur?.attendance_mode !== 'self') vals.attendance_self_from = todayIso();
    if (vals.attendance_mode === 'hr') vals.attendance_self_from = '';
    const staff = cur ? { ...cur, ...vals, emp_id: cur.emp_id } : { ...EMPTY_STAFF, deduct_esi: 'Auto', status: 'Active', ...vals, emp_id: emp };
    const changes = cur ? Object.keys(vals).filter((k) => k !== 'emp_id' && JSON.stringify(cur[k] ?? '') !== JSON.stringify(vals[k])) : Object.keys(vals);
    return { row: i + 2, emp_id: emp, name: staff.name, action: errors.length ? 'error' : cur ? (changes.length ? 'update' : 'same') : 'new', staff, changes, errors };
  });
}

export function exportStaff(list, db, name = `H4ZP-staff-${todayIso()}.csv`) {
  const boss = (id) => db.directory.find((p) => p.id === id)?.emp_id || '';
  downloadCsv(name, [COLUMNS.map((c) => c[0]), ...list.map((s) => COLUMNS.map(([, k, kind]) => (kind === 'boss' ? boss(s[k]) : kind === 'days' ? (s[k] || []).map((d) => DAYS[d][0].toUpperCase() + DAYS[d].slice(1)).join('+')
    : kind === 'wo' ? (s[k] ? s[k][0].toUpperCase() + s[k].slice(1) : '') : kind === 'att' ? (s[k] === 'self' ? 'Self' : 'HR') : s[k] ?? '')))]);
}

export function ImportDialog({ db, act, store, onClose, nextId, canUsers, onCreds }) {
  const [plan, setPlan] = useState(null);
  const [fileName, setFileName] = useState('');
  const [logins, setLogins] = useState(canUsers);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const read = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setFileName(f.name);
    if (/\.xlsx?$/i.test(f.name)) { setPlan({ error: 'This is an Excel file. In Excel choose File → Save As → “CSV UTF-8 (Comma delimited)”, then choose that .csv file here.' }); return; }
    const rows = parseCsv(await f.text());
    if (rows.length < 2) { setPlan({ error: 'The file has no rows below the headings.' }); return; }
    if (!rows[0].some((h) => /emp id|full name/i.test(h))) { setPlan({ error: 'The first row must be the headings (Emp ID, Full Name, …). Download the template to see them.' }); return; }
    setPlan({ items: planImport(rows, db, nextId) });
  };
  const items = plan?.items || [];
  const n = (a) => items.filter((x) => x.action === a).length;
  const apply = async () => {
    setBusy(true); const creds = [], errs = [];
    await act(async (d) => {
      let cur = d;
      for (const it of items.filter((x) => x.action === 'new' || x.action === 'update')) {
        try {
          cur = await store.saveStaff(cur, it.staff);
          if (it.action === 'new' && logins) { const st = cur.staff.find((x) => x.emp_id === it.emp_id); const r = await store.createLoginFor(cur, st); cur = r.db; creds.push(r.cred); }
        } catch (x) { errs.push(`${it.emp_id}: ${x.message}`); }
      }
      return cur;
    }, `${n('new')} added, ${n('update')} updated`);
    setBusy(false); onClose();
    if (creds.length || errs.length) onCreds({ items: creds, note: errs.length ? `Problems: ${errs.join('; ')}` : '', title: `${creds.length} logins created` });
  };
  return (
    <Modal title="Add or update staff from Excel" onClose={onClose} size="wide"
      footer={<><button className="hr-btn" onClick={onClose}>Cancel</button>{items.length > 0 && <button className="hr-btn hr-btn--primary" disabled={busy || n('new') + n('update') === 0} onClick={apply}>{busy ? 'Saving…' : `Add ${n('new')} and update ${n('update')}`}</button>}</>}>
      <ol className="hr-steps">
        <li><b>Download</b> the <button className="hr-link" onClick={() => exportStaff([], db, 'H4ZP-staff-template.csv')}>blank template</button> (to add people) or the <button className="hr-link" onClick={() => exportStaff(db.staff, db)}>current staff list</button> (to change details).</li>
        <li><b>Fill it in Excel.</b> One person per row. Leave Emp ID blank and the next ID is given automatically. For existing staff, cells left blank are not changed. Dates like 15-11-2026 or 15-Nov-2026.</li>
        <li><b>Save as CSV</b> (File → Save As → CSV UTF-8), then choose the file: <input ref={ref} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={read} hidden /> <button className="hr-btn hr-btn--small" onClick={() => ref.current.click()}>Choose file</button> {fileName && <span className="hr-muted">{fileName}</span>}</li>
      </ol>
      {plan?.error && <p className="hr-error">{plan.error}</p>}
      {items.length > 0 && <>
        <p className="hr-small"><Badge tone="ok">{n('new')} new</Badge> <Badge tone="info">{n('update')} to update</Badge> <Badge tone="mute">{n('same')} unchanged</Badge> <Badge tone="bad">{n('error')} with problems (skipped)</Badge></p>
        {canUsers && n('new') > 0 && <label className="hr-small"><input type="checkbox" checked={logins} onChange={(e) => setLogins(e.target.checked)} /> Create logins for the new staff (User ID = Emp ID) and show their passwords to send</label>}
        <div className="hr-table-wrap" style={{ maxHeight: 340 }}><table className="hr-table"><thead><tr><th>Row</th><th>Emp ID</th><th>Name</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>{items.map((it) => <tr key={it.row}><td>{it.row}</td><td className="hr-mono">{it.emp_id}</td><td>{it.name}</td>
            <td><Badge tone={{ new: 'ok', update: 'info', same: 'mute', error: 'bad' }[it.action]}>{{ new: 'Add', update: 'Update', same: 'No change', error: 'Problem' }[it.action]}</Badge></td>
            <td className="hr-small">{it.errors.length ? <span className="hr-bad">{it.errors.join('; ')}</span> : it.action === 'update' ? `Changes: ${it.changes.join(', ')}` : ''}</td></tr>)}</tbody></table></div></>}
    </Modal>
  );
}
