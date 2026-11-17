// What the signed-in user may do. (The database enforces the same rules — this only shapes the screen.)
export const perm = (user, module) => (!user || !user.active ? 'none' : user.role === 'Admin' ? 'edit' : (user.permissions || {})[module] || 'none');
export const canView = (user, module) => ['view', 'edit'].includes(perm(user, module));
export const canEdit = (user, module) => perm(user, module) === 'edit';
export const KIND_MODULE = { leave_request: 'leave', expense: 'expenses', punch: 'attendance', announcement: 'announcements', asset: 'assets', ticket: 'helpdesk', goal: 'performance', review: 'performance', candidate: 'hiring', document: 'documents', att_request: 'attendance' };
const OWN_KINDS = ['leave_request', 'expense', 'punch', 'ticket', 'goal', 'review', 'asset', 'att_request'];

/** Trim the data to what this user may see (mirrors the database rules; matters in demo mode). */
export function scopeDb(db, user) {
  const mine = user.staff_id;
  const seeStaff = canView(user, 'staff') || canView(user, 'payroll');
  const staff = seeStaff ? db.staff : db.staff.filter((s) => s.id === mine);
  const ids = new Set(staff.map((s) => s.id));
  const pick = (obj, ok) => Object.fromEntries(Object.entries(obj).filter(([sid]) => ok || sid === mine));
  return {
    ...db, staff,
    revisions: db.revisions.filter((r) => canView(user, 'payroll') || r.staff_id === mine),
    attendance: pick(db.attendance, canView(user, 'attendance') || canView(user, 'payroll')),
    payments: pick(db.payments, canView(user, 'payroll')),
    records: db.records.filter((r) => canView(user, KIND_MODULE[r.kind]) || (r.staff_id === mine && (OWN_KINDS.includes(r.kind) || (r.kind === 'document' && r.data.shared !== false))) || r.kind === 'announcement'),
    users: canView(user, 'users') ? db.users : db.users.filter((u) => u.user_id === user.user_id),
    _visibleStaff: ids,
  };
}
