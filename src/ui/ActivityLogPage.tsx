import {useCallback,useEffect,useState} from 'react';
import type {ActivityLogService} from '../application/activityLogService';
import type {AuditRecord} from '../domain/audit';
import {Table} from './primitives';

export function ActivityLogPage({service}:{service:ActivityLogService}){
 const [entries,setEntries]=useState<AuditRecord[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);setError('');try{setEntries(await service.recent());}catch(e){setError(e instanceof Error?e.message:'Could not load the activity log.');}finally{setLoading(false);}},[service]);
 useEffect(()=>{void load();},[load]);
 return <section><h1>Activity log</h1><p>The latest 300 recorded business and account actions. Activity records are stored locally and included in encrypted backups.</p>{error&&<p className="error" role="alert">{error} <button type="button" className="secondary" onClick={()=>void load()}>Retry</button></p>}{loading?<p>Loading activity…</p>:entries.length?<Table headings={['When','Activity','User','Entity']}>
  {entries.map(row=><tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td><strong>{row.action.replaceAll('_',' ')}</strong><small>{row.summary}</small></td><td>{row.actorName}{row.actorRole&&<small>{row.actorRole==='SUPER_ADMIN'?'Super Admin':'Employee'}</small>}</td><td>{row.entityType.replaceAll('_',' ')}{row.entityId?` · ${row.entityId}`:''}</td></tr>)}
 </Table>:<p>No activity recorded yet.</p>}<p className="muted">The log helps review local account activity. It is not tamper-proof evidence; anyone with full access to this browser’s storage can modify it.</p></section>;
}
