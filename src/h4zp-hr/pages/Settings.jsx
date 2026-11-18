import React, { useEffect, useRef, useState } from 'react';
import { logoOf, signOf, resizeImage } from '../lib/brand';
import { Field, Input, Select } from '../components/ui';
import { DEMO_MODE } from '../lib/supabaseClient';

const pct = (v) => (v === '' ? '' : Math.round(Number(v) * 10000) / 100);
const unpct = (v) => (v === '' ? 0 : Number(v) / 100);

/** Text box for a list, one item per line; saved when you leave the box. */
function ListArea({ value, parse, rows = 6, label }) {
  const [t, setT] = useState(value);
  useEffect(() => setT(value), [value]);
  return <textarea className="hr-input" rows={rows} value={t} aria-label={label} onChange={(e) => setT(e.target.value)} onBlur={() => parse(t)} />;
}
function ImagePick({ label, url, onPick, onReset, isDefault }) {
  const ref = useRef(null);
  return <div className="hr-brandpick"><span className="hr-field__label">{label}</span><div className="hr-brandpick__img"><img src={url} alt={label} /></div>
    <input ref={ref} type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await onPick(f); e.target.value = ''; }} />
    <div className="hr-head__actions"><button className="hr-btn hr-btn--small" onClick={() => ref.current.click()}>Upload new</button>{!isDefault && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={onReset}>Use original</button>}</div></div>;
}

export default function Settings({ db, act, store, notify }) {
  const [S, setS] = useState(db.settings);
  const set = (path) => (v) => { const n = structuredClone(S); const keys = path.split('.'); let o = n; keys.slice(0, -1).forEach((k) => (o = o[k])); o[keys.at(-1)] = v; setS(n); };
  const numSet = (path) => (v) => set(path)(v === '' ? '' : Number(v));
  const pctSet = (path) => (v) => set(path)(unpct(v));
  const save = () => act((d) => store.saveSettings(d, S), 'Settings saved');
  const fy = Array.from({ length: 10 }, (_, i) => 2024 + i);
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Settings</h1><p className="hr-muted">Rules used for every calculation. Check statutory rates with your CA when the law changes.</p></div>
        <div className="hr-head__actions"><button className="hr-btn" onClick={() => store.exportBackup(db)}>Download backup</button><button className="hr-btn hr-btn--primary" onClick={save}>Save settings</button></div></header>

      <section className="hr-panel"><h2>Organisation & year</h2><div className="hr-form">
        <Field label="Financial year" hint="All 12 months, holidays and the PF ceiling follow this."><Select value={S.fyStart} onChange={(v) => set('fyStart')(Number(v))} options={fy.map((y) => ({ value: y, label: `${y}-${String(y + 1).slice(2)}` }))} /></Field>
        <Field label="Organisation name"><Input value={S.org} onChange={set('org')} /></Field>
        <Field label="H4ZP HR website address" hint="Sent to staff with their login details."><Input value={S.portalUrl} onChange={set('portalUrl')} /></Field>
        {[0, 1, 2].map((i) => <Field key={i} label={`Address line ${i + 1}`}><Input value={S.address[i]} onChange={(v) => { const a = [...S.address]; a[i] = v; set('address')(a); }} /></Field>)}
      </div></section>

      <section className="hr-panel"><h2>Employee ID</h2><div className="hr-form">
        <Field label="Prefix" hint="Letters before the number, e.g. H4ZP- or SAA/"><Input value={S.empId.prefix} onChange={(v) => set('empId.prefix')(v.toUpperCase())} /></Field>
        <Field label="Number of digits"><Input type="number" min="1" max="8" value={S.empId.digits} onChange={numSet('empId.digits')} /></Field>
        <Field label="Next new employee gets"><Input value={(() => { const used = db.directory.map((p) => p.emp_id).filter((id) => id.toUpperCase().startsWith(String(S.empId.prefix).toUpperCase())); const n = Math.max(0, ...used.map((id) => Number((id.match(/(\d+)$/) || [])[1]) || 0)) + 1; return `${S.empId.prefix}${String(n).padStart(Number(S.empId.digits) || 1, '0')}`.toUpperCase(); })()} disabled /></Field>
      </div><p className="hr-muted hr-small">Emp IDs are always in capitals. You can still type any Emp ID by hand when adding someone.</p></section>

      <section className="hr-grid hr-grid--two">
        <div className="hr-panel"><h2>Designations & salary ranges</h2>
          <ListArea rows={9} label="Designations and salary ranges" value={[...new Set([...(S.designations || []), ...(S.salaryRanges || []).map((r) => r.designation)])].map((d) => { const r = (S.salaryRanges || []).find((x) => x.designation === d); return r ? `${d} | ${r.min} | ${r.max}` : d; }).join('\n')}
            parse={(t) => { const lines = t.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]); const n = structuredClone(S); n.designations = lines.map((x) => x[0]);
              n.salaryRanges = lines.filter((x) => x.length >= 3 && Number(x[1]) >= 0 && Number(x[2]) > 0).map((x) => ({ designation: x[0], min: Number(x[1]), max: Number(x[2]) })); setS(n); }} />
          <p className="hr-muted hr-small">One per line: <code>Designation | minimum | maximum</code> monthly gross, e.g. <code>Nurse | 15000 | 22000</code>. The range is optional. These appear as suggestions on staff records, and a salary outside the range is flagged.</p></div>
        <div className="hr-panel"><h2>Employment types</h2>
          <ListArea rows={9} label="Employment types" value={(S.employmentTypes || []).join('\n')} parse={(t) => set('employmentTypes')(t.split('\n').map((x) => x.trim()).filter(Boolean))} />
          <p className="hr-muted hr-small">One per line.</p></div>
      </section>

      <section className="hr-panel"><h2>Shifts, time & weekly off</h2>
        <div className="hr-grid hr-grid--two">
          <div><span className="hr-field__label">Shifts — one per line: Name | start | end</span>
            <ListArea rows={6} label="Shifts" value={(S.shifts || []).map((x) => `${x.name} | ${x.start} | ${x.end}`).join('\n')}
              parse={(t) => { const sh = t.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0] && /^\d{1,2}:\d{2}$/.test(x[1] || '') && /^\d{1,2}:\d{2}$/.test(x[2] || '')).map(([name, start, end]) => ({ name, start: start.padStart(5, '0'), end: end.padStart(5, '0') }));
                if (!sh.length) { notify('Add at least one shift, e.g. General | 09:00 | 17:30', 'bad'); return; } const n = structuredClone(S); n.shifts = sh; if (!sh.some((x) => x.name === n.defaultShift)) n.defaultShift = sh[0].name; setS(n); }} />
            <p className="hr-muted hr-small">24-hour times. A night shift may end the next morning (e.g. Night | 21:00 | 09:00).</p></div>
          <div className="hr-form hr-form--one">
            <Field label="Usual shift for everyone"><Select value={S.defaultShift} onChange={set('defaultShift')} options={(S.shifts || []).map((x) => x.name)} /></Field>
            <Field label="Late after (minutes past shift start)"><Input type="number" min="0" value={S.graceMins} onChange={numSet('graceMins')} /></Field>
            <Field label="Weekly off — Trust default" hint={{ fixed: 'The same day(s) off every week.', flexible: 'Any one day a week: the first absence in a week becomes the week off; more absences use CL, then EL, then become unpaid.', roster: 'Off days come from the weekly roster.' }[S.weekOff.mode]}>
              <Select value={S.weekOff.mode} onChange={set('weekOff.mode')} options={[{ value: 'fixed', label: 'Fixed day(s)' }, { value: 'flexible', label: 'Flexible — any 1 day a week' }, { value: 'roster', label: 'As per roster' }]} /></Field>
            {S.weekOff.mode === 'fixed' && <Field label="Off on"><div className="hr-days">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <label key={d}><input type="checkbox" checked={S.weekOff.days.includes(i)} onChange={(e) => set('weekOff.days')(e.target.checked ? [...S.weekOff.days, i].sort() : S.weekOff.days.filter((x) => x !== i))} />{d}</label>)}</div></Field>}
          </div></div>
        <p className="hr-muted hr-small">Each employee can have their own shift and weekly off on their staff record; the roster can change any single day.</p>
      </section>

      <section className="hr-panel"><h2>Overtime</h2><div className="hr-form">
        <Field label="Overtime day pays (× one day’s salary)" hint="1 = one extra day’s pay. 2 = double."><Input type="number" min="0" step="0.25" value={S.ot.dayRate} onChange={numSet('ot.dayRate')} /></Field>
        <Field label="Overtime hour pays (× hourly rate)" hint="Hourly rate = day’s salary ÷ shift hours."><Input type="number" min="0" step="0.25" value={S.ot.hourRate} onChange={numSet('ot.hourRate')} /></Field>
      </div></section>

      <section className="hr-panel"><h2>Branding</h2><div className="hr-brand-grid">
        <ImagePick label="Logo (letters, payslips, staff list, sign-in)" url={logoOf(S)} isDefault={!S.brand.logo} onReset={() => set('brand.logo')('')}
          onPick={async (f) => { try { set('brand.logo')(await resizeImage(f, 400, 'image/png')); } catch (e) { notify(e.message, 'bad'); } }} />
        <ImagePick label="Signature (letters and staff list)" url={signOf(S)} isDefault={!S.brand.signature} onReset={() => set('brand.signature')('')}
          onPick={async (f) => { try { set('brand.signature')(await resizeImage(f, 700, 'image/png')); } catch (e) { notify(e.message, 'bad'); } }} />
      </div><p className="hr-muted hr-small">Use PNG with a transparent or white background. Press Save settings afterwards.</p></section>

      <section className="hr-panel"><h2>Salary split from gross</h2><div className="hr-form">
        <Field label="Basic (% of gross)"><Input type="number" value={pct(S.basicPct)} onChange={pctSet('basicPct')} /></Field>
        <Field label="DA (% of gross)"><Input type="number" value={pct(S.daPct)} onChange={pctSet('daPct')} /></Field>
        <Field label="HRA (% of basic)"><Input type="number" value={pct(S.hraPctOfBasic)} onChange={pctSet('hraPctOfBasic')} /></Field>
        <Field label="Conveyance (₹/month)"><Input type="number" value={S.conveyance} onChange={numSet('conveyance')} /></Field>
        <Field label="Salary divisor (days)" hint="Blank = calendar days of each month."><Input type="number" value={S.divisor ?? ''} onChange={(v) => set('divisor')(v === '' ? null : Number(v))} /></Field>
        <Field label="Code wages minimum (% of gross)"><Input type="number" value={pct(S.minWagePct)} onChange={pctSet('minWagePct')} /></Field>
      </div></section>

      <section className="hr-panel"><h2>Leave</h2><div className="hr-form">
        <Field label="CL per year"><Input type="number" value={S.leave.CL} onChange={numSet('leave.CL')} /></Field>
        <Field label="SL per year"><Input type="number" value={S.leave.SL} onChange={numSet('leave.SL')} /></Field>
        <Field label="EL per year"><Input type="number" value={S.leave.EL} onChange={numSet('leave.EL')} /></Field>
        <Field label="Cover absences from CL, then EL"><Select value={S.leave.adjust ? 'Y' : 'N'} onChange={(v) => set('leave.adjust')(v === 'Y')} options={['Y', 'N']} /></Field>
        <Field label="Pro-rate for mid-year starts"><Select value={S.leave.prorate ? 'Y' : 'N'} onChange={(v) => set('leave.prorate')(v === 'Y')} options={['Y', 'N']} /></Field>
      </div></section>

      <section className="hr-panel"><h2>PF & ESI</h2><div className="hr-form">
        <Field label="PF employee %"><Input type="number" value={pct(S.pf.ee)} onChange={pctSet('pf.ee')} /></Field>
        <Field label="PF employer %"><Input type="number" value={pct(S.pf.er)} onChange={pctSet('pf.er')} /></Field>
        <Field label="EPS % (within employer share)"><Input type="number" value={pct(S.pf.eps)} onChange={pctSet('pf.eps')} /></Field>
        <Field label="EDLI %"><Input type="number" value={pct(S.pf.edli)} onChange={pctSet('pf.edli')} /></Field>
        <Field label="Admin charges %"><Input type="number" value={pct(S.pf.admin)} onChange={pctSet('pf.admin')} /></Field>
        <Field label="PF ceiling — old (₹)"><Input type="number" value={S.pf.ceilOld} onChange={numSet('pf.ceilOld')} /></Field>
        <Field label="New ceiling from"><Input type="date" value={S.pf.ceilDate} onChange={set('pf.ceilDate')} /></Field>
        <Field label="PF ceiling — new (₹)"><Input type="number" value={S.pf.ceilNew} onChange={numSet('pf.ceilNew')} /></Field>
        <Field label="Maximum PF per month (₹)"><Input type="number" value={S.pf.max} onChange={numSet('pf.max')} /></Field>
        <Field label="EPS stops at age"><Input type="number" value={S.pf.epsAge} onChange={numSet('pf.epsAge')} /></Field>
        <Field label="ESI employee %"><Input type="number" value={pct(S.esi.ee)} onChange={pctSet('esi.ee')} /></Field>
        <Field label="ESI employer %"><Input type="number" value={pct(S.esi.er)} onChange={pctSet('esi.er')} /></Field>
        <Field label="ESI wage limit (₹)"><Input type="number" value={S.esi.limit} onChange={numSet('esi.limit')} /></Field>
        <Field label="ESI limit — PwD (₹)"><Input type="number" value={S.esi.pwdLimit} onChange={numSet('esi.pwdLimit')} /></Field>
        <Field label="No employee ESI if daily salary ≤ (₹)"><Input type="number" value={S.esi.dailyExempt} onChange={numSet('esi.dailyExempt')} /></Field>
      </div></section>

      <section className="hr-panel"><h2>Income tax (new regime, for the TDS estimate)</h2><div className="hr-form">
        <Field label="Standard deduction (₹)"><Input type="number" value={S.tax.std} onChange={numSet('tax.std')} /></Field>
        <Field label="No tax up to taxable income (₹)"><Input type="number" value={S.tax.rebate} onChange={numSet('tax.rebate')} /></Field>
        <Field label="Cess %"><Input type="number" value={pct(S.tax.cess)} onChange={pctSet('tax.cess')} /></Field>
        <Field label="Slabs" hint="From ₹ : rate %, one per line" wide>
          <textarea className="hr-input" rows={7} value={S.tax.slabs.map(([f, r]) => `${f}:${pct(r)}`).join('\n')}
            onChange={(e) => set('tax.slabs')(e.target.value.split('\n').map((l) => l.split(':').map(Number)).filter((x) => x.length === 2 && !x.some(isNaN)).map(([f, r]) => [f, r / 100]))} />
        </Field>
      </div></section>

      <section className="hr-grid hr-grid--two">
        <div className="hr-panel"><h2>Departments</h2>
          <textarea className="hr-input" rows={9} value={S.departments.join('\n')} onChange={(e) => set('departments')(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} aria-label="Departments, one per line" />
          <p className="hr-muted hr-small">One per line.</p></div>
        <div className="hr-panel"><h2>Holidays</h2>
          <textarea className="hr-input" rows={9} value={S.holidays.map((h) => `${h.md} ${h.name}`).join('\n')}
            onChange={(e) => set('holidays')(e.target.value.split('\n').map((l) => { const m = l.trim().match(/^(\d{2}-\d{2})\s+(.*)$/); return m ? { md: m[1], name: m[2] } : null; }).filter(Boolean))} aria-label="Holidays" />
          <p className="hr-muted hr-small">One per line as MM-DD Name, e.g. <code>11-01 Diwali</code>. Used by “Holidays → HO” on the attendance page.</p></div>
      </section>
      {DEMO_MODE && <section className="hr-panel"><h2>Demo data</h2><p className="hr-muted">Start the demo again from the 15 staff in the workbook (also signs you out).</p>
        <button className="hr-btn" onClick={() => { if (window.confirm('Erase demo data in this browser?')) { store.resetDemo(); window.location.reload(); } }}>Reset demo data</button></section>}
    </div>
  );
}
