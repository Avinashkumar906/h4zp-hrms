// HR letter templates. Admins can edit these on Documents → Templates (saved in Settings).
// Placeholders in {curly braces} are filled from the staff record. {salary_table} on its own line becomes the salary break-up table.
import { salarySplit, rateOn, totalExperienceMonths } from './payroll';
import { fmtLongDate, todayIso, experienceText } from './format';

export const PLACEHOLDERS = [
  ['name', 'Full name'], ['first_name', 'First name'], ['emp_id', 'Emp ID'], ['designation', 'Designation'], ['department', 'Department'],
  ['employment_type', 'Employment type'], ['doj', 'Date of joining'], ['confirm_date', 'Confirmed from'], ['dol', 'Date of leaving'],
  ['last_day', 'Leaving date, or today'], ['service', 'Length of service'], ['gross_month', 'Monthly gross (₹)'], ['gross_year', 'Annual gross (₹)'],
  ['salary_effective', 'Current salary from'], ['reports_to', 'Reports to'], ['cl', 'CL per year'], ['sl', 'SL per year'], ['el', 'EL per year'],
  ['org', 'Organisation'], ['today', "Today's date"], ['purpose', 'Purpose (typed when generating)'], ['salary_table', 'Salary break-up table'],
];

export const DEFAULT_TEMPLATES = {
  offer: { name: 'Offer letter', to: 'person', subject: 'Offer of Employment — {designation}', body:
`Dear {first_name},

We are pleased to offer you the position of {designation} in the {department} team of {org}. Your expected date of joining is {doj}.

Your monthly gross salary will be ₹{gross_month} (₹{gross_year} a year). The break-up is given below.

{salary_table}

This offer is subject to verification of your original documents and a satisfactory Police Clearance Certificate (PCC). Please sign and return a copy of this letter to confirm that you accept it.

We look forward to welcoming you to the team.` },
  appointment: { name: 'Appointment letter', to: 'person', subject: 'Letter of Appointment — {designation}', body:
`Dear {first_name},

With reference to your application and the interview held with you, we are pleased to appoint you as {designation} in the {department} team of {org} with effect from {doj}, on the following terms.

1. Salary: Your monthly gross salary will be ₹{gross_month} (₹{gross_year} a year), as broken up below. Statutory deductions (PF, ESI, professional tax and income tax) will be made as applicable.

{salary_table}

2. Place of work: The Trust's premises, or any other place where the Trust assigns you.
3. Leave: {cl} days of casual leave, {sl} days of sick leave and {el} days of earned leave a year, as per the Trust's leave policy.
4. Confidentiality: All information about the children in the Trust's care, prospective adoptive parents and birth families is strictly confidential, as required under the Juvenile Justice (Care and Protection of Children) Act, 2015 and the Adoption Regulations. You must not share it with anyone, in any form, during or after your employment.
5. Conduct: You will follow the Trust's rules, including its Child Protection Policy, as amended from time to time.
6. Notice: Either side may end this employment by giving one month's notice in writing, or one month's salary in place of notice.

Please sign the duplicate copy of this letter to confirm your acceptance.

We welcome you to {org}.` },
  confirmation: { name: 'Confirmation letter', to: 'person', subject: 'Confirmation of Employment', body:
`Dear {first_name},

We are pleased to inform you that your services as {designation} in the {department} team have been confirmed with effect from {confirm_date}.

Your monthly gross salary from that date is ₹{gross_month}. All other terms of your appointment remain unchanged.

We appreciate your contribution and wish you continued success with {org}.` },
  increment: { name: 'Salary revision / increment letter', to: 'person', subject: 'Revision of Salary', body:
`Dear {first_name},

In recognition of your work as {designation}, we are pleased to revise your monthly gross salary to ₹{gross_month} (₹{gross_year} a year) with effect from {salary_effective}. The revised break-up is given below.

{salary_table}

All other terms of your employment remain unchanged. We thank you for your commitment and look forward to your continued contribution.` },
  salary: { name: 'Salary certificate', to: 'whom', subject: 'Salary Certificate', body:
`This is to certify that {name} (Emp ID {emp_id}) is working with {org} as {designation} in the {department} team since {doj}.

Their present monthly gross salary is ₹{gross_month} (₹{gross_year} a year), as broken up below.

{salary_table}

This certificate is issued at the employee's request for the purpose of {purpose}.` },
  employment: { name: 'Employment certificate / NOC', to: 'whom', subject: 'Employment Certificate', body:
`This is to certify that {name} (Emp ID {emp_id}) is employed with {org} as {designation} in the {department} team since {doj}, and continues in our employment as on date.

The Trust has no objection to {purpose}.

This certificate is issued at the employee's request.` },
  experience: { name: 'Experience certificate', to: 'whom', subject: 'Experience Certificate', body:
`This is to certify that {name} (Emp ID {emp_id}) worked with {org} as {designation} in the {department} team from {doj} to {last_day}, a period of {service}.

During this period we found them sincere, hardworking and dedicated to their duties.

We wish them every success in the future.` },
  relieving: { name: 'Relieving letter', to: 'person', subject: 'Relieving Letter', body:
`Dear {first_name},

This is to confirm that your resignation from the post of {designation} has been accepted, and you are relieved of your duties with {org} at the close of working hours on {dol}.

You worked with us from {doj} to {dol}. Your full and final settlement will be made as per the Trust's policy.

We thank you for your contribution and wish you success in the future.` },
  custom: { name: 'Custom letter', to: 'person', subject: '', body: `Dear {first_name},

` },
};

const inrN = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');

/** Everything a template can use for one employee. */
export function docValues(st, db, extra = {}) {
  const S = db.settings, t = todayIso();
  const rate = rateOn(st, db.revisions, t);
  const gross = (rate.gross || Number(st.gross) || 0) + (rate.night || Number(st.night_salary) || 0);
  const revs = db.revisions.filter((r) => r.staff_id === st.id && r.effective_from <= t).sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  const boss = db.directory.find((p) => p.id === st.reports_to);
  return {
    name: st.name || '', first_name: (st.name || '').replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '').split(' ')[0], emp_id: st.emp_id || '',
    designation: st.designation || '', department: st.department || '', employment_type: st.employment_type || 'regular',
    doj: st.doj ? fmtLongDate(st.doj) : '[date of joining]', confirm_date: st.confirm_date ? fmtLongDate(st.confirm_date) : '[confirmation date]',
    dol: st.dol ? fmtLongDate(st.dol) : '[date of leaving]', last_day: fmtLongDate(st.dol || t), service: experienceText(totalExperienceMonths({ ...st, prev_exp_years: 0 })),
    gross_month: gross ? inrN(gross) : '[salary]', gross_year: gross ? inrN(gross * 12) : '[salary]',
    salary_effective: fmtLongDate(revs[0]?.effective_from || st.salary_effective || st.doj || t), reports_to: boss ? `${boss.name}, ${boss.designation}` : '',
    cl: S.leave.CL, sl: S.leave.SL, el: S.leave.EL, org: S.org, today: fmtLongDate(t), purpose: extra.purpose || '[purpose]', _gross: gross,
  };
}
export const fillTemplate = (text, v) => String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k === 'salary_table' ? m : v[k] !== undefined && v[k] !== '' ? String(v[k]) : m));

export function salaryRows(gross, S, deductPf = true) {
  if (!gross) return [];
  const sp = salarySplit(gross, S);
  const erPf = deductPf ? Math.min(Math.round(Math.min(sp.codeWages, S.pf.ceilNew) * S.pf.er), S.pf.max) : 0;
  const rows = [['Basic', sp.basic], ...(sp.da ? [['Dearness Allowance', sp.da]] : []), ['House Rent Allowance', sp.hra], ['Conveyance Allowance', sp.conv], ['Special Allowance', sp.special], ['Gross Salary', gross, true]];
  if (erPf) rows.push(["Employer's PF contribution", erPf], ['Cost to the Trust (CTC)', gross + erPf, true]);
  return rows;
}
export const nextRef = (db) => {
  const fy = `${db.settings.fyStart}-${String(db.settings.fyStart + 1).slice(2)}`;
  const n = db.records.filter((r) => r.kind === 'document' && r.data.generated && (r.data.ref || '').includes(fy)).length + 1;
  return `H4ZP/HR/${fy}/${String(n).padStart(3, '0')}`;
};
