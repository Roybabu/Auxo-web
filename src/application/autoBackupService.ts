import {openDB,type DBSchema} from 'idb';
import type {AuthService} from './authService';
import type {BusinessSnapshot} from '../domain/backup';

export type AutoBackupSchedule='EVERY_15_MINUTES'|'EVERY_30_MINUTES'|'HOURLY'|'EVERY_2_HOURS'|'EVERY_3_HOURS'|'EVERY_6_HOURS'|'EVERY_12_HOURS'|'DAILY'|'WEEKLY'|'EVERY_N_INVOICES';
export type AutoBackupSettings={enabled:boolean;schedule:AutoBackupSchedule;invoiceInterval:number;retentionCount:number;lastSuccessAt:number|null;lastFailureAt:number|null;lastFailure:string|null;lastInvoiceCount:number};
export type AutoBackupEntry={id:string;createdAt:number;invoiceCount:number;data:BusinessSnapshot};
type AutoBackupDatabase=DBSchema&{
  settings:{key:string;value:AutoBackupSettings};
  snapshots:{key:string;value:AutoBackupEntry;indexes:{'by-created-at':number}};
};
const defaults:AutoBackupSettings={enabled:false,schedule:'WEEKLY',invoiceInterval:50,retentionCount:5,lastSuccessAt:null,lastFailureAt:null,lastFailure:null,lastInvoiceCount:0};
const dbPromise=openDB<AutoBackupDatabase>('auxo-genesis-auto-backups',1,{upgrade(db){db.createObjectStore('settings');const snapshots=db.createObjectStore('snapshots',{keyPath:'id'});snapshots.createIndex('by-created-at','createdAt');}});
export type AutoBackupStatus={settings:AutoBackupSettings;state:'OFF'|'DUE'|'OK'|'FAILED';records:AutoBackupEntry[];invoiceCount:number};

export class AutoBackupService{
  constructor(private readonly storage:{snapshot():Promise<BusinessSnapshot>;replaceSnapshot(data:BusinessSnapshot):Promise<void>;listInvoices():Promise<unknown[]>},private readonly auth:AuthService){}
  async settings(){const db=await dbPromise;return await db.get('settings','config')??{...defaults};}
  async configure(input:Pick<AutoBackupSettings,'enabled'|'schedule'|'invoiceInterval'|'retentionCount'>){
    if(!['DAILY','WEEKLY','EVERY_N_INVOICES'].includes(input.schedule))throw new Error('Choose a valid automatic backup schedule.');
    if(!Number.isInteger(input.invoiceInterval)||input.invoiceInterval<5||input.invoiceInterval>500)throw new Error('Invoice interval must be between 5 and 500.');
    if(!Number.isInteger(input.retentionCount)||input.retentionCount<1||input.retentionCount>60)throw new Error('Keep between 1 and 60 automatic restore points.');
    const prior=await this.settings(),next={...prior,...input};const db=await dbPromise;await db.put('settings',next,'config');return next;
  }
  async status():Promise<AutoBackupStatus>{
    await this.auth.require('BACKUP_AND_RESTORE');const [settings,records,invoices]=await Promise.all([this.settings(),this.list(),this.storage.listInvoices()]);
    const state:AutoBackupStatus['state']=!settings.enabled?'OFF':settings.lastFailure&&(!settings.lastSuccessAt||settings.lastFailureAt!>(settings.lastSuccessAt??0))?'FAILED':this.isDue(settings,invoices.length)?'DUE':'OK';
    return {settings,state,records,invoiceCount:invoices.length};
  }
  async runIfDue(){
    await this.auth.require('BACKUP_AND_RESTORE');const settings=await this.settings();if(!settings.enabled)return false;const invoiceCount=(await this.storage.listInvoices()).length;if(!this.isDue(settings,invoiceCount))return false;await this.makeSnapshot(settings,invoiceCount);return true;
  }
  async runNow(){await this.auth.require('BACKUP_AND_RESTORE');const settings=await this.settings();const invoiceCount=(await this.storage.listInvoices()).length;await this.makeSnapshot(settings,invoiceCount);}
  private isDue(settings:AutoBackupSettings,invoiceCount:number){if(!settings.lastSuccessAt)return true;if(settings.schedule==='EVERY_N_INVOICES')return invoiceCount-settings.lastInvoiceCount>=settings.invoiceInterval;const intervals:Record<Exclude<AutoBackupSchedule,'EVERY_N_INVOICES'>,number>={EVERY_15_MINUTES:15*60_000,EVERY_30_MINUTES:30*60_000,HOURLY:60*60_000,EVERY_2_HOURS:2*60*60_000,EVERY_3_HOURS:3*60*60_000,EVERY_6_HOURS:6*60*60_000,EVERY_12_HOURS:12*60*60_000,DAILY:24*60*60_000,WEEKLY:7*24*60*60_000};return Date.now()-settings.lastSuccessAt>=(intervals[settings.schedule]??intervals.WEEKLY);}
  private async makeSnapshot(settings:AutoBackupSettings,invoiceCount:number){
    try{const data=await this.storage.snapshot(),entry:AutoBackupEntry={id:crypto.randomUUID(),createdAt:Date.now(),invoiceCount,data},db=await dbPromise,tx=db.transaction(['settings','snapshots'],'readwrite');await tx.objectStore('snapshots').add(entry);const all=await tx.objectStore('snapshots').getAll();all.sort((a,b)=>b.createdAt-a.createdAt);for(const old of all.slice(settings.retentionCount))await tx.objectStore('snapshots').delete(old.id);const updated={...settings,lastSuccessAt:entry.createdAt,lastFailure:null,lastInvoiceCount:invoiceCount};await tx.objectStore('settings').put(updated,'config');await tx.done;
    }catch(error){const db=await dbPromise;const current=await db.get('settings','config')??settings;await db.put('settings',{...current,lastFailureAt:Date.now(),lastFailure:error instanceof Error?error.message:'Automatic snapshot could not be saved.'},'config');throw error;}
  }
  async list(){const db=await dbPromise;return (await db.getAll('snapshots')).sort((a,b)=>b.createdAt-a.createdAt);}
  async restore(id:string){await this.auth.require('BACKUP_AND_RESTORE');const db=await dbPromise,entry=await db.get('snapshots',id);if(!entry)throw new Error('This automatic restore point is no longer available.');await this.storage.replaceSnapshot(entry.data);await this.auth.signOut();if(typeof window!=='undefined')try{window.localStorage.setItem('auxo-genesis-restored',String(Date.now()));}catch{/* Storage notification is best effort after restore. */}}
}
