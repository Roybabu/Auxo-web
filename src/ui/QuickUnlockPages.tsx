import { useState, type FormEvent } from 'react';
import type { AuthService } from '../application/authService';

const errorText=(e:unknown,fallback:string)=>e instanceof Error?e.message:fallback;

/** Shown instead of the whole app while the browser is locked. The person stays signed in. */
export function LockScreen({auth,userName}:{auth:AuthService;userName:string}){
  const hasPin=auth.hasPin(),off=auth.quickUnlockOff();
  const [usePassword,setUsePassword]=useState(!hasPin||off),[pin,setPin]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const passwordMode=usePassword||!hasPin||off;
  async function submit(event:FormEvent){event.preventDefault();setError('');setBusy(true);try{if(passwordMode)await auth.unlockWithPassword(password);else await auth.unlockWithPin(pin);setPin('');setPassword('');}catch(e){setError(errorText(e,'Could not unlock.'));setPin('');}finally{setBusy(false);}}
  return <main className="auth-screen lock-screen"><section>
    <div className="lock-badge" aria-hidden="true">🔒</div>
    <h1>Locked</h1>
    <p>{userName}, enter your {passwordMode?'password':'PIN'} to continue. Your bill and everything else are kept as you left them.</p>
    {off&&<p role="status" className="error">Too many wrong PINs. Use your password to unlock.</p>}
    <form onSubmit={submit}>
      {passwordMode
        ?<label>Password<input required autoFocus type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
        :<label>PIN<input required autoFocus className="pin-input" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>}
      {error&&<p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={busy}>{busy?'Checking…':'Unlock'}</button>
    </form>
    {hasPin&&!off&&<p><button type="button" className="secondary" onClick={()=>{setUsePassword(x=>!x);setError('');}}>{passwordMode?'Use PIN instead':'Use password instead'}</button></p>}
    <p><button type="button" className="text-button" onClick={()=>void auth.signOut().catch(()=>{})}>Sign out instead</button></p>
  </section></main>;
}

/** Set, change or remove the PIN, and lock now. Available to every signed-in person. */
export function QuickUnlockPage({auth}:{auth:AuthService}){
  const [hasPin,setHasPin]=useState(auth.hasPin());
  const [pin,setPin]=useState(''),[confirm,setConfirm]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  function reset(){setPin('');setConfirm('');setPassword('');}
  async function save(e:FormEvent){e.preventDefault();setError('');setMessage('');setBusy(true);try{await auth.setPin(password,pin,confirm);setHasPin(true);reset();setMessage(hasPin?'Your PIN was changed.':'Your PIN is set. Use Lock now to try it.');}catch(err){setError(errorText(err,'Could not save the PIN.'));}finally{setBusy(false);}}
  async function remove(){setError('');setMessage('');if(!password){setError('Type your password to remove the PIN.');return;}setBusy(true);try{await auth.removePin(password);setHasPin(false);reset();setMessage('Your PIN was removed.');}catch(err){setError(errorText(err,'Could not remove the PIN.'));}finally{setBusy(false);}}
  return <section><h1>Quick unlock</h1><p>Lock AUXO when you step away and open it again with a PIN or your password. Locking keeps you signed in and keeps any bill you were making. The PIN stays on this browser only and is never saved in backups.</p>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
    <div className="tile tile-green"><h2>Lock now</h2><p>Hide everything until you enter your PIN or password.</p><div className="button-row"><button type="button" onClick={()=>auth.lock()}>Lock now</button></div></div>
    <form className="tile tile-yellow" onSubmit={save}><h2>PIN</h2><p>{hasPin?'A PIN is set on this browser.':'No PIN is set on this browser.'}</p>
      <label>{hasPin?'New PIN (4 to 6 digits)':'PIN (4 to 6 digits)'}<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
      <label>Type the PIN again<input required type="password" inputMode="numeric" autoComplete="new-password" minLength={4} maxLength={6} value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
      <label>Your password (to confirm it is you)<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <div className="button-row"><button type="submit" disabled={busy}>{hasPin?'Change PIN':'Set PIN'}</button>{hasPin&&<button type="button" className="secondary" disabled={busy} onClick={()=>void remove()}>Remove PIN</button>}</div>
      {hasPin&&<p className="muted">To remove the PIN, type only your password above and press Remove PIN.</p>}
    </form></section>;
}
