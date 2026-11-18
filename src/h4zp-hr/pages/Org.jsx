import React, { useState } from 'react';
import { EXITED } from '../lib/defaults';
import { fmtDate } from '../lib/format';
import { Badge, statusTone, Avatar } from '../components/ui';
import { photoOf } from '../lib/brand';

function Node({ p, kids, depth = 0 }) {
  const children = kids[p.id] || [];
  return (
    <li><div className="hr-org__card"><b>{p.name}</b><span>{p.designation}</span>{p.status === 'Provisional' && <Badge tone="amber">Provisional</Badge>}</div>
      {children.length > 0 && <ul>{children.map((c) => <Node key={c.id} p={c} kids={kids} depth={depth + 1} />)}</ul>}</li>
  );
}

export default function Org({ db }) {
  const [tab, setTab] = useState('people');
  const [q, setQ] = useState('');
  const S = db.settings;
  const people = db.directory.filter((p) => !EXITED.includes(p.status));
  const ids = new Set(people.map((p) => p.id));
  const kids = {}; const roots = [];
  for (const p of people) { if (p.reports_to && ids.has(p.reports_to) && p.reports_to !== p.id) (kids[p.reports_to] ||= []).push(p); else roots.push(p); }
  const shown = people.filter((p) => [p.name, p.designation, p.department, p.emp_id].join(' ').toLowerCase().includes(q.toLowerCase()));
  const byDept = {}; shown.forEach((p) => (byDept[p.department || 'No department'] ||= []).push(p));
  const holidays = S.holidays.map((h) => ({ ...h, date: `${Number(h.md.slice(0, 2)) >= 4 ? S.fyStart : S.fyStart + 1}-${h.md}` })).sort((a, b) => (a.date < b.date ? -1 : 1));
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>People</h1><p className="hr-muted">{people.length} people at {S.org}.</p></div>
        {tab === 'people' && <input className="hr-input hr-input--search" placeholder="Search by name, role or department…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />}</header>
      <div className="hr-tabs">{[['people', 'Directory'], ['chart', 'Org chart'], ['holidays', 'Holidays']].map(([k, l]) => <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'people' && Object.entries(byDept).map(([dept, list]) => (
        <section key={dept}><h3 className="hr-h3">{dept} · {list.length}</h3>
          <div className="hr-people">{list.map((p) => <div key={p.id} className="hr-person"><Avatar url={photoOf(db, p.id)} name={p.name} />
            <div><b>{p.name}</b><span>{p.designation}</span><small>{p.emp_id}{p.email ? ` · ${p.email}` : ''}</small></div><Badge tone={statusTone(p.status)}>{p.status}</Badge></div>)}</div></section>))}
      {tab === 'chart' && <section className="hr-panel"><p className="hr-muted hr-small">Set “Reports to” on each staff record to shape this chart.</p><ul className="hr-org">{roots.map((p) => <Node key={p.id} p={p} kids={kids} />)}</ul></section>}
      {tab === 'holidays' && <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Date</th><th>Day</th><th>Holiday</th></tr></thead>
        <tbody>{holidays.map((h) => <tr key={h.date}><td>{fmtDate(h.date)}</td><td>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(h.date + 'T00:00:00Z').getUTCDay()]}</td><td>{h.name}</td></tr>)}</tbody></table></div>}
    </div>
  );
}
