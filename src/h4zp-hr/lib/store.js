// Data layer. Uses Supabase when configured; otherwise a browser-only demo store.
import { supabase, signupClient, DEMO_MODE } from './supabaseClient';
import { DEFAULT_SETTINGS, EMPTY_STAFF, LOGIN_DOMAIN, ROLE_PRESETS } from './defaults';
import { SEED_STAFF } from './seed';
import { scopeDb } from './permissions';

const LS = 'h4zp_hr_demo_v2';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const merge = (base, over) => {
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) ? merge(base[k] || {}, over[k]) : over[k];
  return out;
};
/** Emp ID → user ID, e.g. "H4ZP-016" → "h4zp-016". */
export const loginFromEmpId = (empId) => String(empId || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
/** Easy-to-read temporary password, e.g. "Kmrt@4829". */
export function genPassword() {
  const L = 'abcdefghjkmnpqrstuvwxyz', r = new Uint32Array(8); crypto.getRandomValues(r);
  const letters = Array.from(r.slice(0, 4), (x, i) => (i === 0 ? L[x % L.length].toUpperCase() : L[x % L.length])).join('');
  return `${letters}@${Array.from(r.slice(4), (x) => x % 10).join('')}`;
}
const digits10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);
/** Demo-mode version of the database's hrms_login_lookup. */
function demoLookup(raw, ident) {
  const v = ident.trim().toLowerCase(), d = digits10(ident);
  const hits = new Set(raw.users.filter((u) => u.active).filter((u) => {
    const s = raw.staff.find((x) => x.id === u.staff_id) || {};
    return u.login === v || (s.emp_id || '').toLowerCase() === v || (s.email || '').toLowerCase() === v || (d.length === 10 && digits10(s.mobile) === d);
  }).map((u) => u.login));
  return hits.size === 1 ? [...hits][0] : null;
}
const toEmail = (login) => (login.includes('@') ? login : `${login}@${LOGIN_DOMAIN}`).toLowerCase();
const fail = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };

// ───────── demo store ─────────
function demoRaw() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s) return s; } catch (e) { /* ignore */ }
  const staff = SEED_STAFF.map((s) => ({ ...s, id: uid() }));
  const db = {
    settings: DEFAULT_SETTINGS, staff, revisions: [], attendance: {}, payments: {},
    records: [{ id: uid(), kind: 'announcement', staff_id: null, created_at: new Date().toISOString(), data: { title: 'Welcome to H4ZP HR', body: 'Leave, attendance, payslips and expense claims are now in one place.', pinned: true } }],
    users: [{ user_id: uid(), login: 'admin', name: 'Giriraj', role: 'Admin', permissions: ROLE_PRESETS.Admin, staff_id: staff[0].id, active: true, password: 'h4zp-demo' }],
  };
  localStorage.setItem(LS, JSON.stringify(db)); return db;
}
const demoSave = (db) => { const { directory, _visibleStaff, me, ...rest } = db; localStorage.setItem(LS, JSON.stringify(rest)); };
/** In demo mode writes go to the full store, then the view is re-scoped for the current user. */
const demoWrite = (me, fn) => { const raw = demoRaw(); const next = fn(raw); demoSave(next); return view(next, me); };
const directoryOf = (staff) => staff.map((s) => ({ id: s.id, emp_id: s.emp_id, name: s.name, designation: s.designation, department: s.department, status: s.status, reports_to: s.reports_to || '', doj: s.doj, dob_md: (s.dob || '').slice(5), email: s.email }));
function view(raw, me) {
  const user = raw.users.find((u) => u.user_id === me.user_id) || me;
  const db = scopeDb({ ...raw, settings: merge(DEFAULT_SETTINGS, raw.settings) }, user);
  return { ...db, directory: directoryOf(raw.staff), me: { ...user, password: undefined } };
}

// ───────── sign in ─────────
export async function signIn(login, password) {
  if (DEMO_MODE) {
    const raw = demoRaw(); const id = demoLookup(raw, login) || login.trim().toLowerCase(); const u = raw.users.find((x) => x.login === id);
    if (!u || u.password !== password) throw new Error('User ID or password is incorrect. (Demo: admin / h4zp-demo)');
    if (!u.active) throw new Error('This login has been switched off. Ask the administrator.');
    sessionStorage.setItem('h4zp_hr_session', u.user_id); return { ...u, password: undefined };
  }
  const { data: found } = await supabase.rpc('hrms_login_lookup', { identifier: login.trim() });
  const { error } = await supabase.auth.signInWithPassword({ email: toEmail(found || login.trim()), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'User ID or password is incorrect.' : error.message);
  const me = await currentUser();
  if (!me) { await supabase.auth.signOut(); throw new Error('This login has no access to H4ZP HR. Ask the administrator to add it under Users & permissions.'); }
  return me;
}
export async function currentUser() {
  if (DEMO_MODE) { const id = sessionStorage.getItem('h4zp_hr_session'); const u = demoRaw().users.find((x) => x.user_id === id && x.active); return u ? { ...u, password: undefined } : null; }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { data: row } = await supabase.from('hrms_users').select('*').eq('user_id', data.session.user.id).maybeSingle();
  return row && row.active ? row : null;
}
export async function signOut() {
  if (DEMO_MODE) { sessionStorage.removeItem('h4zp_hr_session'); return; }
  await supabase.auth.signOut();
}
export async function changeMyPassword(db, current, next) {
  const me = db.me;
  if (next.length < 8) throw new Error('Use at least 8 characters.');
  if (next === current) throw new Error('Choose a password different from the current one.');
  if (DEMO_MODE) {
    const raw = demoRaw(); const u = raw.users.find((x) => x.user_id === me.user_id);
    if (u.password !== current) throw new Error('Current password is incorrect.');
    return demoWrite(me, (r) => ({ ...r, users: r.users.map((x) => (x.user_id === me.user_id ? { ...x, password: next, must_change: false } : x)) }));
  }
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: toEmail(me.login), password: current });
  if (e1) throw new Error('Current password is incorrect.');
  fail(await supabase.auth.updateUser({ password: next }));
  await supabase.rpc('hrms_password_changed');
  return { ...db, me: { ...me, must_change: false }, users: db.users.map((x) => (x.user_id === me.user_id ? { ...x, must_change: false } : x)) };
}

// ───────── load everything this user may see ─────────
export async function loadAll(me) {
  if (DEMO_MODE) return view(demoRaw(), me);
  const [s, st, rv, at, py, rc, us, dir] = await Promise.all([
    supabase.from('hrms_settings').select('data').eq('id', 1).maybeSingle(),
    supabase.from('hrms_staff').select('id,data').order('emp_id'),
    supabase.from('hrms_salary_revisions').select('*').order('effective_from'),
    supabase.from('hrms_attendance').select('*'),
    supabase.from('hrms_payments').select('*'),
    supabase.from('hrms_records').select('*').order('created_at', { ascending: false }),
    supabase.from('hrms_users').select('*').order('created_at'),
    supabase.rpc('hrms_directory'),
  ]);
  [s, st, rv, at, py, rc, us, dir].forEach(fail);
  const attendance = {}, payments = {};
  for (const a of at.data) (attendance[a.staff_id] ||= {})[a.ym] = { codes: a.codes || {}, extra: a.extra || {} };
  for (const p of py.data) (payments[p.staff_id] ||= {})[p.ym] = p.data || {};
  return {
    settings: merge(DEFAULT_SETTINGS, s.data?.data || {}),
    staff: st.data.map((r) => ({ ...EMPTY_STAFF, ...r.data, id: r.id })),
    revisions: rv.data.map((r) => ({ ...r, gross: Number(r.gross), night: Number(r.night || 0) })),
    attendance, payments, records: rc.data, users: us.data, directory: dir.data || [], me,
  };
}

// ───────── writes (each returns the updated db) ─────────
export async function saveSettings(db, settings) {
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, settings }));
  fail(await supabase.from('hrms_settings').upsert({ id: 1, data: settings })); return { ...db, settings };
}
export async function saveStaff(db, st0) {
  const st = { ...st0, emp_id: String(st0.emp_id || '').trim().toUpperCase() };
  if (!st.emp_id) throw new Error('Emp ID is required.');
  const dup = db.directory.find((x) => x.emp_id.trim().toLowerCase() === st.emp_id.trim().toLowerCase() && x.id !== st.id);
  if (dup) throw new Error(`Emp ID ${st.emp_id} is already used by ${dup.name}.`);
  const { id, ...data } = st;
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, staff: id ? r.staff.map((x) => (x.id === id ? st : x)) : [...r.staff, { ...st, id: uid() }] }));
  let rec = st;
  if (id) fail(await supabase.from('hrms_staff').update({ data, emp_id: st.emp_id }).eq('id', id));
  else rec = { ...st, id: fail(await supabase.from('hrms_staff').insert({ data, emp_id: st.emp_id }).select('id').single()).id };
  const staff = id ? db.staff.map((x) => (x.id === id ? rec : x)) : [...db.staff, rec];
  const d = directoryOf([rec])[0];
  return { ...db, staff, directory: id ? db.directory.map((x) => (x.id === id ? d : x)) : [...db.directory, d] };
}
export async function deleteStaff(db, id) {
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, staff: r.staff.filter((x) => x.id !== id), revisions: r.revisions.filter((x) => x.staff_id !== id), records: r.records.filter((x) => x.staff_id !== id) }));
  fail(await supabase.from('hrms_staff').delete().eq('id', id));
  return { ...db, staff: db.staff.filter((x) => x.id !== id), directory: db.directory.filter((x) => x.id !== id), revisions: db.revisions.filter((r) => r.staff_id !== id), records: db.records.filter((r) => r.staff_id !== id) };
}
export async function addRevision(db, rev) {
  if (db.revisions.some((r) => r.staff_id === rev.staff_id && r.effective_from === rev.effective_from)) throw new Error('This employee already has a revision on that date.');
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, revisions: [...r.revisions, { ...rev, id: uid() }] }));
  const rec = fail(await supabase.from('hrms_salary_revisions').insert(rev).select('*').single());
  return { ...db, revisions: [...db.revisions, rec] };
}
export async function deleteRevision(db, id) {
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, revisions: r.revisions.filter((x) => x.id !== id) }));
  fail(await supabase.from('hrms_salary_revisions').delete().eq('id', id)); return { ...db, revisions: db.revisions.filter((r) => r.id !== id) };
}
/** rows: [{staff_id, ym, codes, extra}] */
export async function saveAttendance(db, rows) {
  const apply = (a) => { const n = { ...a }; for (const r of rows) n[r.staff_id] = { ...(n[r.staff_id] || {}), [r.ym]: { codes: r.codes, extra: r.extra } }; return n; };
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, attendance: apply(r.attendance) }));
  if (rows.length) fail(await supabase.from('hrms_attendance').upsert(rows, { onConflict: 'staff_id,ym' }));
  return { ...db, attendance: apply(db.attendance) };
}
/** rows: [{staff_id, ym, data}] */
export async function savePayments(db, rows) {
  const apply = (a) => { const n = { ...a }; for (const r of rows) n[r.staff_id] = { ...(n[r.staff_id] || {}), [r.ym]: r.data }; return n; };
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, payments: apply(r.payments) }));
  if (rows.length) fail(await supabase.from('hrms_payments').upsert(rows, { onConflict: 'staff_id,ym' }));
  return { ...db, payments: apply(db.payments) };
}

// generic records: leave requests, expenses, punches, announcements, assets, tickets, goals, reviews, candidates, documents
export async function saveRecord(db, rec) {
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, records: rec.id ? r.records.map((x) => (x.id === rec.id ? { ...x, ...rec } : x)) : [{ ...rec, id: uid(), created_at: new Date().toISOString(), created_by: db.me.user_id }, ...r.records] }));
  if (rec.id) { fail(await supabase.from('hrms_records').update({ data: rec.data, staff_id: rec.staff_id ?? null }).eq('id', rec.id)); return { ...db, records: db.records.map((x) => (x.id === rec.id ? { ...x, ...rec } : x)) }; }
  const row = fail(await supabase.from('hrms_records').insert({ kind: rec.kind, staff_id: rec.staff_id ?? null, data: rec.data }).select('*').single());
  return { ...db, records: [row, ...db.records] };
}
export async function deleteRecord(db, id) {
  const rec = db.records.find((r) => r.id === id);
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, records: r.records.filter((x) => x.id !== id) }));
  if (rec?.kind === 'document' && rec.data.path) await supabase.storage.from('hrms-docs').remove([rec.data.path]);
  fail(await supabase.from('hrms_records').delete().eq('id', id)); return { ...db, records: db.records.filter((r) => r.id !== id) };
}

// documents
export async function uploadDocument(db, staffId, file, meta) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Files up to 5 MB only.');
  if (DEMO_MODE) {
    if (file.size > 300 * 1024) throw new Error('Demo mode stores files in the browser — use a file under 300 KB, or connect Supabase.');
    const url = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(file); });
    return saveRecord(db, { kind: 'document', staff_id: staffId, data: { ...meta, file_name: file.name, size: file.size, data_url: url } });
  }
  const path = `${staffId}/${uid()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
  fail(await supabase.storage.from('hrms-docs').upload(path, file));
  return saveRecord(db, { kind: 'document', staff_id: staffId, data: { ...meta, file_name: file.name, size: file.size, path } });
}
export async function documentUrl(rec) {
  if (rec.data.data_url) return rec.data.data_url;
  return fail(await supabase.storage.from('hrms-docs').createSignedUrl(rec.data.path, 120)).signedUrl;
}

// users & permissions
export async function createUser(db, u) {
  const login = u.login.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,}$/.test(login)) throw new Error('User ID: at least 3 letters or numbers, no spaces.');
  if ((u.password || '').length < 8) throw new Error('Password must be at least 8 characters.');
  if (db.users.some((x) => x.login === login)) throw new Error(`User ID "${login}" is already taken.`);
  if (u.staff_id && db.users.some((x) => x.staff_id === u.staff_id)) throw new Error('This employee already has a login. Change it under Users & permissions.');
  const row = { login, name: u.name, role: u.role, permissions: u.permissions, staff_id: u.staff_id || null, active: u.active ?? true, must_change: u.must_change ?? true };
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, users: [...r.users, { ...row, user_id: uid(), password: u.password }] }));
  const { data, error } = await signupClient().auth.signUp({ email: toEmail(login), password: u.password });
  if (error) throw new Error(/signups? (are )?(not allowed|disabled)/i.test(error.message) ? 'New logins are blocked in Supabase. Turn on "Allow new users to sign up" and turn off "Confirm email" (Authentication → Sign In / Providers → Email).' : error.message);
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error(`A login for "${login}" already exists in Supabase.`);
  const rec = fail(await supabase.from('hrms_users').insert({ ...row, user_id: data.user.id }).select('*').single());
  return { ...db, users: [...db.users, rec] };
}
export async function updateUser(db, u) {
  const patch = { name: u.name, role: u.role, permissions: u.permissions, staff_id: u.staff_id || null, active: u.active };
  if (u.user_id === db.me.user_id && (u.role !== 'Admin' || !u.active) && db.me.role === 'Admin' && !db.users.some((x) => x.role === 'Admin' && x.active && x.user_id !== u.user_id)) throw new Error('You are the only administrator — add another Admin before changing your own access.');
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, users: r.users.map((x) => (x.user_id === u.user_id ? { ...x, ...patch } : x)) }));
  fail(await supabase.from('hrms_users').update(patch).eq('user_id', u.user_id));
  return { ...db, users: db.users.map((x) => (x.user_id === u.user_id ? { ...x, ...patch } : x)) };
}
export async function resetPassword(db, userId, password) {
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const mc = userId !== db.me.user_id;
  if (DEMO_MODE) return demoWrite(db.me, (r) => ({ ...r, users: r.users.map((x) => (x.user_id === userId ? { ...x, password, must_change: mc } : x)) }));
  fail(await supabase.rpc('hrms_set_password', { target: userId, new_password: password }));
  return { ...db, users: db.users.map((x) => (x.user_id === userId ? { ...x, must_change: mc } : x)) };
}

export function exportBackup(db) {
  const { me, _visibleStaff, ...rest } = db;
  const blob = new Blob([JSON.stringify(rest, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `h4zp-hr-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
}
export function downloadCsv(name, rows) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })); a.download = name; a.click();
}
export function resetDemo() { localStorage.removeItem(LS); sessionStorage.removeItem('h4zp_hr_session'); }

/** Create an Employee login for a staff record: user ID = Emp ID, random temporary password. */
export async function createLoginFor(db, st, active = true) {
  const login = loginFromEmpId(st.emp_id), password = genPassword();
  if (login.length < 3) throw new Error(`Emp ID "${st.emp_id}" is too short to be a user ID.`);
  const n = await createUser(db, { login, name: st.name, role: 'Employee', permissions: { ...ROLE_PRESETS.Employee }, staff_id: st.id, password, active, must_change: true });
  return { db: n, cred: { staff: st, login, password } };
}
