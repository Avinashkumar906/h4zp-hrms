// Employee self-service attendance: mark attendance (clock in / out), see the month, request corrections.
import React, { useState } from 'react';
import { CODE_INFO } from '../lib/defaults';
import { days, fmtDate, todayIso, ymLabel, dayNum } from '../lib/format';
import { MonthRibbon, Stat, Field, Input, Select, Badge, Empty } from '../components/ui';
import { nowHM, hoursBetween } from './Home';
import { shiftOf, lateBy, rosterByStaff, weekOffMode, weekOffDays } from '../lib/payroll';
import { mondayOf } from './Roster';

const REQ = [['P', 'Present (forgot to clock in)'], ['P', 'On official duty / field visit'], ['HD', 'Half day']];
const tone = { Approved: 'ok', Rejected: 'bad', Pending: 'warn', Cancelled: 'mute' };

export default function MyAttendance({ db, myStaff, results, months, monthIdx, setMonthIdx, act, store, notify }) {
  const today = todayIso();
  const R = results[myStaff.id]; const r = R[monthIdx]; const mo = months[monthIdx];
  const punches = Object.fromEntries(db.records.filter((x) => x.kind === 'punch' && x.staff_id === myStaff.id).map((x) => [x.data.date, x]));
  const punch = punches[today];
  const todayRow = R.find((m) => m.start <= today && m.end >= today);
  const onToday = todayRow && todayRow.emp > 0;
  const self = myStaff.attendance_mode === 'self';
  const [req, setReq] = useState({ date: today, which: 0, reason: '' });
  const [ot, setOt] = useState({ date: today, type: 'day', hours: '', reason: '' });
  const S = db.settings;
  const myRoster = rosterByStaff(db.records)[myStaff.id] || {};
  const sh = (day) => shiftOf(myStaff, S, day, myRoster);
  const lateMins = (day) => (punches[day] ? lateBy(punches[day].data.in, sh(day), S.graceMins || 0) : 0);
  const myOt = db.records.filter((x) => x.kind === 'ot_request' && x.staff_id === myStaff.id);
  const askOt = async () => {
    if (!ot.date || ot.date > today) { notify('Choose a date up to today.', 'bad'); return; }
    if (ot.type === 'hours' && !(Number(ot.hours) > 0)) { notify('Enter the extra hours.', 'bad'); return; }
    if (myOt.some((x) => x.data.date === ot.date && x.data.type === ot.type && ['Pending', 'Approved'].includes(x.data.status))) { notify('You already asked for overtime on that date.', 'bad'); return; }
    if (await act((d) => store.saveRecord(d, { kind: 'ot_request', staff_id: myStaff.id, data: { date: ot.date, type: ot.type, hours: ot.type === 'hours' ? Number(ot.hours) : undefined, reason: ot.reason, status: 'Pending' } }), 'Overtime request sent')) setOt({ ...ot, hours: '', reason: '' });
  };
  const wk = mondayOf(today); const weekDays = Array.from({ length: 7 }, (_, i) => new Date((dayNum(wk) + i) * 86400000).toISOString().slice(0, 10));
  const mode = weekOffMode(myStaff, S);
  const mine = db.records.filter((x) => x.kind === 'att_request' && x.staff_id === myStaff.id);
  const clock = () => (punch
    ? act((d) => store.saveRecord(d, { ...punch, data: { ...punch.data, out: nowHM() } }), `Clocked out at ${nowHM()}`)
    : act((d) => store.saveRecord(d, { kind: 'punch', staff_id: myStaff.id, data: { date: today, in: nowHM() } }), `Attendance marked — clocked in at ${nowHM()}`));
  const ask = async () => {
    if (!req.date || req.date > today) { notify('Choose a date up to today.', 'bad'); return; }
    if (!req.reason.trim()) { notify('Add a short reason.', 'bad'); return; }
    if (mine.some((x) => x.data.date === req.date && x.data.status === 'Pending')) { notify('You already have a pending request for that date.', 'bad'); return; }
    const [code, label] = REQ[req.which];
    if (await act((d) => store.saveRecord(d, { kind: 'att_request', staff_id: myStaff.id, data: { date: req.date, code, label, reason: req.reason, status: 'Pending' } }), 'Request sent to HR')) setReq({ ...req, reason: '' });
  };
  // calendar
  const first = new Date(mo.start + 'T00:00:00Z').getUTCDay();
  const from = myStaff.status === 'Provisional' ? null : [myStaff.doj, myStaff.confirm_date].filter(Boolean).sort().pop();
  const cells = [...Array(first).fill(null), ...Array.from({ length: mo.dim }, (_, i) => i + 1)];
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>My attendance</h1><p className="hr-muted">{self ? 'Mark your attendance every working day. A past working day with no clock-in, leave or HR entry counts as Absent (covered from your CL, then EL, if available).' : 'HR keeps your attendance. Clocking in records your working hours.'}</p></div></header>
      <section className="hr-panel"><div className="hr-panel__head"><h2>My week</h2><span className="hr-muted hr-small">Shift {sh(today).name} {sh(today).start}–{sh(today).end} · Weekly off: {mode === 'flexible' ? 'any one day a week' : mode === 'roster' ? 'as per roster' : weekOffDays(myStaff, S).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</span></div>
        <div className="hr-week">{weekDays.map((d) => { const v = myRoster[d]; const r0 = v === 'OFF'; return <div key={d} className={'hr-week__d' + (d === today ? ' is-today' : '') + (r0 ? ' is-off' : '')}>
          <b>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekDays.indexOf(d)]} {Number(d.slice(8))}</b><span>{r0 ? 'Off' : `${sh(d).name} ${sh(d).start}`}</span></div>; })}</div></section>
      <section className="hr-grid hr-grid--two">
        <div className="hr-panel hr-clock">
          <div><h2>Today · {fmtDate(today)}</h2>
            {!onToday ? <p className="hr-muted">You are not on the payroll today ({todayRow ? todayRow.rowStatus : 'outside this financial year'}).</p>
              : punch ? <p className="hr-clock__time">{lateMins(today) > 0 && <span className="hr-late">Late {lateMins(today)} min · </span>}In {punch.data.in}{punch.data.out ? ` · Out ${punch.data.out} · ${hoursBetween(punch.data.in, punch.data.out).toFixed(1)} h` : ' · working'}</p>
                : <p className="hr-muted">Not marked yet.</p>}</div>
          {onToday && <button className={'hr-btn ' + (punch && !punch.data.out ? '' : 'hr-btn--primary')} disabled={!!(punch && punch.data.out)} onClick={clock}>{!punch ? 'Mark attendance' : punch.data.out ? 'Done for today' : 'Clock out'}</button>}
        </div>
        <div className="hr-panel"><h2>{ymLabel(mo.ym, true)}</h2><div className="hr-grid hr-grid--stats3">
          <Stat label="Paid days" value={days(r.paid)} /><Stat label="Leave" value={days(r.cnt.CL + r.cnt.SL + r.cnt.EL + r.clAdj + r.elAdj)} /><Stat label="Unpaid days" value={days(r.lop)} tone={r.lop > 0 ? 'bad' : undefined} /></div>
          <p className="hr-muted hr-small">Week offs {r.cnt.WO} · Overtime {r.ot || r.otHours ? `${r.ot ? `${days(r.ot)} day${r.ot === 1 ? '' : 's'}` : ''}${r.ot && r.otHours ? ' + ' : ''}${r.otHours ? `${r.otHours} h approved` : ''}` : 'none'} · Late {Object.keys(punches).filter((d) => d.startsWith(mo.ym) && lateMins(d) > 0).length} time(s)</p></div>
      </section>
      <MonthRibbon months={months} value={monthIdx} onChange={setMonthIdx} />
      <section className="hr-panel">
        <div className="hr-cal">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="hr-cal__h">{d}</div>)}
          {cells.map((d, i) => { if (!d) return <div key={'b' + i} className="hr-cal__d is-blank" />;
            const day = `${mo.ym}-${String(d).padStart(2, '0')}`; const p = punches[day];
            const off = (from && day < from) || (myStaff.dol && day > myStaff.dol) || myStaff.status === 'Provisional' || day > today;
            const c = r.codes[d] || (p ? 'P' : '');
            return <div key={day} className={'hr-cal__d' + (off ? ' is-off' : '') + (day === today ? ' is-today' : '') + (r.auto[d] ? ' is-auto' : '')} title={c ? CODE_INFO[c] + (r.auto[d] === 'flex' ? ' (first absence of the week became your week off)' : '') : ''}>
              <b>{d}</b>{!off && c && <span className={`hr-code hr-code--${c}`}>{c}</span>}{p && <span className={lateMins(day) > 0 ? 'hr-late' : ''}>{p.data.in}{p.data.out ? `–${p.data.out}` : ''}</span>}</div>; })}</div>
        <p className="hr-muted hr-small">P present · A absent · CL/SL/EL leave · HD half day · WO weekly off · HO holiday. Approved leave shows here automatically.</p>
      </section>
      <section className="hr-panel"><h2>Ask HR to correct a day</h2>
        <div className="hr-form">
          <Field label="Date"><Input type="date" value={req.date} max={today} onChange={(v) => setReq({ ...req, date: v })} /></Field>
          <Field label="Mark it as"><Select value={req.which} onChange={(v) => setReq({ ...req, which: Number(v) })} options={REQ.map(([, l], i) => ({ value: i, label: l }))} /></Field>
          <Field label="Reason" wide><Input value={req.reason} onChange={(v) => setReq({ ...req, reason: v })} placeholder="e.g. Was at the DCPU office for a child's case hearing" /></Field></div>
        <button className="hr-btn hr-btn--primary" onClick={ask}>Send request</button>
        <p className="hr-muted hr-small">For leave, use the Leave page instead.</p>
      </section>
      <section className="hr-panel"><h2>Ask for overtime</h2>
        <p className="hr-muted hr-small">Worked on your week off or a holiday, or stayed extra hours? Ask here; once HR approves, it is paid with that month’s salary.</p>
        <div className="hr-form">
          <Field label="Date"><Input type="date" value={ot.date} max={today} onChange={(v) => setOt({ ...ot, date: v })} /></Field>
          <Field label="Overtime"><Select value={ot.type} onChange={(v) => setOt({ ...ot, type: v })} options={[{ value: 'day', label: 'Worked on my week off / a holiday (full day)' }, { value: 'hours', label: 'Extra hours' }]} /></Field>
          {ot.type === 'hours' && <Field label="Hours"><Input type="number" min="0.5" step="0.5" value={ot.hours} onChange={(v) => setOt({ ...ot, hours: v })} /></Field>}
          <Field label="What was the work?" wide><Input value={ot.reason} onChange={(v) => setOt({ ...ot, reason: v })} placeholder="e.g. Covered night duty for a sick colleague" /></Field></div>
        <button className="hr-btn hr-btn--primary" onClick={askOt}>Send overtime request</button>
        {myOt.length > 0 && <div className="hr-table-wrap" style={{ marginTop: 12 }}><table className="hr-table"><thead><tr><th>Date</th><th>Overtime</th><th>Work</th><th>Status</th><th /></tr></thead>
          <tbody>{[...myOt].sort((a, b) => (a.data.date < b.data.date ? 1 : -1)).map((x) => <tr key={x.id}><td>{fmtDate(x.data.date)}</td><td>{x.data.type === 'hours' ? `${x.data.hours} h` : 'Full day'}</td><td>{x.data.reason}</td>
            <td><Badge tone={tone[x.data.status]}>{x.data.status}</Badge>{x.data.decided_by && <small className="hr-sub">by {x.data.decided_by}</small>}</td>
            <td className="hr-r">{x.data.status === 'Pending' && <button className="hr-btn hr-btn--small" onClick={() => act((d) => store.saveRecord(d, { ...x, data: { ...x.data, status: 'Cancelled' } }), 'Request cancelled')}>Cancel</button>}</td></tr>)}</tbody></table></div>}
        {mine.length > 0 && <div className="hr-table-wrap" style={{ marginTop: 12 }}><table className="hr-table"><thead><tr><th>Date</th><th>Asked for</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>{mine.sort((a, b) => (a.data.date < b.data.date ? 1 : -1)).map((x) => <tr key={x.id}><td>{fmtDate(x.data.date)}</td><td>{x.data.label}</td><td>{x.data.reason}</td>
            <td><Badge tone={tone[x.data.status]}>{x.data.status}</Badge>{x.data.decided_by && <small className="hr-sub">by {x.data.decided_by}</small>}</td>
            <td className="hr-r">{x.data.status === 'Pending' && <button className="hr-btn hr-btn--small" onClick={() => act((d) => store.saveRecord(d, { ...x, data: { ...x.data, status: 'Cancelled' } }), 'Request cancelled')}>Cancel</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
export const attRequestPending = (db) => db.records.filter((x) => x.kind === 'att_request' && x.data.status === 'Pending');
export const dateToYm = (date) => date.slice(0, 7);
export const dayOf = (date) => Number(date.slice(8, 10));
export { dayNum };
