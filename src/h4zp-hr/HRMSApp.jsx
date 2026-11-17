import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './hrms.css';
import logo from './assets/logo.png';
import { DEMO_MODE } from './lib/supabaseClient';
import * as store from './lib/store';
import { canView, canEdit } from './lib/permissions';
import { computeAll, fyMonths, currentMonthIndex } from './lib/payroll';
import Login from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Staff from './pages/Staff';
import Attendance from './pages/Attendance';
import TimeLog from './pages/TimeLog';
import LeaveCenter from './pages/LeaveCenter';
import Payroll from './pages/Payroll';
import Payslip from './pages/Payslip';
import Expenses from './pages/Expenses';
import StaffList from './pages/StaffList';
import Statement from './pages/Statement';
import Payments from './pages/Payments';
import Org from './pages/Org';
import { Assets, Helpdesk, Performance, Hiring, Announcements } from './pages/Collections';
import DocCenter from './pages/DocCenter';
import MyDocuments from './pages/MyDocuments';
import MyAttendance from './pages/MyAttendance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Account from './pages/Account';

// [key, label, component, module that grants access ('' = everyone), needs a linked employee?]
const NAV = [
  ['Me', [
    ['home', 'Home', Home, ''],
    ['myatt', 'My attendance', MyAttendance, '', true],
    ['leave', 'Leave', LeaveCenter, ''],
    ['mydocs', 'My documents', MyDocuments, '', true],
    ['mypay', 'My pay', Payslip, '', true],
    ['expenses', 'Expenses', Expenses, ''],
    ['helpdesk', 'Helpdesk', Helpdesk, ''],
    ['goals', 'Goals & reviews', Performance, ''],
  ]],
  ['Organisation', [
    ['org', 'People & org chart', Org, ''],
    ['announcements', 'Announcements', Announcements, 'announcements'],
  ]],
  ['HR', [
    ['dashboard', 'HR dashboard', Dashboard, 'staff'],
    ['staff', 'Staff records', Staff, 'staff'],
    ['documents', 'Documents & letters', DocCenter, 'documents'],
    ['attendance', 'Attendance', Attendance, 'attendance'],
    ['timelog', 'Clock-in log', TimeLog, 'attendance'],
    ['hiring', 'Hiring', Hiring, 'hiring'],
    ['assets', 'Assets', Assets, 'assets'],
    ['stafflist', 'Staff list (print)', StaffList, 'staff'],
  ]],
  ['Payroll', [
    ['payroll', 'Salary & payments', Payroll, 'payroll'],
    ['payslips', 'Payslips', Payslip, 'payroll'],
    ['payments', 'Payment tracker', Payments, 'payroll'],
    ['statement', 'Employee statement', Statement, 'payroll'],
  ]],
  ['Admin', [
    ['reports', 'Reports', Reports, 'reports'],
    ['settings', 'Settings', Settings, 'settings'],
    ['users', 'Users & permissions', Users, 'users'],
  ]],
];
const MODULE_OF = { leave: 'leave', expenses: 'expenses', helpdesk: 'helpdesk', goals: 'performance', timelog: 'attendance', announcements: 'announcements', staff: 'staff', documents: 'documents', attendance: 'attendance', hiring: 'hiring', assets: 'assets', payroll: 'payroll', payslips: 'payroll', payments: 'payroll', statement: 'payroll', settings: 'settings', users: 'users', dashboard: 'staff', stafflist: 'staff', reports: 'reports' };

export default function HRMSApp() {
  const [user, setUser] = useState(undefined);
  const [db, setDb] = useState(null);
  const [page, setPage] = useState('home');
  const [monthIdx, setMonthIdx] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { store.currentUser().then(setUser).catch(() => setUser(null)); }, []);
  useEffect(() => {
    if (!user) return;
    store.loadAll(user).then((d) => { setDb(d); setMonthIdx(currentMonthIndex(fyMonths(d.settings.fyStart))); }).catch((e) => setError(e.message));
  }, [user]);

  const notify = useCallback((msg, tone = 'ok') => { setToast({ msg, tone }); setTimeout(() => setToast(null), 3400); }, []);
  /** Run a store write, update state, show a message. */
  const act = useCallback(async (fn, okMsg) => {
    try { const n = await fn(db); setDb(n); if (okMsg) notify(okMsg); return true; } catch (e) { notify(/row-level security|permission denied/i.test(e.message) ? 'Your login is not allowed to change this.' : e.message, 'bad'); return false; }
  }, [db, notify]);

  const months = useMemo(() => (db ? fyMonths(db.settings.fyStart) : []), [db]);
  const results = useMemo(() => (db ? computeAll(db) : {}), [db]);

  if (user === undefined) return <div className="hrms hr-center"><p>Loading…</p></div>;
  if (!user) return <Login onLogin={setUser} />;
  if (error) return <div className="hrms hr-center"><div className="hr-panel"><h2>Could not load H4ZP HR</h2><p>{error}</p><p>Check that supabase/schema.sql was run and that this login is listed under Users & permissions.</p><button className="hr-btn" onClick={async () => { await store.signOut(); setUser(null); setError(''); }}>Sign out</button></div></div>;
  if (!db || monthIdx == null) return <div className="hrms hr-center"><p>Loading…</p></div>;

  const me = db.me;
  const myStaff = db.staff.find((s) => s.id === me.staff_id) || null;
  const forced = !!me.must_change;
  const groups = forced ? [] : NAV.map(([g, items]) => [g, items.filter(([, , , mod, needsStaff]) => (mod === '' || canView(me, mod)) && (!needsStaff || myStaff))]).filter(([, items]) => items.length);
  const flat = groups.flatMap(([, items]) => items);
  const cur = flat.find((p) => p[0] === page) || flat[0] || NAV[0][1][0];
  const Page = cur[2];
  const mod = MODULE_OF[cur[0]];
  const ctx = {
    db, me, myStaff, act, store, results, months, monthIdx, setMonthIdx, notify, go: setPage, pageKey: cur[0],
    can: { view: (m) => canView(me, m), edit: (m) => canEdit(me, m) },
    manage: mod ? canEdit(me, mod) : false, seeAll: mod ? canView(me, mod) : false,
    selfOnly: cur[0] === 'mypay',
  };

  return (
    <div className="hrms">
      <aside className={'hr-side' + (menuOpen ? ' is-open' : '')}>
        <div className="hr-brand">
          <img src={logo} alt="H4ZP stamp" />
          <div><strong>H4ZP HR</strong><span>FY {db.settings.fyStart}-{String(db.settings.fyStart + 1).slice(2)}</span></div>
        </div>
        <nav className="hr-nav">
          {groups.map(([g, items]) => (
            <div key={g} className="hr-nav__group"><p>{g}</p>
              {items.map(([key, label]) => <button key={key} className={cur[0] === key ? 'is-on' : ''} onClick={() => { setPage(key); setMenuOpen(false); }}>{label}</button>)}
            </div>))}
        </nav>
        <div className="hr-side__foot">
          <span title={me.login}><b>{me.name || me.login}</b> · {me.role}</span>
          <div><button className="hr-link" onClick={() => { setPage('account'); setMenuOpen(false); }}>Change password</button> · <button className="hr-link" onClick={async () => { await store.signOut(); setUser(null); setDb(null); setPage('home'); }}>Sign out</button></div>
        </div>
      </aside>
      <main className="hr-main">
        <button className="hr-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰ Menu</button>
        {DEMO_MODE && <div className="hr-demo">Demo mode — data is saved only in this browser. Connect Supabase (see README) before entering real staff details.</div>}
        {forced ? <Account {...ctx} forced /> : page === 'account' ? <Account {...ctx} /> : <Page {...ctx} />}
      </main>
      {toast && <div className={`hr-toast hr-toast--${toast.tone}`} role="status">{toast.msg}</div>}
    </div>
  );
}
