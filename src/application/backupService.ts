import type { AuthService } from './authService';
import { summarizeBackup, validateBackup, type BusinessSnapshot, type PortableBackup, type PortableSnapshot } from '../domain/backup';
import {PRODUCT_PHOTO_MIME} from '../domain/productPhotos';

export interface BackupStorage {snapshot():Promise<BusinessSnapshot>;replaceSnapshot(data:BusinessSnapshot):Promise<void>;recordAudit(actor:{id:string;name:string;role:'SUPER_ADMIN'|'EMPLOYEE'}|null,action:'BACKUP_CREATED',entityType:'backup',entityId:string|null,summary:string):Promise<void>}
const magic=new TextEncoder().encode('AUXOWEB1');
const headerSize=41,iterations=600_000,maxBytes=100*1024*1024;
async function encodePhoto(blob:Blob){const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
function decodePhoto(text:string){const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:PRODUCT_PHOTO_MIME});}
async function key(passphrase:string,salt:Uint8Array,rounds:number){const input=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:salt as BufferSource,iterations:rounds},input,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export type PreparedBackup={backup:PortableBackup;summary:ReturnType<typeof summarizeBackup>};

/** Web-specific passphrase-encrypted backup. It is not the Android .auxobak format. */
export class BackupService {
  constructor(private readonly storage:BackupStorage,private readonly auth:AuthService){}
  async export(passphrase:string):Promise<Blob>{
    await this.auth.require('BACKUP_AND_RESTORE');if(passphrase.length<10)throw new Error('Backup passphrase must be at least 10 characters.');
    const snapshot=await this.storage.snapshot(),data:PortableSnapshot={...snapshot,productPhotos:await Promise.all(snapshot.productPhotos.map(async photo=>({id:photo.id,mimeType:PRODUCT_PHOTO_MIME,data:await encodePhoto(photo.blob)})))};
    const backup:PortableBackup={app:'auxo-web-genesis',format:1,createdAt:Date.now(),databaseVersion:17,data};validateBackup(backup);
    const plaintext=new TextEncoder().encode(JSON.stringify(backup));if(plaintext.byteLength>maxBytes)throw new Error('Backup exceeds the current 100 MB web limit.');
    const header=new Uint8Array(headerSize);header.set(magic);header[8]=1;new DataView(header.buffer).setUint32(9,iterations,false);crypto.getRandomValues(header.subarray(13,29));crypto.getRandomValues(header.subarray(29,41));
    const secret=await key(passphrase,header.subarray(13,29),iterations);const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:header.subarray(29,41) as BufferSource,additionalData:header as BufferSource},secret,plaintext as BufferSource);
    const actor=this.auth.getSnapshot();await this.storage.recordAudit(actor?{id:actor.id,name:actor.name,role:actor.role}:null,'BACKUP_CREATED','backup',null,'Created an encrypted business backup');return new Blob([header.buffer,ciphertext],{type:'application/octet-stream'});
  }
  async inspect(file:Blob,passphrase:string):Promise<PreparedBackup>{
    await this.auth.require('BACKUP_AND_RESTORE');if(!passphrase)throw new Error('Enter the backup passphrase.');
    if(file.size<headerSize+16||file.size>maxBytes+headerSize+16)throw new Error('Backup file size is invalid or exceeds 100 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer()),header=bytes.subarray(0,headerSize);
    if(!magic.every((b,i)=>header[i]===b)||header[8]!==1)throw new Error('This is not a supported AUXO Web backup.');
    const rounds=new DataView(bytes.buffer,bytes.byteOffset,headerSize).getUint32(9,false);if(rounds<1||rounds>5_000_000)throw new Error('Backup key settings are invalid.');
    let plain:ArrayBuffer;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:header.subarray(29,41) as BufferSource,additionalData:header as BufferSource},await key(passphrase,header.subarray(13,29),rounds),bytes.subarray(headerSize) as BufferSource);}catch{throw new Error('Wrong passphrase or damaged backup file.');}
    let decoded:unknown;try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));}catch{throw new Error('Backup contents are damaged.');}
    const backup=validateBackup(decoded);return {backup,summary:summarizeBackup(backup)};
  }
  async restore(prepared:PreparedBackup){await this.auth.require('BACKUP_AND_RESTORE');const backup=validateBackup(prepared.backup),data:BusinessSnapshot={...backup.data,productPhotos:backup.data.productPhotos.map(photo=>({id:photo.id,blob:decodePhoto(photo.data)}))};await this.storage.replaceSnapshot(data);await this.auth.signOut();if(typeof window!=='undefined')try{window.localStorage.setItem('auxo-genesis-restored',String(Date.now()));}catch{/* Browser storage notifications are best effort after a completed restore. */}}
}
