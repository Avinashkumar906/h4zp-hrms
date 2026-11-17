import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { signIn } from '../lib/store';
import { DEMO_MODE } from '../lib/supabaseClient';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { onLogin(await signIn(login, password)); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="hrms hr-login">
      <form className="hr-login__card" onSubmit={submit}>
        <img src={logo} alt="Hands 4 Zero Poverty Trust" className="hr-login__logo" />
        <h1>H4ZP HR</h1>
        <p className="hr-muted">Hands 4 Zero Poverty Trust — staff sign-in</p>
        <label className="hr-field"><span className="hr-field__label">User ID, email or mobile number</span>
          <input className="hr-input" autoComplete="username" autoCapitalize="none" value={login} onChange={(e) => setLogin(e.target.value)} required /></label>
        <label className="hr-field"><span className="hr-field__label">Password</span>
          <input className="hr-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="hr-error" role="alert">{err}</p>}
        <button className="hr-btn hr-btn--primary hr-btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {DEMO_MODE ? <p className="hr-hint">Demo: user ID <b>admin</b> (or <b>H4ZP-001</b>), password <b>h4zp-demo</b>.</p> : <p className="hr-muted hr-small">Forgot your password? Ask the administrator to reset it.</p>}
      </form>
    </div>
  );
}
