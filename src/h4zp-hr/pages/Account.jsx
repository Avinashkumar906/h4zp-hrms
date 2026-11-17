import React, { useState } from 'react';
import { Field, Input } from '../components/ui';

export default function Account({ me, act, store, notify, forced, go }) {
  const [cur, setCur] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState('');
  const save = async () => {
    if (a !== b) { notify('The two new passwords do not match.', 'bad'); return; }
    if (await act((d) => store.changeMyPassword(d, cur, a), 'Password changed')) { setCur(''); setA(''); setB(''); if (go) go('home'); }
  };
  return (
    <div className="hr-page"><header className="hr-head"><div><h1>{forced ? 'Set your own password' : 'Change password'}</h1>
      <p className="hr-muted">Signed in as <b>{me.login}</b> ({me.role}).{forced ? ' You signed in with a temporary password. Choose your own password to continue.' : ''}</p></div></header>
      <section className="hr-panel" style={{ maxWidth: 420 }}><div className="hr-form hr-form--one">
        <Field label={forced ? 'Temporary password' : 'Current password'}><Input type="password" value={cur} onChange={setCur} autoComplete="current-password" /></Field>
        <Field label="New password" hint="At least 8 characters. Do not reuse the temporary password."><Input type="password" value={a} onChange={setA} autoComplete="new-password" /></Field>
        <Field label="New password again"><Input type="password" value={b} onChange={setB} autoComplete="new-password" /></Field></div>
        <button className="hr-btn hr-btn--primary" style={{ marginTop: 12 }} disabled={!cur || a.length < 8} onClick={save}>Save new password</button></section></div>
  );
}
