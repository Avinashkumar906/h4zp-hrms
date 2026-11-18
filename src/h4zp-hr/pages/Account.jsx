import React, { useRef, useState } from 'react';
import { Field, Input, Avatar } from '../components/ui';
import { photoOf, photoRec, squarePhoto, savePhoto } from '../lib/brand';

export default function Account({ db, me, myStaff, act, store, notify, forced, go }) {
  const [cur, setCur] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState('');
  const fileRef = useRef(null);
  const save = async () => {
    if (a !== b) { notify('The two new passwords do not match.', 'bad'); return; }
    if (await act((d) => store.changeMyPassword(d, cur, a), 'Password changed')) { setCur(''); setA(''); setB(''); if (forced && go) go('home'); }
  };
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await squarePhoto(file); await act((d) => savePhoto(store, d, myStaff.id, url), 'Profile photo updated'); } catch (x) { notify(x.message, 'bad'); }
    e.target.value = '';
  };
  const photo = myStaff ? photoOf(db, myStaff.id) : '';
  return (
    <div className="hr-page"><header className="hr-head"><div><h1>{forced ? 'Set your own password' : 'My profile'}</h1>
      <p className="hr-muted">Signed in as <b>{me.login}</b> ({me.role}).{forced ? ' You signed in with a temporary password. Choose your own password to continue.' : ''}</p></div></header>
      {!forced && myStaff && <section className="hr-panel" style={{ maxWidth: 560 }}><h2>Profile photo</h2>
        <div className="hr-photo-edit"><Avatar url={photo} name={myStaff.name} size={96} />
          <div><p className="hr-muted hr-small">Shown on the staff directory and your profile. A clear face photo works best; it is cropped to a square.</p>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <div className="hr-head__actions"><button className="hr-btn hr-btn--primary" onClick={() => fileRef.current.click()}>{photo ? 'Change photo' : 'Upload photo'}</button>
              {photo && <button className="hr-btn hr-btn--ghost" onClick={() => act((d) => store.deleteRecord(d, photoRec(d, myStaff.id).id), 'Photo removed')}>Remove</button>}</div></div></div>
        <dl className="hr-dl" style={{ marginTop: 14, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {[['Emp ID', myStaff.emp_id], ['Designation', myStaff.designation], ['Department', myStaff.department], ['Mobile', myStaff.mobile || '—'], ['Email', myStaff.email || '—'], ['Status', myStaff.status]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>
        <p className="hr-muted hr-small">To correct your other details, raise a Helpdesk ticket to HR.</p></section>}
      <section className="hr-panel" style={{ maxWidth: 420 }}><h2>{forced ? 'New password' : 'Change password'}</h2><div className="hr-form hr-form--one">
        <Field label={forced ? 'Temporary password' : 'Current password'}><Input type="password" value={cur} onChange={setCur} autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 8 characters. Do not reuse the temporary password."><Input type="password" value={a} onChange={setA} autoComplete="new-password" /></Field>
        <Field label="New password again"><Input type="password" value={b} onChange={setB} autoComplete="new-password" /></Field></div>
        <button className="hr-btn hr-btn--primary" style={{ marginTop: 12 }} disabled={!cur || a.length < 8} onClick={save}>Save new password</button></section></div>
  );
}
