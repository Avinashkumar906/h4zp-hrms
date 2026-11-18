// Show new login details and send them by WhatsApp / email, print as PDF or download.
import React, { useState } from 'react';
import { logoOf } from '../lib/brand';
import { Modal, Badge } from './ui';
import { fmtLongDate, todayIso } from '../lib/format';
import { downloadCsv } from '../lib/store';

const portal = (S) => S.portalUrl || window.location.href.split('#')[0].split('?')[0];
const waNumber = (m) => { const d = String(m || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };

export function credentialMessage(c, S) {
  const s = c.staff || {};
  const also = [s.email && `email (${s.email})`, s.mobile && `mobile number (${s.mobile})`].filter(Boolean);
  return [
    `Dear ${s.name || c.name || ''},`, '',
    `Your login for H4ZP HR — ${S.org} — is ready.`, '',
    `Website: ${portal(S)}`,
    `User ID: ${c.login}`,
    `Temporary password: ${c.password}`, '',
    also.length ? `You can also sign in with your ${also.join(' or ')} instead of the User ID.` : null,
    'You will be asked to set your own password the first time you sign in. Please do not share it with anyone.', '',
    'Regards,', S.org,
  ].filter((x) => x !== null).join('\n');
}

export function CredentialsDialog({ items, settings: S, onClose, title, note }) {
  const [printIdx, setPrintIdx] = useState(null);
  const [copied, setCopied] = useState(null);
  const print = (i) => { setPrintIdx(i); setTimeout(() => { window.print(); setPrintIdx(null); }, 60); };
  const copy = async (c, i) => { try { await navigator.clipboard.writeText(credentialMessage(c, S)); setCopied(i); setTimeout(() => setCopied(null), 1800); } catch (e) { window.prompt('Copy this message:', credentialMessage(c, S)); } };
  const whatsapp = (c) => window.open(`https://wa.me/${waNumber(c.staff?.mobile)}?text=${encodeURIComponent(credentialMessage(c, S))}`, '_blank', 'noopener');
  const email = (c) => { window.location.href = `mailto:${encodeURIComponent(c.staff?.email || '')}?subject=${encodeURIComponent('Your H4ZP HR login')}&body=${encodeURIComponent(credentialMessage(c, S))}`; };
  const download = () => downloadCsv(`H4ZP-HR-logins-${todayIso()}.csv`, [['Emp ID', 'Name', 'Mobile', 'Email', 'User ID', 'Temporary password', 'Website'],
    ...items.map((c) => [c.staff?.emp_id, c.staff?.name || c.name, c.staff?.mobile, c.staff?.email, c.login, c.password, portal(S)])]);
  const slips = printIdx === null ? [] : printIdx === 'all' ? items : [items[printIdx]];

  return (
    <Modal title={title || (items.length === 1 ? 'Login created' : `${items.length} logins created`)} onClose={onClose} size={items.length > 1 ? 'wide' : undefined}
      footer={<><button className="hr-btn" onClick={download}>Download (Excel / CSV)</button>{items.length > 1 && <button className="hr-btn" onClick={() => print('all')}>Print all slips / PDF</button>}<button className="hr-btn hr-btn--primary" onClick={onClose}>Done</button></>}>
      {note && <p className="hr-hint">{note}</p>}
      <p className="hr-muted hr-small">Send these now — for security the password is not shown again. Each person must set their own password at first sign-in. If one is lost, set a new one under Users & permissions.</p>
      <div className="hr-creds">{items.map((c, i) => (
        <div key={c.login} className="hr-cred">
          <div className="hr-cred__who"><b>{c.staff?.name || c.name}</b><span>{c.staff?.emp_id}{c.staff?.designation ? ` · ${c.staff.designation}` : ''}</span>{c.active === false && <Badge tone="mute">login switched off</Badge>}</div>
          <dl><div><dt>User ID</dt><dd className="hr-mono-strong">{c.login}</dd></div><div><dt>Temporary password</dt><dd className="hr-mono-strong">{c.password}</dd></div></dl>
          <div className="hr-cred__send">
            <button className="hr-btn hr-btn--small hr-btn--wa" onClick={() => whatsapp(c)} title={c.staff?.mobile ? `WhatsApp ${c.staff.mobile}` : 'No mobile on record — choose the contact in WhatsApp'}>WhatsApp</button>
            <button className="hr-btn hr-btn--small" onClick={() => email(c)} title={c.staff?.email || 'No email on record'}>Email</button>
            <button className="hr-btn hr-btn--small" onClick={() => copy(c, i)}>{copied === i ? 'Copied ✓' : 'Copy message'}</button>
            <button className="hr-btn hr-btn--small" onClick={() => print(i)}>Print / PDF</button>
          </div>
          {!c.staff?.mobile && !c.staff?.email && <small className="hr-sub">No mobile or email on the staff record — add them so staff can also sign in with those.</small>}
        </div>))}</div>
      <div className="print-area print-only">{slips.map((c) => (
        <article key={c.login} className="hr-slipcard">
          <header><img src={logoOf(S)} alt="" /><div><h2>{S.org}</h2><p>H4ZP HR — login details</p></div></header>
          <p>Dear <b>{c.staff?.name || c.name}</b>{c.staff?.emp_id ? ` (${c.staff.emp_id})` : ''},</p>
          <p>Your login for H4ZP HR has been created.</p>
          <table><tbody>
            <tr><th>Website</th><td>{portal(S)}</td></tr>
            <tr><th>User ID</th><td><b>{c.login}</b></td></tr>
            <tr><th>Temporary password</th><td><b>{c.password}</b></td></tr>
            {(c.staff?.email || c.staff?.mobile) && <tr><th>You can also sign in with</th><td>{[c.staff.email, c.staff.mobile].filter(Boolean).join('  or  ')}</td></tr>}
          </tbody></table>
          <p>You will be asked to set your own password the first time you sign in. Keep this slip private.</p>
          <p className="hr-slipcard__foot">Issued on {fmtLongDate(todayIso())}</p>
        </article>))}</div>
    </Modal>
  );
}
