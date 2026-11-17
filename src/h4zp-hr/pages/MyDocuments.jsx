import React, { useState } from 'react';
import { fmtDate } from '../lib/format';
import { Empty, Badge } from '../components/ui';
import { DocViewer } from './DocCenter';

export default function MyDocuments({ db, myStaff, store, notify }) {
  const [view, setView] = useState(null);
  const docs = db.records.filter((r) => r.kind === 'document' && r.staff_id === myStaff?.id && r.data.shared !== false)
    .sort((a, b) => ((b.data.date || b.data.uploaded_on || '') > (a.data.date || a.data.uploaded_on || '') ? 1 : -1));
  return (
    <div className="hr-page">
      <header className="hr-head"><div><h1>My documents</h1><p className="hr-muted">Letters and certificates issued to you by {db.settings.org}. Open one to print it or save it as PDF.</p></div></header>
      {docs.length === 0 ? <Empty title="No documents yet">When HR issues you a letter or certificate, it appears here.</Empty> : (
        <div className="hr-doclist">{docs.map((r) => (
          <div key={r.id} className="hr-doccard">
            <b>{r.data.generated ? r.data.type : r.data.type}</b>
            <span>{r.data.subject && r.data.subject !== r.data.type ? r.data.subject : r.data.file_name || ''}</span>
            <span>{r.data.ref ? `${r.data.ref} · ` : ''}{fmtDate(r.data.date || r.data.uploaded_on)}</span>
            <div className="hr-head__actions">{r.data.generated ? <Badge tone="info">Letter</Badge> : <Badge>File</Badge>}
              <button className="hr-btn hr-btn--small hr-btn--primary" onClick={() => setView(r)}>{r.data.generated ? 'View / download' : 'Open'}</button></div>
          </div>))}</div>)}
      {view && <DocViewer doc={view} settings={db.settings} store={store} notify={notify} onClose={() => setView(null)} />}
    </div>
  );
}
