import React, { useState } from 'react';
import { EXPENSE_CATEGORIES } from '../lib/defaults';
import { inr, fmtDate, todayIso, ymLabel } from '../lib/format';
import { Field, Input, Select, Badge, Empty, Stat } from '../components/ui';

const tone = { Approved: 'ok', Rejected: 'bad', Pending: 'warn', Cancelled: 'mute' };

export default function Expenses({ db, me, myStaff, act, store, manage, seeAll, months, monthIdx, notify }) {
  const [tab, setTab] = useState(manage && db.records.some((r) => r.kind === 'expense' && r.data.status === 'Pending') ? 'approve' : 'mine');
  const blank = { date: todayIso(), category: EXPENSE_CATEGORIES[0], amount: '', description: '', bill_no: '', staff_id: myStaff?.id || '' };
  const [f, setF] = useState(blank);
  const [payYm, setPayYm] = useState(months[monthIdx].ym);
  const all = db.records.filter((r) => r.kind === 'expense');
  const mine = all.filter((r) => r.staff_id === myStaff?.id);
  const pending = all.filter((r) => r.data.status === 'Pending' && (r.staff_id !== myStaff?.id || me.role === 'Admin'));
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const submit = async () => {
    const sid = manage ? f.staff_id : myStaff?.id;
    if (!sid) { notify('Choose the employee.', 'bad'); return; }
    if (!(Number(f.amount) > 0)) { notify('Enter the amount.', 'bad'); return; }
    if (await act((d) => store.saveRecord(d, { kind: 'expense', staff_id: sid, data: { date: f.date, category: f.category, amount: Number(f.amount), description: f.description, bill_no: f.bill_no, status: 'Pending' } }), 'Claim sent for approval')) setF(blank);
  };
  const decide = (r, status) => act((d) => store.saveRecord(d, { ...r, data: { ...r.data, status, pay_ym: status === 'Approved' ? payYm : undefined, decided_by: me.name || me.login, decided_on: todayIso() } }),
    status === 'Approved' ? `Approved — will be paid with ${ymLabel(payYm, true)} salary` : `Claim ${status.toLowerCase()}`);
  const sum = (rows, st) => rows.filter((r) => r.data.status === st).reduce((t, r) => t + Number(r.data.amount), 0);
  const tabs = [['mine', 'My claims'], ...(manage ? [['approve', `Approvals${pending.length ? ` (${pending.length})` : ''}`]] : []), ...(seeAll ? [['all', 'All claims']] : [])];
  const table = (rows, actions, withName) => rows.length === 0 ? <Empty title="No expense claims here" /> : (
    <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Date</th>{withName && <th>Employee</th>}<th>Category</th><th>Details</th><th>Bill no.</th><th className="hr-r">Amount</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtDate(r.data.date)}</td>{withName && <td>{name(r.staff_id)}</td>}<td>{r.data.category}</td><td>{r.data.description}</td><td>{r.data.bill_no || '—'}</td><td className="hr-r"><b>{inr(r.data.amount)}</b></td>
        <td><Badge tone={tone[r.data.status]}>{r.data.status}</Badge>{r.data.pay_ym && <small className="hr-sub">with {ymLabel(r.data.pay_ym)} salary</small>}</td>
        <td className="hr-r">{actions && r.data.status === 'Pending' && (r.staff_id !== myStaff?.id || me.role === 'Admin') && <><button className="hr-btn hr-btn--small hr-btn--primary" onClick={() => decide(r, 'Approved')}>Approve</button><button className="hr-btn hr-btn--small" onClick={() => decide(r, 'Rejected')}>Reject</button></>}
          {!actions && r.data.status === 'Pending' && <button className="hr-btn hr-btn--small" onClick={() => decide(r, 'Cancelled')}>Cancel</button>}
          {manage && r.data.status === 'Approved' && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={() => decide(r, 'Rejected')}>Revoke</button>}</td></tr>)}</tbody></table></div>);
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Expenses</h1><p className="hr-muted">Approved claims are added to the chosen month's salary as “Expense Reimbursement” — no PF, ESI or tax on them.</p></div></header>
      <div className="hr-tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'mine' && <>
        {myStaff && <section className="hr-grid hr-grid--stats"><Stat label="Waiting for approval" value={inr(sum(mine, 'Pending'))} tone="amber" /><Stat label="Approved this year" value={inr(sum(mine, 'Approved'))} tone="ok" /></section>}
        {(myStaff || manage) && <section className="hr-panel"><h2>New claim</h2><div className="hr-form">
          {manage && <Field label="Employee"><Select value={f.staff_id} onChange={(v) => setF({ ...f, staff_id: v })} options={db.staff.map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="Choose…" /></Field>}
          <Field label="Date of expense"><Input type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} /></Field>
          <Field label="Category"><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={EXPENSE_CATEGORIES} /></Field>
          <Field label="Amount (₹)"><Input type="number" min="0" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
          <Field label="Bill / receipt no."><Input value={f.bill_no} onChange={(v) => setF({ ...f, bill_no: v })} /></Field>
          <Field label="What was it for?" wide><Input value={f.description} onChange={(v) => setF({ ...f, description: v })} /></Field></div>
          <button className="hr-btn hr-btn--primary" onClick={submit}>Send claim</button></section>}
        {myStaff && table(mine, false, false)}</>}
      {tab === 'approve' && <>
        <div className="hr-toolbar"><label className="hr-field"><span className="hr-field__label">Pay approved claims with the salary of</span>
          <Select value={payYm} onChange={setPayYm} options={months.map((m) => ({ value: m.ym, label: ymLabel(m.ym, true) }))} /></label></div>
        {table(pending, true, true)}</>}
      {tab === 'all' && table(all, true, true)}
    </div>
  );
}
