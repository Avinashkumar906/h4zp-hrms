import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CODES, CODE_INFO } from '../lib/defaults';
import { inr, ymLabel, days } from '../lib/format';
import { MonthRibbon, Modal, Field, Input, Badge } from '../components/ui';

const EXTRA_FIELDS = [
  ['ot', 'OT days', 'number'], ['xabs', 'Absent days (if not marking the grid)', 'number'], ['nabs', 'Night absent days', 'number'],
  ['arrears', 'Arrears (₹)', 'number'], ['arrears_for', 'Arrears for (e.g. Sep 2026)', 'text'], ['bonus', 'Bonus (₹)', 'number'], ['bonus_type', 'Bonus type (e.g. Diwali Bonus 2026)', 'text'],
  ['incentive', 'Incentive (₹)', 'number'], ['other_earn', 'Other earnings (₹)', 'number'], ['tds_override', 'TDS this month (₹) — overrides the usual', 'number'],
  ['advance', 'Advance recovered (₹)', 'number'], ['other_ded', 'Other deduction (₹)', 'number'], ['loan_ded', 'Loan recovery (₹)', 'number'],
];

function Corrections({ db, me, act, store, dirty }) {
  const pending = db.records.filter((x) => x.kind === 'att_request' && x.data.status === 'Pending');
  if (!pending.length) return null;
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const decide = (x, ok) => {
    if (dirty && !window.confirm('Unsaved changes in the grid will be lost. Continue?')) return;
    act(async (d) => {
      let n = d;
      if (ok) { const ym = x.data.date.slice(0, 7), dd = Number(x.data.date.slice(8)); const a = d.attendance[x.staff_id]?.[ym] || { codes: {}, extra: {} };
        n = await store.saveAttendance(n, [{ staff_id: x.staff_id, ym, codes: { ...a.codes, [dd]: x.data.code }, extra: a.extra || {} }]); }
      return store.saveRecord(n, { ...x, data: { ...x.data, status: ok ? 'Approved' : 'Rejected', decided_by: me.name || me.login } });
    }, ok ? `Marked ${x.data.code} for ${name(x.staff_id)}` : 'Request rejected');
  };
  return (
    <section className="hr-panel hr-panel--todo"><h2>Attendance correction requests ({pending.length})</h2>
      <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Employee</th><th>Date</th><th>Asked for</th><th>Reason</th><th /></tr></thead>
        <tbody>{pending.map((x) => <tr key={x.id}><td>{name(x.staff_id)}</td><td>{x.data.date}</td><td>{x.data.label} <span className={`hr-code hr-code--${x.data.code}`}>{x.data.code}</span></td><td>{x.data.reason}</td>
          <td className="hr-r"><button className="hr-btn hr-btn--small hr-btn--primary" onClick={() => decide(x, true)}>Approve</button><button className="hr-btn hr-btn--small" onClick={() => decide(x, false)}>Reject</button></td></tr>)}</tbody></table></div>
    </section>
  );
}

export default function Attendance({ db, me, act, store, results, months, monthIdx, setMonthIdx, notify, manage }) {
  const mo = months[monthIdx];
  const [draft, setDraft] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [brush, setBrush] = useState('A');
  const [extraFor, setExtraFor] = useState(null);
  const painting = useRef(false);
  const holidays = useMemo(() => db.settings.holidays.map((h) => (h.md.startsWith('0') || h.md.startsWith('1') ? (Number(h.md.slice(0, 2)) >= 4 ? `${db.settings.fyStart}-${h.md}` : `${db.settings.fyStart + 1}-${h.md}`) : h.md)), [db.settings]);

  useEffect(() => {
    const d = {};
    for (const s of db.staff) { const a = db.attendance[s.id]?.[mo.ym]; d[s.id] = { codes: { ...(a?.codes || {}) }, extra: { ...(a?.extra || {}) } }; }
    setDraft(d); setDirty(new Set());
  }, [db, mo.ym]); // eslint-disable-line react-hooks/exhaustive-deps

  const punched = useMemo(() => new Set(db.records.filter((r) => r.kind === 'punch').map((r) => r.staff_id + r.data.date)), [db.records]);
  const staff = db.staff.filter((s) => results[s.id][monthIdx].emp > 0 || results[s.id][monthIdx].rowStatus === 'Provisional');
  const dayList = Array.from({ length: mo.dim }, (_, i) => i + 1);
  const dateOf = (d) => `${mo.ym}-${String(d).padStart(2, '0')}`;
  const weekday = (d) => new Date(dateOf(d) + 'T00:00:00Z').getUTCDay();
  const isOn = (s, d) => { const r = results[s.id][monthIdx]; if (r.emp === 0) return false; const day = dateOf(d);
    const from = s.status === 'Provisional' ? null : [s.doj, s.confirm_date].filter(Boolean).sort().pop();
    return (!from || day >= from) && (!s.dol || day <= s.dol); };

  const setCode = (sid, d, code) => {
    setDraft((p) => { const row = p[sid]; const codes = { ...row.codes }; if (code) codes[d] = code; else delete codes[d]; return { ...p, [sid]: { ...row, codes } }; });
    setDirty((p) => new Set(p).add(sid));
  };
  const bulk = (fn) => { const next = { ...draft }; const dd = new Set(dirty);
    for (const s of staff) { if (results[s.id][monthIdx].emp === 0) continue; const codes = { ...next[s.id].codes };
      for (const d of dayList) if (isOn(s, d)) { const v = fn(d, codes[d]); if (v !== undefined) { if (v) codes[d] = v; else delete codes[d]; } }
      next[s.id] = { ...next[s.id], codes }; dd.add(s.id); }
    setDraft(next); setDirty(dd); };
  const save = async () => {
    const rows = [...dirty].map((sid) => ({ staff_id: sid, ym: mo.ym, codes: draft[sid].codes, extra: draft[sid].extra }));
    if (await act((d) => store.saveAttendance(d, rows), `${ymLabel(mo.ym, true)} attendance saved`)) setDirty(new Set());
  };

  return (
    <div className="hr-page" onMouseUp={() => { painting.current = false; }}>
      <header className="hr-head"><div><h1>Attendance — {ymLabel(mo.ym, true)}</h1>
        <p className="hr-muted">Pick a code, then click or drag across days. Blank days are paid, so you can mark only absences and leave.</p></div>
        <div className="hr-head__actions"><button className="hr-btn hr-btn--primary" disabled={!dirty.size} onClick={save}>{dirty.size ? `Save ${dirty.size} change${dirty.size > 1 ? 's' : ''}` : 'Saved'}</button></div></header>
      {manage && <Corrections db={db} me={me} act={act} store={store} dirty={dirty.size > 0} />}
      <MonthRibbon months={months} value={monthIdx} onChange={(i) => { if (dirty.size && !window.confirm('You have unsaved attendance. Leave this month without saving?')) return; setMonthIdx(i); }} results={db.staff.map((s) => results[s.id])} />
      <div className="hr-toolbar">
        <div className="hr-palette" role="radiogroup" aria-label="Attendance code">
          {CODES.map((c) => <button key={c} role="radio" aria-checked={brush === c} title={CODE_INFO[c]} className={`hr-code hr-code--${c}` + (brush === c ? ' is-on' : '')} onClick={() => setBrush(c)}>{c}</button>)}
          <button role="radio" aria-checked={brush === ''} className={'hr-code hr-code--clear' + (brush === '' ? ' is-on' : '')} onClick={() => setBrush('')} title="Clear">Clear</button>
        </div>
        <div className="hr-head__actions">
          <button className="hr-btn hr-btn--small" onClick={() => bulk((d, v) => (weekday(d) === 0 && !v ? 'WO' : undefined))}>Sundays → WO</button>
          <button className="hr-btn hr-btn--small" onClick={() => bulk((d, v) => (holidays.includes(dateOf(d)) && !v ? 'HO' : undefined))}>Holidays → HO</button>
          <button className="hr-btn hr-btn--small" onClick={() => bulk((d, v) => (!v ? 'P' : undefined))}>Blank → P</button>
        </div>
      </div>
      {staff.length === 0 ? <p className="hr-muted">No one is on payroll in {ymLabel(mo.ym, true)}.</p> : (
        <div className="hr-table-wrap">
          <table className="hr-att">
            <thead><tr><th className="hr-att__name">Employee</th>{dayList.map((d) => <th key={d} className={(weekday(d) === 0 ? 'is-sun ' : '') + (holidays.includes(dateOf(d)) ? 'is-hol' : '')}>{d}<small>{'SMTWTFS'[weekday(d)]}</small></th>)}
              <th>Paid days</th><th>Leave used</th><th>LOP</th><th>Extras</th></tr></thead>
            <tbody>{staff.map((s) => { const r = results[s.id][monthIdx]; const row = draft[s.id] || { codes: {}, extra: {} };
              const extrasN = Object.values(row.extra || {}).filter((v) => v !== '' && v != null && v !== 0).length;
              return (
                <tr key={s.id} className={r.emp === 0 ? 'is-off' : ''}>
                  <td className="hr-att__name"><strong>{s.name}</strong><span>{r.emp === 0 ? r.rowStatus : s.designation}</span></td>
                  {dayList.map((d) => { const on = isOn(s, d); const auto = !row.codes[d] && r.codes[d]; const c = row.codes[d] || r.codes[d] || ''; const pin = punched.has(s.id + dateOf(d));
                    return <td key={d} className={`hr-att__c ${c ? 'hr-code--' + c : ''} ${weekday(d) === 0 ? 'is-sun' : ''} ${on ? '' : 'is-na'} ${auto ? 'is-auto' : ''} ${pin ? 'is-in' : ''}`}
                      onMouseDown={() => { if (!on) return; painting.current = true; setCode(s.id, d, brush); }}
                      onMouseEnter={() => { if (on && painting.current) setCode(s.id, d, brush); }}
                      title={on ? `${s.name}, ${d} ${ymLabel(mo.ym)}${c ? ': ' + CODE_INFO[c] : ''}` : 'Not on payroll'}>{on ? c : ''}</td>; })}
                  <td className="hr-r">{days(r.paid)}</td><td className="hr-r">{days(r.clAdj + r.elAdj + r.cnt.CL + r.cnt.EL + r.cnt.SL)}</td><td className="hr-r">{days(r.lop)}</td>
                  <td>{r.emp > 0 && <button className="hr-btn hr-btn--small" onClick={() => setExtraFor(s)}>{extrasN ? <>Edit <Badge tone="info">{extrasN}</Badge></> : 'Add'}</button>}</td>
                </tr>); })}</tbody>
          </table>
        </div>)}
      <p className="hr-muted hr-small">Italic codes come from approved leave requests; a dot marks a day the person clocked in. Paid days, leave and LOP update after you save. Absent (A) and half-days (HD) are covered from CL first, then EL; only what is left is unpaid.</p>
      {extraFor && <ExtrasDialog s={extraFor} mo={mo} row={draft[extraFor.id]} onClose={() => setExtraFor(null)}
        onSave={(extra) => { setDraft((p) => ({ ...p, [extraFor.id]: { ...p[extraFor.id], extra } })); setDirty((p) => new Set(p).add(extraFor.id)); setExtraFor(null); notify('Added — remember to save the month'); }} />}
    </div>
  );
}

function ExtrasDialog({ s, mo, row, onClose, onSave }) {
  const [x, setX] = useState({ ...(row?.extra || {}) });
  return (
    <Modal title={`${s.name} — ${ymLabel(mo.ym, true)}`} onClose={onClose}
      footer={<><button className="hr-btn" onClick={onClose}>Cancel</button><button className="hr-btn hr-btn--primary" onClick={() => onSave(x)}>Apply</button></>}>
      <div className="hr-form">{EXTRA_FIELDS.map(([k, l, t]) => <Field key={k} label={l}><Input type={t} min={t === 'number' ? '0' : undefined} value={x[k]} onChange={(v) => setX({ ...x, [k]: t === 'number' && v !== '' ? Number(v) : v })} /></Field>)}</div>
      {Number(x.loan_ded) > 0 && Number(s.loan_given) <= 0 && <p className="hr-hint">No loan is recorded for {s.name} on the Staff page.</p>}
      <p className="hr-muted hr-small">PF is not charged on these extras. ESI is charged on the Basic share of arrears; bonus is excluded. Net change this month: {inr((Number(x.arrears) || 0) + (Number(x.bonus) || 0) + (Number(x.incentive) || 0) + (Number(x.other_earn) || 0) - (Number(x.advance) || 0) - (Number(x.other_ded) || 0) - (Number(x.loan_ded) || 0))}</p>
    </Modal>
  );
}
