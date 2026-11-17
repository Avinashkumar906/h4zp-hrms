// Record-style modules that share one screen pattern: assets, helpdesk, goals & reviews, hiring, announcements, documents.
import React, { useRef, useState } from 'react';
import { EMPTY_STAFF } from '../lib/defaults';
import { inr, fmtDate, todayIso } from '../lib/format';
import { Field, Input, Select, Modal, Badge, Empty } from '../components/ui';

const TONES = { Open: 'warn', 'In progress': 'info', Resolved: 'ok', Closed: 'mute', Done: 'ok', Pending: 'warn', Applied: 'mute', Screening: 'info', Interview: 'info', Offer: 'warn', Hired: 'ok', Rejected: 'bad', 'On hold': 'mute', Issued: 'info', Returned: 'mute', Lost: 'bad' };

function Collection({ ctx, kind, title, intro, addLabel, fields, columns, perStaff, selfService, selfFields = [], defaults = {}, rowActions, summary }) {
  const { db, myStaff, act, store, manage, notify } = ctx;
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState('');
  const rows = db.records.filter((r) => r.kind === kind);
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const canAdd = manage || (selfService && myStaff);
  const editable = (r) => manage || (selfService && r.staff_id === myStaff?.id && !['Resolved', 'Closed', 'Approved'].includes(r.data.status));
  const visibleFields = (r) => fields.filter((f) => manage || selfFields.includes(f.key));
  const statusField = fields.find((f) => f.key === 'status' || f.key === 'stage');
  const shown = rows.filter((r) => !filter || r.data[statusField?.key] === filter);
  const save = async () => {
    const req = fields.find((f) => f.required && !String(edit.data[f.key] ?? '').trim() && (manage || selfFields.includes(f.key)));
    if (req) { notify(`${req.label} is required.`, 'bad'); return; }
    if (perStaff && !edit.staff_id) { notify('Choose the employee.', 'bad'); return; }
    const rec = { ...edit, staff_id: edit.staff_id || (selfService ? myStaff?.id : null) || null };
    if (await act((d) => store.saveRecord(d, rec), 'Saved')) setEdit(null);
  };
  const cell = (r, c) => { const v = c.key === '_staff' ? name(r.staff_id) : c.key === '_date' ? fmtDate((r.created_at || '').slice(0, 10)) : r.data[c.key];
    if (c.type === 'date') return v ? fmtDate(v) : '—'; if (c.type === 'money') return inr(v); if (c.type === 'badge') return v ? <Badge tone={TONES[v] || 'neutral'}>{v}</Badge> : '—';
    if (c.type === 'stars') return v ? '★'.repeat(Number(v)) + '☆'.repeat(5 - Number(v)) : '—'; if (c.type === 'pct') return v !== '' && v != null ? `${v}%` : '—'; return v || '—'; };
  return (
    <section className="hr-stack">
      <header className="hr-head"><div><h1>{title}</h1>{intro && <p className="hr-muted">{intro}</p>}</div>
        <div className="hr-head__actions">
          {statusField && rows.length > 0 && <Select value={filter} onChange={setFilter} options={statusField.options} placeholder={`All (${rows.length})`} aria-label="Filter" />}
          {canAdd && <button className="hr-btn hr-btn--primary" onClick={() => setEdit({ kind, staff_id: perStaff || selfService ? (manage ? '' : myStaff.id) : null, data: { ...defaults } })}>{addLabel}</button>}</div></header>
      {summary && summary(rows)}
      {shown.length === 0 ? <Empty title={rows.length ? 'Nothing matches that filter' : `Nothing here yet`}>{canAdd ? `Use “${addLabel}” to add the first one.` : ''}</Empty> : (
        <div className="hr-table-wrap"><table className="hr-table"><thead><tr>{columns.map((c) => <th key={c.key} className={c.type === 'money' ? 'hr-r' : ''}>{c.label}</th>)}<th /></tr></thead>
          <tbody>{shown.map((r) => <tr key={r.id}>{columns.map((c) => <td key={c.key} className={c.type === 'money' ? 'hr-r' : ''}>{cell(r, c)}</td>)}
            <td className="hr-r">{rowActions && rowActions(r)}{editable(r) && <button className="hr-btn hr-btn--small" onClick={() => setEdit({ ...r, data: { ...r.data } })}>{manage ? 'Edit' : 'Update'}</button>}
              {manage && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={() => window.confirm('Delete this entry?') && act((d) => store.deleteRecord(d, r.id), 'Deleted')}>Delete</button>}</td></tr>)}</tbody></table></div>)}
      {edit && <Modal title={edit.id ? 'Edit' : addLabel} onClose={() => setEdit(null)} footer={<><button className="hr-btn" onClick={() => setEdit(null)}>Cancel</button><button className="hr-btn hr-btn--primary" onClick={save}>Save</button></>}>
        <div className="hr-form">
          {(perStaff || (selfService && manage)) && manage && <Field label="Employee"><Select value={edit.staff_id || ''} onChange={(v) => setEdit({ ...edit, staff_id: v })} options={db.staff.map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="Choose…" /></Field>}
          {visibleFields(edit).map((f) => <Field key={f.key} label={f.label} wide={f.type === 'textarea' || f.wide}>
            {f.type === 'select' ? <Select value={edit.data[f.key]} onChange={(v) => setEdit({ ...edit, data: { ...edit.data, [f.key]: v } })} options={f.options} placeholder={f.required ? undefined : '—'} />
              : f.type === 'textarea' ? <textarea className="hr-input" rows={4} value={edit.data[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, data: { ...edit.data, [f.key]: e.target.value } })} />
                : <Input type={f.type || 'text'} min={f.type === 'number' ? '0' : undefined} max={f.max} value={edit.data[f.key]} onChange={(v) => setEdit({ ...edit, data: { ...edit.data, [f.key]: f.type === 'number' && v !== '' ? Number(v) : v } })} />}</Field>)}
        </div></Modal>}
    </section>
  );
}

export const Assets = (ctx) => <div className="hr-page"><Collection ctx={ctx} kind="asset" title="Assets" addLabel="Issue an asset" perStaff
  intro="Phones, laptops, keys, ID cards, uniforms and anything else issued to staff."
  defaults={{ status: 'Issued', issued_on: todayIso() }}
  fields={[{ key: 'name', label: 'Item', required: true }, { key: 'category', label: 'Category', type: 'select', options: ['Phone', 'Laptop / tablet', 'Keys', 'ID card', 'Uniform', 'Medical equipment', 'Vehicle', 'Other'] }, { key: 'tag', label: 'Serial / tag no.' },
    { key: 'issued_on', label: 'Issued on', type: 'date' }, { key: 'returned_on', label: 'Returned on', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Issued', 'Returned', 'Lost'], required: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
  columns={[{ key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'tag', label: 'Serial / tag' }, { key: '_staff', label: 'Issued to' }, { key: 'issued_on', label: 'Issued', type: 'date' }, { key: 'returned_on', label: 'Returned', type: 'date' }, { key: 'status', label: 'Status', type: 'badge' }]} /></div>;

export const Helpdesk = (ctx) => <div className="hr-page"><Collection ctx={ctx} kind="ticket" title="Helpdesk" addLabel="Raise a ticket" selfService
  intro={ctx.seeAll ? 'Questions and requests from staff. Reply and close them here.' : 'Ask HR about salary, leave, documents or anything at work. You will see the reply here.'}
  defaults={{ status: 'Open', category: 'Payroll' }} selfFields={['subject', 'category', 'details']}
  fields={[{ key: 'subject', label: 'Subject', required: true, wide: true }, { key: 'category', label: 'About', type: 'select', options: ['Payroll', 'Leave', 'Attendance', 'Documents', 'Workplace', 'Other'], required: true }, { key: 'details', label: 'Details', type: 'textarea' },
    { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In progress', 'Resolved', 'Closed'], required: true }, { key: 'reply', label: 'Reply from HR', type: 'textarea' }]}
  columns={[{ key: '_date', label: 'Raised' }, ...(ctx.seeAll ? [{ key: '_staff', label: 'By' }] : []), { key: 'subject', label: 'Subject' }, { key: 'category', label: 'About' }, { key: 'status', label: 'Status', type: 'badge' }, { key: 'reply', label: 'Reply' }]} /></div>;

export const Performance = (ctx) => <div className="hr-page">
  <Collection ctx={ctx} kind="goal" title="Goals" addLabel="Add a goal" selfService
    intro={ctx.seeAll ? 'Goals for every employee. Staff update their own progress.' : 'What you are working towards. Update progress as you go.'}
    defaults={{ status: 'In progress', progress: 0 }} selfFields={['title', 'due', 'progress', 'status', 'notes']}
    fields={[{ key: 'title', label: 'Goal', required: true, wide: true }, { key: 'due', label: 'Target date', type: 'date' }, { key: 'progress', label: 'Progress %', type: 'number', max: '100' }, { key: 'status', label: 'Status', type: 'select', options: ['In progress', 'Done', 'On hold'], required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' }, { key: 'manager_comment', label: 'Manager’s comment', type: 'textarea' }]}
    columns={[...(ctx.seeAll ? [{ key: '_staff', label: 'Employee' }] : []), { key: 'title', label: 'Goal' }, { key: 'due', label: 'Target', type: 'date' }, { key: 'progress', label: 'Progress', type: 'pct' }, { key: 'status', label: 'Status', type: 'badge' }, { key: 'manager_comment', label: 'Manager’s comment' }]} />
  <Collection ctx={ctx} kind="review" title="Reviews" addLabel="Write a review" perStaff
    intro={ctx.manage ? 'Periodic reviews — the employee can read their own.' : 'Reviews written by your manager.'}
    defaults={{ rating: 3, period: `FY ${ctx.db.settings.fyStart}-${String(ctx.db.settings.fyStart + 1).slice(2)}`, reviewer: ctx.me.name || ctx.me.login }}
    fields={[{ key: 'period', label: 'Review period', required: true }, { key: 'rating', label: 'Rating (1–5)', type: 'select', options: ['1', '2', '3', '4', '5'].map((v) => ({ value: Number(v), label: `${v} — ${['Needs improvement', 'Below expectations', 'Meets expectations', 'Exceeds expectations', 'Outstanding'][v - 1]}` })), required: true },
      { key: 'reviewer', label: 'Reviewed by' }, { key: 'strengths', label: 'Strengths', type: 'textarea' }, { key: 'improvements', label: 'Areas to improve', type: 'textarea' }]}
    columns={[...(ctx.seeAll ? [{ key: '_staff', label: 'Employee' }] : []), { key: 'period', label: 'Period' }, { key: 'rating', label: 'Rating', type: 'stars' }, { key: 'strengths', label: 'Strengths' }, { key: 'improvements', label: 'To improve' }, { key: 'reviewer', label: 'By' }]} /></div>;

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
export function Hiring(ctx) {
  const { db, act, store, can } = ctx;
  const toStaff = (r) => {
    const n = Math.max(0, ...db.directory.map((s) => Number((s.emp_id.match(/(\d+)$/) || [])[1]) || 0)) + 1;
    const st = { ...EMPTY_STAFF, emp_id: `H4ZP-${String(n).padStart(3, '0')}`, name: r.data.name, designation: r.data.position || '', mobile: r.data.phone || '', email: r.data.email || '', qualification: r.data.qualification || '', prev_exp_years: r.data.experience || '', status: 'Provisional', remarks: 'Added from Hiring' };
    return act(async (d) => store.saveRecord(await store.saveStaff(d, st), { ...r, data: { ...r.data, stage: 'Hired', staff_emp_id: st.emp_id } }), `${r.data.name} added to Staff as Provisional (${st.emp_id})`);
  };
  return <div className="hr-page"><Collection ctx={ctx} kind="candidate" title="Hiring" addLabel="Add a candidate"
    intro="Track candidates from application to joining. A hired candidate becomes a Provisional staff record in one click."
    defaults={{ stage: 'Applied', applied_on: todayIso() }}
    summary={(rows) => <div className="hr-pipeline">{STAGES.map((s) => <div key={s}><b>{rows.filter((r) => r.data.stage === s).length}</b><span>{s}</span></div>)}</div>}
    rowActions={(r) => can.edit('staff') && ['Offer', 'Hired'].includes(r.data.stage) && !r.data.staff_emp_id && <button className="hr-btn hr-btn--small hr-btn--primary" onClick={() => toStaff(r)}>Add to staff</button>}
    fields={[{ key: 'name', label: 'Name', required: true }, { key: 'position', label: 'Position applied for', required: true }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'qualification', label: 'Qualification' }, { key: 'experience', label: 'Experience (years)', type: 'number' },
      { key: 'source', label: 'Source', type: 'select', options: ['Reference', 'Walk-in', 'Job portal', 'Social media', 'Agency', 'Other'] }, { key: 'applied_on', label: 'Applied on', type: 'date' }, { key: 'interview_on', label: 'Interview date', type: 'date' },
      { key: 'expected_salary', label: 'Expected salary (₹/month)', type: 'number' }, { key: 'stage', label: 'Stage', type: 'select', options: STAGES, required: true }, { key: 'notes', label: 'Notes', type: 'textarea' }]}
    columns={[{ key: 'name', label: 'Candidate' }, { key: 'position', label: 'Position' }, { key: 'phone', label: 'Phone' }, { key: 'qualification', label: 'Qualification' }, { key: 'interview_on', label: 'Interview', type: 'date' }, { key: 'expected_salary', label: 'Expected', type: 'money' }, { key: 'stage', label: 'Stage', type: 'badge' }, { key: 'staff_emp_id', label: 'Emp ID' }]} /></div>;
}

export const Announcements = (ctx) => <div className="hr-page"><Collection ctx={ctx} kind="announcement" title="Announcements" addLabel="Post an announcement"
  intro="Shown on everyone’s Home page." defaults={{ pinned: 'No' }}
  fields={[{ key: 'title', label: 'Title', required: true, wide: true }, { key: 'body', label: 'Message', type: 'textarea' }, { key: 'pinned', label: 'Keep at the top', type: 'select', options: ['No', 'Yes'], required: true }]}
  columns={[{ key: '_date', label: 'Posted' }, { key: 'title', label: 'Title' }, { key: 'body', label: 'Message' }, { key: 'pinned', label: 'Pinned' }]} /></div>;

const DOC_TYPES = ['Aadhaar', 'PAN', 'Appointment letter', 'PCC certificate', 'Qualification certificate', 'Experience letter', 'Bank proof', 'Photo', 'Medical fitness', 'Other'];
export function Documents({ db, act, store, manage, notify }) {
  const [sid, setSid] = useState('');
  const [type, setType] = useState(DOC_TYPES[0]);
  const fileRef = useRef(null);
  const rows = db.records.filter((r) => r.kind === 'document' && (!sid || r.staff_id === sid));
  const name = (id) => db.directory.find((p) => p.id === id)?.name || '—';
  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!sid) { notify('Choose the employee first.', 'bad'); return; } if (!file) { notify('Choose a file.', 'bad'); return; }
    if (await act((d) => store.uploadDocument(d, sid, file, { type, uploaded_on: todayIso() }), `${type} uploaded`)) fileRef.current.value = '';
  };
  const open = async (r) => { try { window.open(await store.documentUrl(r), '_blank', 'noopener'); } catch (e) { notify(e.message, 'bad'); } };
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Documents</h1><p className="hr-muted">Staff documents are kept in a private store. Links open for two minutes only.</p></div>
        <Select value={sid} onChange={setSid} options={db.staff.map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="All employees" aria-label="Employee" /></header>
      {manage && <section className="hr-panel"><h2>Upload</h2><div className="hr-toolbar">
        <Select value={type} onChange={setType} options={DOC_TYPES} aria-label="Document type" /><input type="file" ref={fileRef} className="hr-input" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" aria-label="File" />
        <button className="hr-btn hr-btn--primary" onClick={upload}>Upload{sid ? ` for ${name(sid)}` : ''}</button></div><p className="hr-muted hr-small">PDF, image or Word, up to 5 MB.</p></section>}
      {rows.length === 0 ? <Empty title="No documents yet">{manage ? 'Choose an employee and upload their first document.' : ''}</Empty> : (
        <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>Employee</th><th>Document</th><th>File</th><th>Uploaded</th><th /></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{name(r.staff_id)}</td><td>{r.data.type}</td><td>{r.data.file_name} <small className="hr-muted">{Math.round((r.data.size || 0) / 1024)} KB</small></td><td>{fmtDate(r.data.uploaded_on)}</td>
            <td className="hr-r"><button className="hr-btn hr-btn--small" onClick={() => open(r)}>Open</button>{manage && <button className="hr-btn hr-btn--small hr-btn--ghost" onClick={() => window.confirm('Delete this document?') && act((d) => store.deleteRecord(d, r.id), 'Document deleted')}>Delete</button>}</td></tr>)}</tbody></table></div>)}
    </div>
  );
}
