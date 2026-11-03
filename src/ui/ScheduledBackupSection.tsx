import { useEffect, useState, type FormEvent } from 'react';
import { SCHEDULE_INTERVALS, type ScheduledBackupService, type ScheduleInterval, type ScheduleStatus } from '../application/scheduledBackupService';
import { folderPickingSupported, pickBackupFolder } from '../infrastructure/scheduledBackupStore';

const INTERVAL_LABEL: Record<ScheduleInterval, string> = { 15: 'Every 15 minutes', 60: 'Every hour', 360: 'Every 6 hours', 1440: 'Every day' };

function describeError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** Scheduled encrypted backups written into a chosen folder while AUXO is open. */
export function ScheduledBackupSection({scheduled}:{scheduled:ScheduledBackupService}){
  const supported = folderPickingSupported();
  const [status,setStatus] = useState<ScheduleStatus|null>(null);
  const [passphrase,setPassphrase] = useState('');
  const [enabled,setEnabled] = useState(false);
  const [interval,setInterval_] = useState<ScheduleInterval>(60);
  const [keepCount,setKeepCount] = useState(10);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);

  async function refresh(){
    const next = await scheduled.status();
    setStatus(next);
    setEnabled(next.settings.enabled);
    setInterval_(next.settings.intervalMinutes);
    setKeepCount(next.settings.keepCount);
  }

  useEffect(()=>{ if(supported) void refresh().catch(e=>setError(describeError(e,'Could not load scheduled backup settings.'))); },[]);

  async function run(action:()=>Promise<void>, done:string){
    setBusy(true);setError('');setMessage('');
    try{ await action(); setMessage(done); }
    catch(e){ setError(describeError(e,'Something went wrong.')); }
    finally{ setBusy(false); await refresh().catch(()=>{}); }
  }

  if(!supported) return <section className="scheduled-backups"><h2>Scheduled backups to a folder</h2><p>Scheduled folder backups need Chrome or Edge on a computer. You can still make encrypted backups by hand below.</p></section>;

  return <section className="scheduled-backups"><h2>Scheduled backups to a folder</h2>
    <p>AUXO writes an encrypted file to the folder you choose at the interval you set, while AUXO is open in this browser. Old files beyond the number you keep are removed from that folder only.</p>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
    {status&&<div className="backup-status"><p>Folder: <strong>{status.folderName ?? 'none chosen'}</strong></p>
      {status.folderName&&status.permission!=='granted'&&<p>Folder access is not allowed right now. Allow it to continue scheduled backups.</p>}
      <p>Passphrase: {status.hasPassphrase?'saved':'not saved'}</p>
      {status.settings.lastSuccessAt&&<p>Last file written: {new Date(status.settings.lastSuccessAt).toLocaleString()}</p>}
      {status.nextDueAt&&<p>Next file due: {new Date(status.nextDueAt).toLocaleString()}</p>}
      {status.settings.lastError&&<p className="error" role="alert">Latest problem: {status.settings.lastError}</p>}
    </div>}
    <div className="button-row">
      <button type="button" className="secondary" disabled={busy} onClick={()=>void run(async()=>{ await scheduled.chooseFolder(await pickBackupFolder()); }, 'Backup folder chosen.')}>Choose backup folder</button>
      {status?.folderName&&status.permission!=='granted'&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{ await scheduled.allowFolder(); }, 'Folder access allowed.')}>Allow folder access</button>}
    </div>
    <form onSubmit={(e:FormEvent)=>{e.preventDefault();void run(async()=>{ await scheduled.setPassphrase(passphrase); setPassphrase(''); }, 'Passphrase saved in this browser.');}}>
      <label>Backup passphrase for scheduled files (at least 10 characters)<input type="password" autoComplete="new-password" value={passphrase} onChange={e=>setPassphrase(e.target.value)}/></label>
      <button type="submit" className="secondary" disabled={busy||passphrase.length===0}>Save passphrase</button>
    </form>
    <form onSubmit={(e:FormEvent)=>{e.preventDefault();void run(()=>scheduled.configure({enabled,intervalMinutes:interval,keepCount}), 'Scheduled backup settings saved.');}}>
      <label className="check-label"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Write scheduled backups to the folder</label>
      <label>How often<select value={interval} onChange={e=>setInterval_(Number(e.target.value) as ScheduleInterval)}>{SCHEDULE_INTERVALS.map(v=><option key={v} value={v}>{INTERVAL_LABEL[v]}</option>)}</select></label>
      <label>Files to keep in the folder<input type="number" min={1} max={60} value={keepCount} onChange={e=>setKeepCount(Number(e.target.value))}/></label>
      <div className="button-row"><button type="submit" disabled={busy}>Save schedule</button><button type="button" className="secondary" disabled={busy} onClick={()=>void run(async()=>{ const wrote = await scheduled.runIfDue(true); if(!wrote){ const latest = await scheduled.status(); throw new Error(latest.settings.lastError ?? 'The backup was not written.'); } }, 'Backup written to the folder.')}>Back up now</button></div>
    </form>
  </section>;
}
