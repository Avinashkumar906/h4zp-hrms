import React, { useState } from 'react';
import { fmtDate, todayIso } from '../lib/format';
import { Empty, Select } from '../components/ui';
import { hoursBetween } from './Home';
import { shiftOf, lateBy, rosterByStaff } from '../lib/payroll';

export default function TimeLog({ db, myStaff, seeAll, manage, act, store }) {
  const [who, setWho] = useState(seeAll ? '' : myStaff?.id || '');
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const rows = db.records.filter((r) => r.kind === 'punch' && (!who || r.staff_id === who) && r.data.date.startsWith(month)).sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const rosters = rosterByStaff(db.records);
  const total = rows.reduce((t, r) => t + hoursBetween(r.data.in, r.data.out), 0);
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Clock-in log</h1><p className="hr-muted">Clock in and out from Home. {rows.length} day{rows.length === 1 ? '' : 's'} · {total.toFixed(1)} hours in the month shown.</p></div>
        <div className="hr-head__actions"><input className="hr-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
          {seeAll && <Select value={who} onChange={setWho} options={db.staff.map((s) => ({ value: s.id, label: s.name }))} placeholder="Everyone" aria-label="Employee" />}</div></header>
      {rows.length === 0 ? <Empty title="No clock-ins for this month" /> : (
        <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Date</th>{seeAll && <th>Employee</th>}<th>In</th><th>Out</th><th className="hr-r">Hours</th><th>Late</th><th /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtDate(r.data.date)}</td>{seeAll && <td>{name(r.staff_id)}</td>}<td>{r.data.in}</td><td>{r.data.out || <span className="hr-muted">not clocked out</span>}</td>
            <td className="hr-r">{r.data.out ? hoursBetween(r.data.in, r.data.out).toFixed(1) : '–'}</td>
            <td>{(() => { const st = db.staff.find((s) => s.id === r.staff_id); if (!st) return '–'; const m = lateBy(r.data.in, shiftOf(st, db.settings, r.data.date, rosters[r.staff_id] || {}), db.settings.graceMins || 0); return m > 0 ? <span className="hr-late">{m} min</span> : 'On time'; })()}</td>
            <td className="hr-r">{manage && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={() => window.confirm('Delete this clock-in?') && act((d) => store.deleteRecord(d, r.id), 'Clock-in deleted')}>Delete</button>}</td></tr>)}</tbody></table></div>)}
      <p className="hr-muted hr-small">Clock-ins are a record of hours. Salary is still worked out from the attendance grid and approved leave.</p>
    </div>
  );
}
