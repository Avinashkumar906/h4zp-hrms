// Admin: generate HR letters from templates, upload files, decide what each employee can see, edit templates.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate, todayIso } from '../lib/format';
import { DEFAULT_TEMPLATES, PLACEHOLDERS, docValues, fillTemplate, salaryRows, nextRef } from '../lib/docTemplates';
import { Field, Input, Select, Modal, Badge, Empty } from '../components/ui';
import Letter from '../components/Letter';

const UPLOAD_TYPES = ['Aadhaar', 'PAN', 'Signed appointment letter', 'PCC certificate', 'Qualification certificate', 'Experience letter', 'Bank proof', 'Photo', 'Medical fitness', 'Other'];
export const templatesOf = (S) => ({ ...DEFAULT_TEMPLATES, ...(S.docTemplates || {}) });

export function DocViewer({ doc, settings, onClose, store, notify }) {
  const open = async () => { try { window.open(await store.documentUrl(doc), '_blank', 'noopener'); } catch (e) { notify(e.message, 'bad'); } };
  if (!doc.data.generated) { open(); onClose(); return null; }
  return (
    <Modal title={`${doc.data.type} — ${doc.data.ref || ''}`} onClose={onClose} size="wide"
      footer={<><button className="hr-btn" onClick={onClose}>Close</button><button className="hr-btn hr-btn--primary" onClick={() => window.print()}>Print / Save as PDF</button></>}>
      <Letter doc={doc} settings={settings} printable />
    </Modal>
  );
}

function Generate({ db, act, store, notify, onIssued }) {
  const S = db.settings, T = templatesOf(S);
  const [sid, setSid] = useState('');
  const [tkey, setTkey] = useState('appointment');
  const [purpose, setPurpose] = useState('');
  const [f, setF] = useState(null);
  const [edited, setEdited] = useState(false);
  const st = db.staff.find((x) => x.id === sid);
  const t = T[tkey];
  const fill = () => {
    if (!st || !t) { setF(null); return; }
    const v = docValues(st, db, { purpose });
    setF({ ref: nextRef(db), date: todayIso(), subject: fillTemplate(t.subject, v), body: fillTemplate(t.body, v), signature: true, shared: true,
      acceptance: ['offer', 'appointment'].includes(tkey), signatory: 'Chairperson', to: t.to || 'person',
      to_lines: [st.name, st.designation, S.org.replace(/\s*\(H4ZP\)\s*$/, ''), st.address].filter(Boolean), salary_rows: salaryRows(v._gross, S, st.deduct_pf !== 'N') });
    setEdited(false);
  };
  useEffect(() => { if (!edited) fill(); }, [sid, tkey, purpose]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = f ? [...new Set([...(f.subject + f.body).matchAll(/\[([a-z ]+)\]|\{(\w+)\}/g)].map((m) => m[1] || m[2]).filter((k) => k !== 'salary_table'))] : [];
  const issue = async () => {
    if (!st) { notify('Choose the employee.', 'bad'); return; }
    if (left.length && !window.confirm(`These still need filling in: ${left.join(', ')}.\nIssue anyway?`)) return;
    const data = { ...f, generated: true, type: t.name, template: tkey, uploaded_on: f.date, issued_by: db.me.name || db.me.login };
    if (await act((d) => store.saveRecord(d, { kind: 'document', staff_id: st.id, data }), `${t.name} issued to ${st.name}${f.shared ? ' — they can see it in My documents' : ''}`)) { setEdited(false); onIssued(); }
  };
  const up = (k) => (v) => { setF({ ...f, [k]: v }); if (k === 'subject' || k === 'body') setEdited(true); };
  return (
    <div className="hr-docgen">
      <section className="hr-panel">
        <div className="hr-form hr-form--one">
          <Field label="Employee"><Select value={sid} onChange={(v) => { if (edited && !window.confirm('Discard your edits to this letter?')) return; setEdited(false); setSid(v); }} options={db.staff.map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="Choose…" /></Field>
          <Field label="Document"><Select value={tkey} onChange={(v) => { if (edited && !window.confirm('Discard your edits to this letter?')) return; setEdited(false); setTkey(v); }} options={Object.entries(T).map(([k, x]) => ({ value: k, label: x.name }))} /></Field>
          {t && /\{purpose\}/.test(t.body) && <Field label="Purpose" hint="e.g. a bank loan, a visa application, opening a bank account"><Input value={purpose} onChange={setPurpose} /></Field>}
        </div>
        {!st ? <p className="hr-muted hr-small">Choose an employee to fill in the letter.</p> : f && <div className="hr-form hr-form--one" style={{ marginTop: 12 }}>
          <div className="hr-form" style={{ gridTemplateColumns: '1fr 1fr' }}><Field label="Reference no."><Input value={f.ref} onChange={up('ref')} /></Field><Field label="Date"><Input type="date" value={f.date} onChange={up('date')} /></Field></div>
          <Field label="Subject"><Input value={f.subject} onChange={up('subject')} /></Field>
          <Field label="Letter text" hint="Edit freely. A blank line starts a new paragraph. Keep {salary_table} on its own line to show the salary table.">
            <textarea className="hr-input" rows={14} value={f.body} onChange={(e) => up('body')(e.target.value)} /></Field>
          {edited && <button className="hr-link" onClick={() => { if (window.confirm('Replace your edits with the template text?')) { setEdited(false); fill(); } }}>Reset to template</button>}
          <div className="hr-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Signature"><Select value={f.signature ? 'Y' : 'N'} onChange={(v) => up('signature')(v === 'Y')} options={[{ value: 'Y', label: 'Chairperson’s signature' }, { value: 'N', label: 'Blank — sign by hand' }]} /></Field>
            {!f.signature && <Field label="Signed as"><Input value={f.signatory} onChange={up('signatory')} /></Field>}
            <Field label="Employee can see it"><Select value={f.shared ? 'Y' : 'N'} onChange={(v) => up('shared')(v === 'Y')} options={[{ value: 'Y', label: 'Yes — in My documents' }, { value: 'N', label: 'No — HR only' }]} /></Field>
            <Field label="Acceptance section"><Select value={f.acceptance ? 'Y' : 'N'} onChange={(v) => up('acceptance')(v === 'Y')} options={[{ value: 'Y', label: 'Yes' }, { value: 'N', label: 'No' }]} /></Field>
          </div>
          {left.length > 0 && <p className="hr-hint">Still to fill: {left.join(', ')} — add them on the staff record, or type them into the letter.</p>}
          <button className="hr-btn hr-btn--primary" onClick={issue}>Issue document</button>
        </div>}
      </section>
      <div>{f && st ? <Letter doc={{ data: f }} settings={S} /> : <Empty title="Preview appears here" />}</div>
    </div>
  );
}

function Templates({ db, act, store, can, notify }) {
  const S = db.settings, T = templatesOf(S), canSave = can.edit('settings');
  const [key, setKey] = useState('appointment');
  const [t, setT] = useState(T[key]);
  const bodyRef = useRef(null);
  useEffect(() => { setT(templatesOf(db.settings)[key] || DEFAULT_TEMPLATES.custom); }, [key, db.settings]);
  const save = (next) => act((d) => store.saveSettings(d, { ...d.settings, docTemplates: next }), 'Templates saved');
  const insert = (k) => { const el = bodyRef.current; const pos = el ? el.selectionStart : t.body.length; setT({ ...t, body: t.body.slice(0, pos) + `{${k}}` + t.body.slice(pos) }); };
  return (
    <div className="hr-docgen">
      <section className="hr-panel"><div className="hr-form hr-form--one">
        <Field label="Template"><Select value={key} onChange={setKey} options={Object.entries(T).map(([k, x]) => ({ value: k, label: x.name + (S.docTemplates?.[k] && DEFAULT_TEMPLATES[k] ? ' (edited)' : '') }))} /></Field>
        <Field label="Name"><Input value={t.name} onChange={(v) => setT({ ...t, name: v })} /></Field>
        <Field label="Addressed to"><Select value={t.to || 'person'} onChange={(v) => setT({ ...t, to: v })} options={[{ value: 'person', label: 'The employee (name and designation)' }, { value: 'whom', label: 'To whom it may concern' }]} /></Field>
        <Field label="Subject"><Input value={t.subject} onChange={(v) => setT({ ...t, subject: v })} /></Field>
        <Field label="Text"><textarea ref={bodyRef} className="hr-input" rows={16} value={t.body} onChange={(e) => setT({ ...t, body: e.target.value })} /></Field>
        <div><p className="hr-field__label">Click to insert at the cursor</p><div className="hr-chips">{PLACEHOLDERS.map(([k, l]) => <button key={k} type="button" title={l} onClick={() => insert(k)}>{`{${k}}`}</button>)}</div></div>
        {canSave ? <div className="hr-head__actions">
          <button className="hr-btn hr-btn--primary" onClick={() => save({ ...(S.docTemplates || {}), [key]: t })}>Save template</button>
          <button className="hr-btn" onClick={() => { const k = `t${Date.now()}`; save({ ...(S.docTemplates || {}), [k]: { ...t, name: `${t.name} (copy)` } }).then((ok) => ok && setKey(k)); }}>Save as new template</button>
          {S.docTemplates?.[key] && <button className="hr-btn hr-btn--ghost" onClick={() => { if (!window.confirm(DEFAULT_TEMPLATES[key] ? 'Go back to the original wording?' : 'Delete this template?')) return; const n = { ...S.docTemplates }; delete n[key]; save(n).then((ok) => ok && !DEFAULT_TEMPLATES[key] && setKey('appointment')); }}>{DEFAULT_TEMPLATES[key] ? 'Reset to original' : 'Delete'}</button>}
        </div> : <p className="hr-muted hr-small">Only users with full Settings access can change templates.</p>}
      </div></section>
      <div><Letter doc={{ data: { ref: 'H4ZP/HR/…', date: todayIso(), to: t.to, to_lines: ['[Employee name]', '[Designation]'], subject: t.subject, body: t.body, signature: true, salary_rows: [['Basic', 10000], ['House Rent Allowance', 4000], ['Gross Salary', 20000, true]] } }} settings={S} /></div>
    </div>
  );
}

function Issued({ db, act, store, manage, notify }) {
  const [sid, setSid] = useState('');
  const [view, setView] = useState(null);
  const fileRef = useRef(null);
  const [type, setType] = useState(UPLOAD_TYPES[0]);
  const [share, setShare] = useState('Y');
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const rows = useMemo(() => db.records.filter((r) => r.kind === 'document' && (!sid || r.staff_id === sid)).sort((a, b) => ((b.data.uploaded_on || '') > (a.data.uploaded_on || '') ? 1 : -1)), [db.records, sid]);
  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!sid) { notify('Choose the employee first.', 'bad'); return; } if (!file) { notify('Choose a file.', 'bad'); return; }
    if (await act((d) => store.uploadDocument(d, sid, file, { type, uploaded_on: todayIso(), shared: share === 'Y' }), `${type} uploaded`)) fileRef.current.value = '';
  };
  const toggle = (r) => act((d) => store.saveRecord(d, { ...r, data: { ...r.data, shared: r.data.shared === false } }), r.data.shared === false ? 'Now visible to the employee' : 'Hidden from the employee');
  return (<>
    <div className="hr-toolbar"><Select value={sid} onChange={setSid} options={db.staff.map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="All employees" aria-label="Employee" /></div>
    {manage && <section className="hr-panel"><h2>Upload a file</h2><div className="hr-toolbar">
      <Select value={type} onChange={setType} options={UPLOAD_TYPES} aria-label="Document type" /><input type="file" ref={fileRef} className="hr-input" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" aria-label="File" />
      <Select value={share} onChange={setShare} options={[{ value: 'Y', label: 'Employee can see it' }, { value: 'N', label: 'HR only' }]} aria-label="Visibility" />
      <button className="hr-btn hr-btn--primary" onClick={upload}>Upload{sid ? ` for ${name(sid)}` : ''}</button></div><p className="hr-muted hr-small">PDF, image or Word, up to 5 MB. Choose the employee above first.</p></section>}
    {rows.length === 0 ? <Empty title="No documents yet">Generate a letter or upload a file.</Empty> : (
      <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Date</th><th>Ref</th><th>Employee</th><th>Document</th><th>Source</th><th>Employee can see</th><th /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtDate(r.data.date || r.data.uploaded_on)}</td><td className="hr-mono">{r.data.ref || '—'}</td><td>{name(r.staff_id)}</td><td>{r.data.subject || r.data.type}{!r.data.generated && <small className="hr-sub">{r.data.file_name}</small>}</td>
          <td>{r.data.generated ? <Badge tone="info">Generated</Badge> : <Badge>Uploaded</Badge>}</td>
          <td>{manage ? <button className="hr-btn hr-btn--small" onClick={() => toggle(r)}>{r.data.shared === false ? 'Hidden — show' : 'Visible — hide'}</button> : r.data.shared === false ? 'No' : 'Yes'}</td>
          <td className="hr-r"><button className="hr-btn hr-btn--small" onClick={() => setView(r)}>{r.data.generated ? 'View / print' : 'Open'}</button>
            {manage && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={() => window.confirm('Delete this document? The employee will no longer see it.') && act((d) => store.deleteRecord(d, r.id), 'Document deleted')}>Delete</button>}</td></tr>)}</tbody></table></div>)}
    {view && <DocViewer doc={view} settings={db.settings} store={store} notify={notify} onClose={() => setView(null)} />}
  </>);
}

export default function DocCenter(ctx) {
  const [tab, setTab] = useState(ctx.manage ? 'generate' : 'issued');
  const tabs = [...(ctx.manage ? [['generate', 'Generate a letter']] : []), ['issued', 'All documents'], ['templates', 'Templates']];
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Documents</h1><p className="hr-muted">Issue appointment letters, certificates and more on the Trust letterhead. Documents marked “employee can see” appear in their My documents.</p></div></header>
      <div className="hr-tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'generate' && <Generate {...ctx} onIssued={() => setTab('issued')} />}
      {tab === 'issued' && <Issued {...ctx} />}
      {tab === 'templates' && <Templates {...ctx} />}
    </div>
  );
}
