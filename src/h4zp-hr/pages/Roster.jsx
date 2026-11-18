// Weekly shift roster: who works which shift each day, and who is off.
import React, { useEffect, useMemo, useState } from 'react';
import { EXITED } from '../lib/defaults';
import { todayIso, fmtDate, dayNum, iso } from '../lib/format';
import { offDayFn, shiftOf, weekOffMode } from '../lib/payroll';
import { logoOf } from '../lib/brand';
import { Empty } from '../components/ui';

export const mondayOf = (day) => { const dn = dayNum(day); return iso(new Date((dn - ((new Date(dn * 86400000).getUTCDay() + 6) % 7)) * 86400000)); };
const addDays = (day, n) => iso(new Date((dayNum(day) + n) * 86400000));
export const rosterRec = (db, week) => db.records.find((r) => r.kind === 'roster' && r.data.week === week);

export default function Roster({ db, act, store, manage }) {
  const S = db.settings;
  const [week, setWeek] = useState(mondayOf(todayIso()));
  const [cells, setCells] = useState({});
  const [dirty, setDirty] = useState(false);
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const staff = db.staff.filter((s) => !EXITED.includes(s.status) && s.status !== 'Provisional');
  useEffect(() => { setCells(JSON.parse(JSON.stringify(rosterRec(db, week)?.data.cells || {}))); setDirty(false); }, [db, week]);
  const setCell = (sid, day, v) => { setCells((p) => { const n = { ...p, [sid]: { ...(p[sid] || {}) } }; if (v) n[sid][day] = v; else delete n[sid][day]; return n; }); setDirty(true); };
  const go = (n) => { if (dirty && !window.confirm('Leave this week without saving?')) return; setWeek(addDays(week, n * 7)); };
  const copyPrev = () => {
    const prev = rosterRec(db, addDays(week, -7))?.data.cells || {}; const n = {};
    for (const [sid, c] of Object.entries(prev)) { n[sid] = {}; for (const [d, v] of Object.entries(c)) n[sid][addDays(d, 7)] = v; }
    setCells(n); setDirty(true);
  };
  const save = async () => {
    const clean = Object.fromEntries(Object.entries(cells).filter(([, c]) => Object.keys(c).length));
    const rec = rosterRec(db, week);
    if (await act((d) => store.saveRecord(d, rec ? { ...rec, data: { ...rec.data, cells: clean } } : { kind: 'roster', staff_id: null, data: { week, cells: clean } }), 'Roster saved — staff can see it in My attendance')) setDirty(false);
  };
  const defaults = useMemo(() => Object.fromEntries(staff.map((s) => { const off = offDayFn(s, S, {}); return [s.id, (day) => (weekOffMode(s, S) !== 'flexible' && off(day) ? 'Off' : shiftOf(s, S).name)]; })), [staff, S]);
  const opts = [...(S.shifts || []).map((x) => x.name), 'OFF'];
  return (
    <div className="hr-page">
      <header className="hr-head no-print"><div><h1>Roster</h1><p className="hr-muted">Plan each person’s shift and day off for the week. Blank = their usual shift and week-off. A day set to OFF counts as their weekly off.</p></div>
        <div className="hr-head__actions"><button className="hr-btn" onClick={() => go(-1)}>‹ Previous week</button><button className="hr-btn" onClick={() => { if (!dirty || window.confirm('Leave without saving?')) setWeek(mondayOf(todayIso())); }}>This week</button><button className="hr-btn" onClick={() => go(1)}>Next week ›</button>
          {manage && <><button className="hr-btn" onClick={copyPrev}>Copy previous week</button><button className="hr-btn hr-btn--primary" disabled={!dirty} onClick={save}>{dirty ? 'Save roster' : 'Saved'}</button></>}
          <button className="hr-btn" onClick={() => window.print()}>Print</button></div></header>
      {staff.length === 0 ? <Empty title="No staff on the payroll yet" /> : (
        <div className="print-area print-landscape">
          <div className="hr-print-head"><img src={logoOf(S)} alt="" /><div><h2>{S.org}</h2><p>Duty roster — week of {fmtDate(week)} to {fmtDate(addDays(week, 6))}</p></div></div>
          <div className="hr-table-wrap"><table className="hr-table hr-roster"><thead><tr><th>Employee</th>{daysOfWeek.map((d) => <th key={d} className={d === todayIso() ? 'is-today' : ''}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][daysOfWeek.indexOf(d)]}<small className="hr-sub">{fmtDate(d).slice(0, 6)}</small></th>)}</tr></thead>
            <tbody>{staff.map((s) => <tr key={s.id}><td><b>{s.name}</b><small className="hr-sub">{s.designation}{weekOffMode(s, S) === 'flexible' ? ' · any 1 day off' : ''}</small></td>
              {daysOfWeek.map((d) => { const v = cells[s.id]?.[d] || ''; const def = defaults[s.id](d);
                return <td key={d} className={v === 'OFF' || (!v && def === 'Off') ? 'is-off' : ''}>
                  {manage ? <select className="hr-input hr-input--small no-print" value={v} onChange={(e) => setCell(s.id, d, e.target.value)} aria-label={`${s.name} ${d}`}><option value="">{def}</option>{opts.map((o) => <option key={o} value={o}>{o === 'OFF' ? 'Off' : o}</option>)}</select> : null}
                  <span className={manage ? 'print-only' : ''}>{v ? (v === 'OFF' ? 'Off' : v) : def}</span></td>; })}</tr>)}</tbody></table></div>
          <p className="hr-muted hr-small">Shifts: {(S.shifts || []).map((x) => `${x.name} ${x.start}–${x.end}`).join(' · ')}. Change shifts in Settings.</p>
        </div>)}
    </div>
  );
}
