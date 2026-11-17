import React, { useState } from 'react';
import { MODULES, ROLE_PRESETS } from '../lib/defaults';
import { Field, Input, Select, Modal, Badge } from '../components/ui';
import { CredentialsDialog } from '../components/Credentials';
import { loginFromEmpId, genPassword } from '../lib/store';

const LEVELS = [['none', 'No access'], ['view', 'View only'], ['edit', 'Full access']];
const roleOf = (perms) => Object.keys(ROLE_PRESETS).find((r) => r !== 'Custom' && MODULES.every(([k]) => (ROLE_PRESETS[r][k] || 'none') === (perms[k] || 'none'))) || 'Custom';

function UserForm({ initial, db, act, store, onClose, manage, onCreds }) {
  const isNew = !initial.user_id;
  const [u, setU] = useState({ login: '', name: '', password: genPassword(), role: 'Employee', permissions: { ...ROLE_PRESETS.Employee }, staff_id: '', active: true, ...initial });
  const [pw, setPw] = useState('');
  const setRole = (role) => setU({ ...u, role, permissions: role === 'Custom' ? u.permissions : { ...ROLE_PRESETS[role] } });
  const setPerm = (k, v) => { const permissions = { ...u.permissions, [k]: v }; setU({ ...u, permissions, role: u.role === 'Admin' ? 'Admin' : roleOf(permissions) }); };
  const pickStaff = (sid) => { const s = db.staff.find((x) => x.id === sid); setU({ ...u, staff_id: sid, name: s?.name || u.name, login: isNew && s ? loginFromEmpId(s.emp_id) : u.login }); };
  const staffRec = db.staff.find((x) => x.id === u.staff_id);
  const save = async () => {
    if (!(await act((d) => (isNew ? store.createUser(d, u) : store.updateUser(d, u)), isNew ? `Login “${u.login}” created` : 'Access updated'))) return;
    onClose(); if (isNew) onCreds({ items: [{ staff: staffRec, name: u.name, login: u.login.trim().toLowerCase(), password: u.password }] });
  };
  const sendNew = async () => {
    const np = pw.length >= 8 ? pw : genPassword();
    if (await act((d) => store.resetPassword(d, u.user_id, np), 'Password changed')) { setPw(''); onClose(); if (u.user_id !== db.me.user_id) onCreds({ items: [{ staff: staffRec, name: u.name, login: u.login, password: np }], title: 'New password' }); }
  };
  const admin = u.role === 'Admin';
  return (
    <Modal title={isNew ? 'Add a user' : `Access for ${u.name || u.login}`} onClose={onClose} size="wide"
      footer={<><button className="hr-btn" onClick={onClose}>Cancel</button>{manage && <button className="hr-btn hr-btn--primary" onClick={save}>{isNew ? 'Create login' : 'Save access'}</button>}</>}>
      <div className="hr-split">
        <div className="hr-form hr-form--one">
          <Field label="Employee this login belongs to" hint="Gives them their own attendance, leave, payslips and expenses."><Select value={u.staff_id || ''} onChange={pickStaff} options={db.staff.map((s) => ({ value: s.id, label: `${s.emp_id} | ${s.name}` }))} placeholder="Not an employee (e.g. the CA)" /></Field>
          <Field label="User ID" hint={isNew ? 'Their Emp ID by default. They can also sign in with the email or mobile number on their staff record.' : 'The user ID cannot be changed. They can also sign in with their email or mobile.'}><Input value={u.login} disabled={!isNew} onChange={(v) => setU({ ...u, login: v.toLowerCase().replace(/\s/g, '') })} autoCapitalize="none" /></Field>
          <Field label="Name"><Input value={u.name} onChange={(v) => setU({ ...u, name: v })} /></Field>
          {isNew && <Field label="Temporary password" hint="They must set their own password at first sign-in. You can send it by WhatsApp or email after saving.">
            <div className="hr-inline"><Input type="text" value={u.password} onChange={(v) => setU({ ...u, password: v })} /><button type="button" className="hr-btn hr-btn--small" onClick={() => setU({ ...u, password: genPassword() })}>New</button></div></Field>}
          <Field label="Role" hint="A role fills in the permissions on the right; change any of them to make a custom role."><Select value={u.role} onChange={setRole} options={Object.keys(ROLE_PRESETS)} /></Field>
          {!isNew && <Field label="Login is"><Select value={u.active ? 'on' : 'off'} onChange={(v) => setU({ ...u, active: v === 'on' })} options={[{ value: 'on', label: 'Active — can sign in' }, { value: 'off', label: 'Switched off — cannot sign in' }]} /></Field>}
          {!isNew && manage && <div className="hr-panel hr-panel--soft"><Field label="Change this user's password" hint="Leave blank to generate one. Others must set their own at next sign-in."><Input type="text" value={pw} onChange={setPw} placeholder="Type a password, or leave blank" /></Field>
            <button className="hr-btn hr-btn--small" disabled={pw.length > 0 && pw.length < 8} onClick={sendNew}>{pw ? 'Change & send' : 'Generate & send'}</button></div>}
        </div>
        <div>
          <h3 className="hr-h3">What this user can do</h3>
          {admin ? <p className="hr-hint">Administrators can do everything, including adding users.</p> : null}
          <table className="hr-table hr-perm"><thead><tr><th>Area</th>{LEVELS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
            <tbody>{MODULES.map(([k, label, hint]) => <tr key={k}><td><b>{label}</b><small className="hr-sub">{hint}</small></td>
              {LEVELS.map(([lv]) => <td key={lv}><input type="radio" name={`perm-${k}`} aria-label={`${label}: ${lv}`} disabled={admin} checked={(admin ? 'edit' : u.permissions[k] || 'none') === lv} onChange={() => setPerm(k, lv)} /></td>)}</tr>)}</tbody></table>
          <p className="hr-muted hr-small">Everyone, whatever their role, can use Home, their own leave, clock-in, payslips, expenses, helpdesk and goals, and see the staff directory.</p>
        </div>
      </div>
    </Modal>
  );
}

export default function Users({ db, me, act, store, manage }) {
  const [edit, setEdit] = useState(null);
  const [creds, setCreds] = useState(null);
  const staffName = (id) => db.directory.find((p) => p.id === id);
  const areas = (u) => u.role === 'Admin' ? 'Everything' : MODULES.filter(([k]) => (u.permissions || {})[k] && u.permissions[k] !== 'none').map(([k, l]) => `${l}${u.permissions[k] === 'view' ? ' (view)' : ''}`).join(', ') || 'Self-service only';
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>Users & permissions</h1><p className="hr-muted">{db.users.filter((u) => u.active).length} active logins. Each person signs in with their own user ID and password and sees only what you allow.</p></div>
        {manage && <button className="hr-btn hr-btn--primary" onClick={() => setEdit({})}>Add a user</button>}</header>
      <div className="hr-table-wrap"><table className="hr-table"><thead><tr><th>User ID</th><th>Name</th><th>Employee</th><th>Role</th><th>Can use</th><th>Status</th><th /></tr></thead>
        <tbody>{db.users.map((u) => { const s = staffName(u.staff_id); return <tr key={u.user_id} className={u.active ? '' : 'is-future'}>
          <td className="hr-mono"><b>{u.login}</b>{u.user_id === me.user_id && <small className="hr-sub">you</small>}</td><td>{u.name}</td><td>{s ? `${s.emp_id} · ${s.designation}` : <span className="hr-muted">—</span>}</td>
          <td><Badge tone={u.role === 'Admin' ? 'ok' : u.role === 'Employee' ? 'mute' : 'info'}>{u.role}</Badge></td><td className="hr-small">{areas(u)}</td>
          <td><Badge tone={u.active ? (u.must_change ? 'warn' : 'ok') : 'bad'}>{u.active ? (u.must_change ? 'Temporary password' : 'Active') : 'Switched off'}</Badge></td>
          <td className="hr-r"><button className="hr-btn hr-btn--small" onClick={() => setEdit(u)}>{manage ? 'Edit access' : 'View'}</button></td></tr>; })}</tbody></table></div>
      <section className="hr-panel"><h2>Ready-made roles</h2><ul className="hr-counts">
        <li><span><b>Admin</b> — everything, including users and settings</span></li><li><span><b>HR Manager</b> — all HR and payroll work; cannot manage users</span></li>
        <li><span><b>Accountant</b> — payroll, payments and expense approvals; views staff, attendance and leave</span></li>
        <li><span><b>Manager</b> — approves leave and expenses, sets goals and reviews, posts announcements</span></li>
        <li><span><b>Employee</b> — self-service only: own attendance, leave, payslips, expenses, helpdesk</span></li><li><span><b>Custom</b> — pick the level for each area yourself</span></li></ul></section>
      {edit && <UserForm initial={edit} db={db} act={act} store={store} manage={manage} onCreds={setCreds} onClose={() => setEdit(null)} />}
      {creds && <CredentialsDialog {...creds} settings={db.settings} onClose={() => setCreds(null)} />}
    </div>
  );
}
