import {useState,type FormEvent} from 'react';
import type {AuthService} from '../application/authService';
import {SharedBackupService,type PreparedSharedBackup} from '../application/sharedBackupService';

/** First-run restore: check a backup file, create the Super Admin login, then restore. Used on a new browser. */
export function RestoreSetupForm({auth,shared,onBack}:{auth:AuthService;shared:SharedBackupService;onBack:()=>void}){
  const [file,setFile]=useState<File|null>(null),[passphrase,setPassphrase]=useState(''),[prepared,setPrepared]=useState<PreparedSharedBackup|null>(null);
  const [name,setName]=useState(''),[identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);

  async function check(e:FormEvent){
    e.preventDefault();setError('');if(!file)return;setBusy(true);
    try{setPrepared(await shared.inspect(file,passphrase));}catch(err){setError(err instanceof Error?err.message:'Could not open this backup.');}finally{setBusy(false);}
  }

  async function createLoginAndRestore(e:FormEvent){
    e.preventDefault();if(!prepared)return;setError('');setBusy(true);
    try{
      // The restore runs inside setup: after encryption is ready, before the login is saved. If it fails, nothing is created.
      await auth.setup(name,identifier,password,confirm,()=>shared.restore(prepared));
    }catch(err){setError(err instanceof Error?err.message:'Could not create the login and restore the backup.');}
    finally{setBusy(false);}
  }

  if(!prepared)return <section><h1>Restore a backup</h1><p>Choose an AUXO backup file and enter its passphrase. The file is checked before anything is changed.</p>{error&&<p role="alert" className="error">{error}</p>}
    <form onSubmit={check}><label>Backup file<input required type="file" accept=".auxoshared,application/octet-stream" onChange={e=>setFile(e.target.files?.[0]??null)}/></label><label>Backup passphrase<input required type="password" autoComplete="off" value={passphrase} onChange={e=>setPassphrase(e.target.value)}/></label><div className="button-row"><button disabled={busy||!file} type="submit">{busy?'Checking…':'Check backup'}</button><button type="button" className="secondary" onClick={onBack}>Back</button></div></form></section>;

  return <section><h1>Create the Super Admin login</h1><p>The backup holds <strong>{prepared.summary.storeName}</strong> · {new Date(prepared.summary.createdAt).toLocaleString()} · {prepared.summary.products} products · {prepared.summary.invoices} invoices · {prepared.summary.customers} customers.</p><p>The backup does not contain any logins, so create a new Super Admin login. The shop data is restored once the login is created.</p>{error&&<p role="alert" className="error">{error}</p>}
    <form onSubmit={createLoginAndRestore}><label>Your name<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Username<input required value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label><label>Password<input required type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><div className="button-row"><button disabled={busy} type="submit">{busy?'Restoring…':'Create login and restore'}</button><button type="button" className="secondary" onClick={onBack}>Cancel</button></div></form></section>;
}
