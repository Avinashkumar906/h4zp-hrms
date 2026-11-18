import React from 'react';
import { inr, days, fmtDate, fmtLongDate, todayIso, ymLabel } from '../lib/format';
import { Stat, Badge, payTone } from '../components/ui';

export const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const hoursBetween = (a, b) => { if (!a || !b) return 0; const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number); return Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60); };
export function leaveBalances(st, R, S, opening) {
  const last = R[R.length - 1];
  const slTaken = R.reduce((t, r) => t + r.cnt.SL, 0);
  return { CL: last.clClose, EL: last.elClose, SL: (Number(st.opening_sl) || 0) + opening - slTaken };
}

export default function Home({ db, me, myStaff, results, months, monthIdx, act, store, go, can }) {
  const today = todayIso();
  const S = db.settings;
  const R = myStaff ? results[myStaff.id] : null;
  const cur = R ? R[monthIdx] : null;
  const onRoll = cur && cur.emp > 0;
  const punch = myStaff && db.records.find((r) => r.kind === 'punch' && r.staff_id === myStaff.id && r.data.date === today);
  const clock = () => (punch
    ? act((d) => store.saveRecord(d, { ...punch, data: { ...punch.data, out: nowHM() } }), `Clocked out at ${nowHM()}`)
    : act((d) => store.saveRecord(d, { kind: 'punch', staff_id: myStaff.id, data: { date: today, in: nowHM() } }), `Clocked in at ${nowHM()}`));
  const holidays = S.holidays.map((h) => ({ ...h, date: `${Number(h.md.slice(0, 2)) >= 4 ? S.fyStart : S.fyStart + 1}-${h.md}` })).filter((h) => h.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 5);
  const mm = today.slice(5, 7);
  const birthdays = db.directory.filter((p) => p.dob_md && p.dob_md.slice(0, 2) === mm && !['Resigned', 'Terminated', 'Absconding', 'Inactive'].includes(p.status));
  const anniversaries = db.directory.filter((p) => p.doj && p.doj.slice(5, 7) === mm && p.doj.slice(0, 4) < today.slice(0, 4));
  const news = db.records.filter((r) => r.kind === 'announcement').sort((a, b) => (b.data.pinned ? 1 : 0) - (a.data.pinned ? 1 : 0)).slice(0, 4);
  const mine = db.records.filter((r) => myStaff && r.staff_id === myStaff.id && ['leave_request', 'expense', 'ticket'].includes(r.kind)).slice(0, 5);
  const pendingLeave = can.edit('leave') ? db.records.filter((r) => r.kind === 'leave_request' && r.data.status === 'Pending' && (r.staff_id !== myStaff?.id || me.role === 'Admin')).length : 0;
  const pendingExp = can.edit('expenses') ? db.records.filter((r) => r.kind === 'expense' && r.data.status === 'Pending' && (r.staff_id !== myStaff?.id || me.role === 'Admin')).length : 0;
  const pendingAtt = can.edit('attendance') ? db.records.filter((r) => ['att_request', 'ot_request'].includes(r.kind) && r.data.status === 'Pending').length : 0;
  const newDocs = myStaff ? db.records.filter((r) => r.kind === 'document' && r.staff_id === myStaff.id && r.data.shared !== false && (r.data.date || r.data.uploaded_on || '') >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)) : [];
  const openTickets = can.view('helpdesk') ? db.records.filter((r) => r.kind === 'ticket' && r.data.status === 'Open' && r.staff_id !== myStaff?.id).length : 0;
  const bal = R ? leaveBalances(myStaff, R, S, myStaff.status === 'Provisional' ? 0 : S.leave.SL) : null;
  const hour = new Date().getHours();

  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, {(myStaff?.name || me.name || me.login).split(' ')[0]}</h1>
        <p className="hr-muted">{fmtLongDate(today)}{myStaff ? ` · ${myStaff.designation}` : ''}</p></div></header>

      {myStaff && <div className="hr-head__actions">
        <button className="hr-btn" onClick={() => go('myatt')}>My attendance</button><button className="hr-btn" onClick={() => go('leave')}>Apply for leave</button>
        <button className="hr-btn" onClick={() => go('mydocs')}>My documents{newDocs.length ? ` (${newDocs.length} new)` : ''}</button><button className="hr-btn" onClick={() => go('mypay')}>Payslips</button>
        <button className="hr-btn" onClick={() => go('expenses')}>Claim an expense</button></div>}
      {(pendingLeave + pendingExp + openTickets + pendingAtt > 0) && <section className="hr-panel hr-panel--todo">
        <h2>Waiting for you</h2>
        <div className="hr-head__actions">
          {pendingLeave > 0 && <button className="hr-btn" onClick={() => go('leave')}>{pendingLeave} leave request{pendingLeave > 1 ? 's' : ''} to approve</button>}
          {pendingExp > 0 && <button className="hr-btn" onClick={() => go('expenses')}>{pendingExp} expense claim{pendingExp > 1 ? 's' : ''} to approve</button>}
          {pendingAtt > 0 && <button className="hr-btn" onClick={() => go('attendance')}>{pendingAtt} attendance / overtime request{pendingAtt > 1 ? 's' : ''} to approve</button>}
          {openTickets > 0 && <button className="hr-btn" onClick={() => go('helpdesk')}>{openTickets} open helpdesk ticket{openTickets > 1 ? 's' : ''}</button>}
        </div></section>}

      {!myStaff && <section className="hr-panel"><p className="hr-muted">This login is not linked to an employee record, so there is no personal attendance, leave or pay to show. An administrator can link it under Users & permissions.</p></section>}

      {myStaff && <section className="hr-grid hr-grid--two">
        <div className="hr-panel hr-clock">
          <div><h2>Today</h2>
            {!onRoll ? <p className="hr-muted">You are not on the payroll this month ({cur.rowStatus}). Attendance starts once you are confirmed.</p>
              : punch ? <p className="hr-clock__time">In {punch.data.in}{punch.data.out ? ` · Out ${punch.data.out} · ${hoursBetween(punch.data.in, punch.data.out).toFixed(1)} h` : ' · working'}</p>
                : <p className="hr-muted">You have not clocked in yet.</p>}</div>
          {onRoll && <button className={'hr-btn ' + (punch && !punch.data.out ? '' : 'hr-btn--primary')} disabled={punch && punch.data.out} onClick={clock}>{!punch ? 'Mark attendance' : punch.data.out ? 'Done for today' : 'Clock out'}</button>}
        </div>
        <div className="hr-panel"><div className="hr-panel__head"><h2>Leave balance</h2><button className="hr-link" onClick={() => go('leave')}>Apply for leave</button></div>
          <div className="hr-grid hr-grid--stats3"><Stat label="Casual" value={days(bal.CL)} /><Stat label="Sick" value={days(bal.SL)} /><Stat label="Earned" value={days(bal.EL)} /></div></div>
      </section>}

      {myStaff && onRoll && <section className="hr-panel"><div className="hr-panel__head"><h2>{ymLabel(cur.ym, true)}</h2><button className="hr-link" onClick={() => go('mypay')}>See payslip</button></div>
        <div className="hr-grid hr-grid--stats">
          <Stat label="Paid days" value={days(cur.paid)} /><Stat label="Leave used" value={days(cur.cnt.CL + cur.cnt.SL + cur.cnt.EL + cur.clAdj + cur.elAdj)} /><Stat label="Unpaid days" value={days(cur.lop)} tone={cur.lop > 0 ? 'bad' : undefined} />
          <Stat label="Net pay" value={inr(cur.net)} /><Stat label="Salary status" value={cur.thisSalary || '—'} tone={cur.thisSalary?.startsWith('Paid') ? 'ok' : undefined} />
        </div></section>}

      <section className="hr-grid hr-grid--three">
        <div className="hr-panel"><div className="hr-panel__head"><h2>Announcements</h2></div>
          {news.length === 0 ? <p className="hr-muted">No announcements.</p> : <ul className="hr-feed">{news.map((n) => <li key={n.id}><b>{n.data.title}</b><p>{n.data.body}</p><small>{fmtDate((n.created_at || '').slice(0, 10))}</small></li>)}</ul>}</div>
        <div className="hr-panel"><h2>Coming up</h2>
          <ul className="hr-counts">{holidays.map((h) => <li key={h.date}><span>{h.name}</span><b>{fmtDate(h.date)}</b></li>)}
            {birthdays.map((p) => <li key={'b' + p.id}><span>🎂 {p.name}</span><b>{p.dob_md.slice(3)}-{mm}</b></li>)}
            {anniversaries.map((p) => <li key={'a' + p.id}><span>🎉 {p.name} — {Number(today.slice(0, 4)) - Number(p.doj.slice(0, 4))} yr at H4ZP</span><b>{p.doj.slice(8)}-{mm}</b></li>)}
            {holidays.length + birthdays.length + anniversaries.length === 0 && <li><span className="hr-muted">Nothing this month.</span></li>}</ul></div>
        <div className="hr-panel"><h2>My recent requests</h2>
          {mine.length === 0 ? <p className="hr-muted">No requests yet.</p> : <ul className="hr-counts">{mine.map((r) => <li key={r.id}>
            <span>{r.kind === 'leave_request' ? `${r.data.type} ${fmtDate(r.data.from)}` : r.kind === 'expense' ? `${r.data.category} ${inr(r.data.amount)}` : r.data.subject}</span>
            <Badge tone={payTone({ Approved: 'Paid', Rejected: 'Due', Pending: 'Partial', Open: 'Partial', Closed: 'Paid' }[r.data.status])}>{r.data.status}</Badge></li>)}</ul>}</div>
      </section>
    </div>
  );
}
