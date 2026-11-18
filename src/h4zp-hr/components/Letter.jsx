// A generated HR letter on the Trust's letterhead — used on screen and for Print / Save as PDF.
import React from 'react';
import { logoOf, signOf } from '../lib/brand';
import { fmtLongDate } from '../lib/format';

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export default function Letter({ doc, settings: S, printable }) {
  const d = doc.data;
  const paras = String(d.body || '').split(/\n{2,}/);
  return (
    <article className={'hr-letter' + (printable ? ' print-area' : '')}>
      <header className="hr-letter__head">
        <img src={logoOf(S)} alt="H4ZP" />
        <div><h2>{S.org.replace(/\s*\(H4ZP\)\s*$/, '')}</h2>{S.address.filter(Boolean).length > 0 && <p>{S.address.filter(Boolean).join(', ')}</p>}</div>
      </header>
      <div className="hr-letter__meta"><span>Ref: {d.ref}</span><span>Date: {fmtLongDate(d.date)}</span></div>
      {d.to === 'whom' ? <p className="hr-letter__to"><b>TO WHOM IT MAY CONCERN</b></p>
        : <div className="hr-letter__to">{(d.to_lines || []).filter(Boolean).map((l, i) => <p key={i}>{i === 0 ? <b>{l}</b> : l}</p>)}</div>}
      {d.subject && <p className="hr-letter__subject"><b>Subject: {d.subject}</b></p>}
      <div className="hr-letter__body">{paras.map((p, i) => (p.trim() === '{salary_table}'
        ? (d.salary_rows || []).length > 0 && <table key={i} className="hr-letter__table"><thead><tr><th>Component</th><th>Monthly</th><th>Annual</th></tr></thead>
          <tbody>{d.salary_rows.map(([k, v, strong]) => <tr key={k} className={strong ? 'is-strong' : ''}><td>{k}</td><td>{inr(v)}</td><td>{inr(v * 12)}</td></tr>)}</tbody></table>
        : <p key={i}>{p.split('\n').map((line, j, arr) => <React.Fragment key={j}>{line}{j < arr.length - 1 && <br />}</React.Fragment>)}</p>))}</div>
      <footer className="hr-letter__sign">
        {d.signature !== false ? <img src={signOf(S)} alt="Signature of the Chairperson, Hands 4 Zero Poverty Trust" />
          : <><p>For <b>{S.org.replace(/\s*\(H4ZP\)\s*$/, '')}</b></p><div className="hr-letter__blank" /><p>{d.signatory || 'Authorised Signatory'}</p></>}
      </footer>
      {d.acceptance && <div className="hr-letter__accept"><p><b>Acceptance</b></p><p>I have read and understood the above terms and accept them.</p>
        <div><span>Signature: ____________________</span><span>Name: {(d.to_lines || [])[0]}</span><span>Date: ______________</span></div></div>}
    </article>
  );
}
