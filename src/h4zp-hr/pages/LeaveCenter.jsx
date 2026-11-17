import React, { useState } from 'react';
import { LEAVE_TYPES } from '../lib/defaults';
import { days, fmtDate, todayIso, dayNum } from '../lib/format';
import { Field, Input, Select, Badge, Stat, Empty } from '../components/ui';
import LeaveRegister from './Leave';
import { leaveBalances } from './Home';

const tone = { Approved: 'ok', Rejected: 'bad', Pending: 'warn', Cancelled: 'mute' };
export function leaveDays(req, S) {
  if (!req.from) return 0; if (req.half) return 0.5;
  const hol = new Set(S.holidays.map((h) => `${Number(h.md.slice(0, 2)) >= 4 ? S.fyStart : S.fyStart + 1}-${h.md}`)); let n = 0;
  for (let d = dayNum(req.from); d <= dayNum(req.to || req.from); d++) { const dt = new Date(d * 86400000); if (dt.getUTCDay() !== 0 && !hol.has(dt.toISOString().slice(0, 10))) n++; }
  return n;
}

export default function LeaveCenter(ctx) {
  const { db, me, myStaff, results, act, store, manage, seeAll, notify } = ctx;
  const S = db.settings;
  const [tab, setTab] = useState(manage && db.records.some((r) => r.kind === 'leave_request' && r.data.status === 'Pending') ? 'approve' : 'mine');
  const blank = { type: 'CL', from: todayIso(), to: todayIso(), half: false, reason: '', staff_id: myStaff?.id || '' };
  const [f, setF] = useState(blank);
  const reqs = db.records.filter((r) => r.kind === 'leave_request');
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const balOf = (sid) => { const st = db.staff.find((s) => s.id === sid); return st && results[sid] ? leaveBalances(st, results[sid], S, st.status === 'Provisional' ? 0 : S.leave.SL) : null; };
  const target = db.staff.find((s) => s.id === f.staff_id);
  const n = leaveDays(f, S); const bal = target ? balOf(target.id) : null;
  const short = bal && f.type !== 'LWP' && n > bal[f.type];
  const apply = async () => {
    if (!target) { notify('Choose the employee.', 'bad'); return; }
    if (target.status === 'Provisional') { notify('Provisional staff have no leave until confirmed.', 'bad'); return; }
    if (f.to < f.from) { notify('The end date is before the start date.', 'bad'); return; }
    if (n === 0) { notify('Those dates are all Sundays or holidays.', 'bad'); return; }
    const byHr = manage && target.id !== myStaff?.id;
    const data = { type: f.type, from: f.from, to: f.half ? f.from : f.to, half: f.half, reason: f.reason, days: n, status: byHr ? 'Approved' : 'Pending', decided_by: byHr ? me.name || me.login : undefined };
    if (await act((d) => store.saveRecord(d, { kind: 'leave_request', staff_id: target.id, data }), byHr ? 'Leave recorded and approved' : 'Leave request sent for approval')) setF(blank);
  };
  const decide = (r, status) => act((d) => store.saveRecord(d, { ...r, data: { ...r.data, status, decided_by: me.name || me.login, decided_on: todayIso() } }), `Leave ${status.toLowerCase()}`);
  const mine = reqs.filter((r) => r.staff_id === myStaff?.id);
  const pending = reqs.filter((r) => r.data.status === 'Pending' && (r.staff_id !== myStaff?.id || me.role === 'Admin'));
  const myBal = myStaff ? balOf(myStaff.id) : null;
  const tabs = [['mine', 'My leave'], ...(manage ? [['approve', `Approvals${pending.length ? ` (${pending.length})` : ''}`]] : []), ...(seeAll ? [['all', 'All requests'], ['register', 'Leave register']] : [])];

  const table = (rows, withActions, withName) => rows.length === 0 ? <Empty title="No leave requests here" /> : (
    <div className="hr-table-wrap"><table className="hr-table"><thead><tr>{withName && <th>Employee</th>}<th>Type</th><th>From</th><th>To</th><th className="hr-r">Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
      <tbody>{rows.map((r) => { const b = withActions ? balOf(r.staff_id) : null; return <tr key={r.id}>{withName && <td>{name(r.staff_id)}</td>}
        <td><span className={`hr-code hr-code--${r.data.half ? 'HD' : r.data.type}`}>{r.data.type}{r.data.half ? ' ½' : ''}</span></td><td>{fmtDate(r.data.from)}</td><td>{fmtDate(r.data.to)}</td><td className="hr-r">{days(r.data.days)}</td>
        <td>{r.data.reason}{b && r.data.type !== 'LWP' && <small className="hr-sub">Balance now: {days(b[r.data.type])} {r.data.type}</small>}</td>
        <td><Badge tone={tone[r.data.status]}>{r.data.status}</Badge>{r.data.decided_by && <small className="hr-sub">by {r.data.decided_by}</small>}</td>
        <td className="hr-r">{withActions && r.data.status === 'Pending' && (r.staff_id !== myStaff?.id || me.role === 'Admin') && <><button className="hr-btn hr-btn--small hr-btn--primary" onClick={() => decide(r, 'Approved')}>Approve</button><button className="hr-btn hr-btn--small" onClick={() => decide(r, 'Rejected')}>Reject</button></>}
          {!withActions && r.data.status === 'Pending' && r.staff_id === myStaff?.id && <button className="hr-btn hr-btn--small" onClick={() => decide(r, 'Cancelled')}>Cancel</button>}
          {manage && r.data.status === 'Approved' && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={() => decide(r, 'Cancelled')}>Revoke</button>}</td></tr>; })}</tbody></table></div>);

  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Leave</h1><p className="hr-muted">Approved leave is marked in attendance and salary automatically. Sundays and holidays inside a request are not counted.</p></div></header>
      <div className="hr-tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'mine' && <>
        {myBal && <section className="hr-grid hr-grid--stats"><Stat label="Casual leave left" value={days(myBal.CL)} /><Stat label="Sick leave left" value={days(myBal.SL)} /><Stat label="Earned leave left" value={days(myBal.EL)} /></section>}
        {(myStaff || manage) && <section className="hr-panel"><h2>{manage ? 'Apply or record leave' : 'Apply for leave'}</h2>
          <div className="hr-form">
            {manage && <Field label="Employee"><Select value={f.staff_id} onChange={(v) => setF({ ...f, staff_id: v })} options={db.staff.filter((s) => !s.dol).map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="Choose…" /></Field>}
            <Field label="Leave type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={LEAVE_TYPES.map((t) => ({ value: t, label: { CL: 'Casual leave', SL: 'Sick leave', EL: 'Earned leave', LWP: 'Leave without pay' }[t] }))} /></Field>
            <Field label="From"><Input type="date" value={f.from} onChange={(v) => setF({ ...f, from: v, to: v > f.to ? v : f.to })} /></Field>
            <Field label="To"><Input type="date" value={f.half ? f.from : f.to} disabled={f.half} onChange={(v) => setF({ ...f, to: v })} /></Field>
            <Field label="Half day"><Select value={f.half ? 'Y' : 'N'} onChange={(v) => setF({ ...f, half: v === 'Y' })} options={[{ value: 'N', label: 'No — full days' }, { value: 'Y', label: 'Yes — half day' }]} /></Field>
            <Field label="Reason" wide><Input value={f.reason} onChange={(v) => setF({ ...f, reason: v })} /></Field>
          </div>
          <p className="hr-small">{n} working day{n === 1 ? '' : 's'}{bal && f.type !== 'LWP' ? ` · ${days(bal[f.type])} ${f.type} available` : ''}</p>
          {short && <p className="hr-hint">That is more than the {f.type} balance. The extra days will show as a negative balance — consider Leave without pay for them.</p>}
          <button className="hr-btn hr-btn--primary" onClick={apply}>{manage && target && target.id !== myStaff?.id ? 'Record leave' : 'Send request'}</button></section>}
        {myStaff && table(mine, false, false)}</>}
      {tab === 'approve' && table(pending, true, true)}
      {tab === 'all' && table(reqs, true, true)}
      {tab === 'register' && <LeaveRegister {...ctx} embedded />}
    </div>
  );
}
